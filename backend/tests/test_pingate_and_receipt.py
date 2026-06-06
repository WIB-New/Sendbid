"""SENDBID iteration_14 — PIN-gate post-login + verify-pin lockout + receipt-pdf with ?token=

Covers backend tasks BACKEND-1..BACKEND-5 from the review_request.
"""
import os
import requests
import pytest

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://paybid-preview.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

CLIENT_EMAIL = "client@sendbid.app"
CLIENT_PASSWORD = "Client@123!"
CLIENT_PIN = "123456"


@pytest.fixture(scope="module")
def client_session():
    """Login the demo client; returns (session_with_auth, token, user_dict)."""
    s = requests.Session()
    s.headers["Content-Type"] = "application/json"
    r = s.post(f"{API}/auth/login", json={"identifier": CLIENT_EMAIL, "password": CLIENT_PASSWORD}, timeout=15)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    data = r.json()
    token = data["access_token"]
    s.headers["Authorization"] = f"Bearer {token}"
    return s, token, data["user"]


# --- BACKEND-1: login → user.has_pin ----------------------------------------
class TestLoginHasPin:
    def test_login_returns_has_pin_true_for_demo_client(self, client_session):
        _, _, user = client_session
        assert user.get("has_pin") is True, f"expected has_pin=true, got {user.get('has_pin')!r}"
        # hash must NOT leak
        assert "pin_hash" not in user, "pin_hash leaked in /login user!"
        assert "password_hash" not in user, "password_hash leaked in /login user!"


# --- BACKEND-2: verify-pin OK -----------------------------------------------
class TestVerifyPinOk:
    def test_verify_pin_correct_returns_ok_true(self, client_session):
        s, _, _ = client_session
        r = s.post(f"{API}/auth/verify-pin", json={"pin": CLIENT_PIN}, timeout=10)
        assert r.status_code == 200, f"verify-pin should be 200, got {r.status_code} {r.text}"
        assert r.json().get("ok") is True


# --- BACKEND-3: verify-pin wrong + brute-force lock --------------------------
class TestVerifyPinWrongAndLock:
    def test_verify_pin_wrong_returns_400_or_401(self, client_session):
        s, _, _ = client_session
        r = s.post(f"{API}/auth/verify-pin", json={"pin": "999999"}, timeout=10)
        assert r.status_code in (400, 401), f"wrong pin should be 4xx, got {r.status_code} {r.text}"

    def test_verify_pin_brute_force_lock_after_5(self, client_session):
        """Per /app/memory/test_credentials.md: 5 wrong attempts → 423 lockout.
        NOTE: /api/auth/verify-pin handler does NOT call require_pin → no lockout is
        enforced. This test documents the behaviour gap."""
        s, _, _ = client_session
        statuses = []
        for _ in range(6):
            r = s.post(f"{API}/auth/verify-pin", json={"pin": "999999"}, timeout=10)
            statuses.append(r.status_code)
        # We KEEP the test informative — record statuses so it shows in junit
        # Expectation per spec: at least one 423 in the last 2 attempts
        got_lock = any(s == 423 for s in statuses)
        # End-test recovery: reset by valid PIN (if lock not engaged, this still passes)
        s.post(f"{API}/auth/verify-pin", json={"pin": CLIENT_PIN}, timeout=10)
        assert got_lock, f"BUG: no 423 returned after 6 wrong attempts (verify-pin lacks brute-force protection). statuses={statuses}"


# --- BACKEND-4: receipt-pdf with ?token= ------------------------------------
class TestReceiptPdf:
    @pytest.fixture(scope="class")
    def transfer_id(self, client_session):
        s, _, _ = client_session
        # Pick an existing COMPLETED transfer if any, otherwise PROCESSING/AGENT_ASSIGNED is fine
        r = s.get(f"{API}/transfers?limit=50", timeout=10)
        assert r.status_code == 200, r.text
        transfers = r.json()
        if not transfers:
            pytest.skip("No transfer in account; receipt-pdf cannot be tested without one")
        completed = [t for t in transfers if t.get("status") in ("COMPLETED", "PROCESSING", "AGENT_ASSIGNED", "BIDDING")]
        return (completed[0] if completed else transfers[0])["id"]

    def test_receipt_pdf_with_query_token_returns_pdf(self, client_session, transfer_id):
        _, token, _ = client_session
        # Use a fresh requests call WITHOUT Authorization header — only ?token=
        r = requests.get(f"{API}/transfers/{transfer_id}/receipt-pdf", params={"token": token}, timeout=20)
        assert r.status_code == 200, f"receipt-pdf failed: {r.status_code} {r.text[:200]}"
        assert r.headers.get("content-type", "").startswith("application/pdf"), \
            f"expected application/pdf, got {r.headers.get('content-type')}"
        assert r.content[:4] == b"%PDF", "response body is not a PDF"
        assert len(r.content) > 500, f"PDF suspiciously small ({len(r.content)} bytes)"

    def test_receipt_pdf_with_bad_token_returns_401(self, transfer_id):
        r = requests.get(f"{API}/transfers/{transfer_id}/receipt-pdf", params={"token": "not.a.valid.jwt"}, timeout=15)
        assert r.status_code in (401, 403), f"bad token must be 401/403, got {r.status_code}"

    def test_receipt_pdf_with_no_auth_returns_401(self, transfer_id):
        r = requests.get(f"{API}/transfers/{transfer_id}/receipt-pdf", timeout=15)
        assert r.status_code in (401, 403), f"no auth must be 401/403, got {r.status_code}"


# --- BACKEND-5: PUT /auth/me theme → reflected in GET /auth/me --------------
class TestUpdateThemeRoundtrip:
    def test_put_theme_dark_then_get_me_returns_dark(self, client_session):
        s, _, _ = client_session
        # Set dark
        r = s.put(f"{API}/auth/me", json={"theme": "dark"}, timeout=10)
        assert r.status_code == 200, f"PUT /auth/me dark failed: {r.text}"
        assert r.json()["user"].get("theme") == "dark"
        # GET /auth/me
        r2 = s.get(f"{API}/auth/me", timeout=10)
        assert r2.status_code == 200
        user = r2.json()["user"]
        assert user.get("theme") == "dark", f"theme not persisted in /me: {user.get('theme')!r}"
        # restore to light for idempotent re-runs
        s.put(f"{API}/auth/me", json={"theme": "light"}, timeout=10)
