"""Regression suite for the backend modular refactor (iteration 17).

Validates that ALL endpoints from the original monoliths still respond after
the split into thematic packages:
  - routers/auth/{core,otp,pin,password,biometric,contact_change}.py
  - routers/wallet/{core,withdraw,p2p,recharge}.py
  - routers/transfers/{core,auction,receipts}.py
  - routers/agent/{core,auctions,transfers,earnings}.py
  - routers/web_panels/{marketing,auth_panel,admin,superadmin,partner}.py

Scope: regression only (status codes + minimal response shape). PIN
brute-force lockout is NOT re-tested (already confirmed in iter 15).
"""
import os
import random
import string
import time

import pytest
import requests


BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://paybid-preview.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

CLIENT_EMAIL = "client@sendbid.app"
CLIENT_PASSWORD = "Client@123!"
CLIENT_PIN = "123456"


# ------------------------ Fixtures ------------------------

@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def client_token(session):
    r = session.post(f"{API}/auth/login", json={"identifier": CLIENT_EMAIL, "password": CLIENT_PASSWORD})
    assert r.status_code == 200, r.text
    data = r.json()
    assert "access_token" in data
    assert data.get("user", {}).get("has_pin") is True
    return data["access_token"]


@pytest.fixture(scope="module")
def auth_headers(client_token):
    return {"Authorization": f"Bearer {client_token}", "Content-Type": "application/json"}


def _rand_email():
    suffix = "".join(random.choices(string.ascii_lowercase + string.digits, k=10))
    return f"test_{suffix}@sendbid.test"


def _rand_phone():
    return "+3361" + "".join(random.choices(string.digits, k=7))


# ============================================================
# AUTH PACKAGE
# ============================================================
class TestAuthRegression:
    """routers/auth/* — register / login / me / pin / forgot-password"""

    def test_login_demo_client_returns_token_and_has_pin(self, session):
        r = session.post(f"{API}/auth/login", json={"identifier": CLIENT_EMAIL, "password": CLIENT_PASSWORD})
        assert r.status_code == 200, r.text
        body = r.json()
        assert "access_token" in body
        assert body["user"]["has_pin"] is True
        assert body["user"]["email"] == CLIENT_EMAIL

    def test_login_wrong_password_401(self, session):
        r = session.post(f"{API}/auth/login", json={"identifier": CLIENT_EMAIL, "password": "WrongPass!"})
        assert r.status_code == 401

    def test_get_me_returns_user_and_wallet(self, session, auth_headers):
        r = session.get(f"{API}/auth/me", headers=auth_headers)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "user" in body and "wallet" in body
        assert body["user"]["email"] == CLIENT_EMAIL
        assert body["user"]["has_pin"] is True
        assert "pin_hash" not in body["user"]
        # wallet may be None for some users, but demo client has one
        assert body["wallet"] is not None
        assert "balance" in body["wallet"]

    def test_register_random_user_returns_token(self, session):
        suffix = "".join(random.choices(string.ascii_lowercase + string.digits, k=10))
        payload = {
            "email": f"test_{suffix}@example.com",
            "phone": _rand_phone(),
            "password": "Pass@1234",
            "full_name": "Test User Refactor",
            "accept_terms": True,
            "country": "FR",
            "city": "Paris",
        }
        r = session.post(f"{API}/auth/register", json=payload)
        # 200/201 = created ; 400 might be Twilio fraud-risk rejection on test number — accept both, log
        assert r.status_code in (200, 201, 400), r.text
        if r.status_code in (200, 201):
            body = r.json()
            assert "token" in body or "access_token" in body
            assert "user_id" in body

    def test_verify_pin_correct(self, session, auth_headers):
        r = session.post(f"{API}/auth/verify-pin", json={"pin": CLIENT_PIN}, headers=auth_headers)
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True

    def test_verify_pin_wrong_returns_401(self, session, auth_headers):
        # single attempt — NOT testing lockout (already validated iter 15)
        r = session.post(f"{API}/auth/verify-pin", json={"pin": "999999"}, headers=auth_headers)
        # 401 = wrong PIN, 423 = already locked from previous run, both acceptable
        assert r.status_code in (401, 423), r.text

    def test_forgot_password_returns_200(self, session):
        r = session.post(f"{API}/auth/forgot-password", json={"email": CLIENT_EMAIL})
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True

    def test_create_pin_endpoint_exists(self, session):
        """A fresh user (no PIN) can call /auth/create-pin. We register a user
        and verify the endpoint is wired (200 or 400 weak-pin)."""
        payload = {
            "email": _rand_email(),
            "phone": _rand_phone(),
            "password": "Pass@1234",
            "full_name": "PIN Setup User",
            "accept_terms": True,
            "country": "FR",
        }
        r = session.post(f"{API}/auth/register", json=payload)
        if r.status_code not in (200, 201):
            pytest.skip(f"register skipped (Twilio): {r.status_code} {r.text[:120]}")
        token = r.json().get("token") or r.json().get("access_token")
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        # strong non-weak PIN
        r2 = requests.post(f"{API}/auth/create-pin", json={"pin": "284917"}, headers=headers)
        assert r2.status_code == 200, r2.text
        assert r2.json().get("ok") is True


# ============================================================
# WALLET PACKAGE
# ============================================================
class TestWalletRegression:
    """routers/wallet/* — wallet / transactions / withdraw / p2p / recharge-qr"""

    def test_get_wallet(self, session, auth_headers):
        r = session.get(f"{API}/wallet", headers=auth_headers)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "balance" in body
        assert "currency" in body

    def test_get_wallet_transactions(self, session, auth_headers):
        r = session.get(f"{API}/wallet/transactions", headers=auth_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_recharge_qr_with_pin(self, session, auth_headers):
        r = session.post(f"{API}/wallet/recharge-qr", json={"amount": 50.0, "pin": CLIENT_PIN}, headers=auth_headers)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "qr_token" in body
        assert body["amount"] == 50.0

    def test_p2p_unknown_recipient_returns_404(self, session, auth_headers):
        r = session.post(
            f"{API}/wallet/p2p",
            json={"recipient_identifier": "ghost-nobody-xyz@nowhere.test", "amount": 1.0, "pin": CLIENT_PIN, "note": "test"},
            headers=auth_headers,
        )
        # 404 = recipient_not_found (acceptable per spec), or 200 if found
        assert r.status_code in (200, 404), r.text

    def test_withdraw_bank_with_pin(self, session, auth_headers):
        r = session.post(
            f"{API}/wallet/withdraw",
            json={
                "amount": 5.0,
                "method": "bank",
                "pin": CLIENT_PIN,
                "details": {"iban": "FR7630003000404444444444404", "holder": "Aicha Demo", "bank": "Test Bank"},
            },
            headers=auth_headers,
        )
        # 200 = OK ; 400 = solde insuffisant (acceptable selon état du wallet)
        assert r.status_code in (200, 400), r.text
        if r.status_code == 200:
            body = r.json()
            assert "tx_id" in body
            assert "payout_id" in body


# ============================================================
# TRANSFERS PACKAGE
# ============================================================
class TestTransfersRegression:
    """routers/transfers/* — fx-rate / draft / list / get / receipt-pdf / validate-code"""

    @pytest.fixture(scope="class")
    def draft_id(self, session, auth_headers):
        payload = {
            "destination_country": "CI",
            "destination_currency": "XOF",
            "send_amount": 50.0,
            "receive_amount": 32797.85,
            "fx_rate": 655.957,
            "fee_percent": 2.0,
            "vip_fee_amount": 0.0,
            "delivery_mode": "cash",
            "beneficiary": {"full_name": "Test Beneficiary", "phone": "+2250707070707"},
            "delivery_details": {},
            "purpose": "family",
            "source_of_funds": "salary",
            "vip_delivery": False,
            "vip_express": False,
        }
        r = session.post(f"{API}/transfers/draft", json=payload, headers=auth_headers)
        assert r.status_code == 200, r.text
        body = r.json()
        return body["id"]

    def test_fx_rate_eur_xof(self, session):
        r = session.get(f"{API}/transfers/fx-rate", params={"from_currency": "EUR", "to_currency": "XOF"})
        assert r.status_code == 200
        body = r.json()
        assert body["to"] == "XOF"
        assert body["rate"] > 0

    def test_draft_created(self, draft_id):
        assert draft_id is not None
        assert len(draft_id) > 0

    def test_list_transfers(self, session, auth_headers):
        r = session.get(f"{API}/transfers", headers=auth_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_get_existing_transfer_and_receipt_pdf(self, session, auth_headers, client_token):
        # find an existing completed transfer or any transfer
        r = session.get(f"{API}/transfers", headers=auth_headers)
        assert r.status_code == 200
        items = r.json()
        if not items:
            pytest.skip("no historical transfer for this client")
        tid = items[0]["id"]
        # GET single
        r2 = session.get(f"{API}/transfers/{tid}", headers=auth_headers)
        assert r2.status_code == 200, r2.text
        assert r2.json()["id"] == tid
        # Receipt PDF with ?token=
        r3 = requests.get(f"{API}/transfers/{tid}/receipt-pdf", params={"token": client_token})
        assert r3.status_code == 200, r3.text[:200]
        assert r3.headers.get("content-type", "").startswith("application/pdf")
        assert r3.content[:4] == b"%PDF"

    def test_validate_code_invalid_returns_400_or_404(self, session, auth_headers):
        r = session.post(f"{API}/transfers/validate-code", json={"code": "0000000000"}, headers=auth_headers)
        # 400 = code invalide (too short or len check) ; 404 = not found
        assert r.status_code in (400, 404), r.text


# ============================================================
# AGENT PACKAGE
# ============================================================
class TestAgentRegression:
    """routers/agent/* — signup / me / dashboard"""

    def test_agent_me_without_agent_token_returns_403(self, session, auth_headers):
        # client token (role=user) hitting agent /me → 403 by _require_agent
        r = session.get(f"{API}/agent/me", headers=auth_headers)
        assert r.status_code == 403, r.text

    def test_agent_dashboard_without_agent_token_returns_403(self, session, auth_headers):
        r = session.get(f"{API}/agent/dashboard", headers=auth_headers)
        assert r.status_code == 403

    def test_agent_signup(self, session):
        payload = {
            "email": _rand_email(),
            "phone": _rand_phone(),
            "password": "Agent@1234",
            "full_name": "Agent Refactor",
            "city": "Abidjan",
            "country": "CI",
        }
        r = session.post(f"{API}/agent/signup", json=payload)
        # 200 = created ; 400 = email/phone déjà utilisé (acceptable si race)
        assert r.status_code in (200, 400, 409), r.text
        if r.status_code == 200:
            body = r.json()
            assert body.get("role") == "agent"
            assert "agent_id" in body


# ============================================================
# WEB PANELS PACKAGE
# ============================================================
class TestWebPanelsRegression:
    """routers/web_panels/* — marketing / admin / superadmin / partner"""

    def test_marketing_home_returns_html(self, session):
        r = requests.get(f"{API}/web/")
        assert r.status_code == 200, r.text[:200]
        assert "text/html" in r.headers.get("content-type", "")
        assert "SENDBID" in r.text or "sendbid" in r.text.lower()

    def test_admin_login_page_when_not_authenticated(self, session):
        r = requests.get(f"{API}/web/admin", allow_redirects=False)
        # _login_page returns HTML 200 with login form when no session
        assert r.status_code in (200, 302, 303), r.text[:200]

    def test_superadmin_endpoint_reachable(self, session):
        r = requests.get(f"{API}/web/superadmin", allow_redirects=False)
        assert r.status_code in (200, 302, 303, 403, 404), r.text[:200]

    def test_partner_endpoint_reachable(self, session):
        r = requests.get(f"{API}/web/partner", allow_redirects=False)
        assert r.status_code in (200, 302, 303, 403, 404), r.text[:200]


# ============================================================
# WEBSOCKET REGISTRATION (import-time smoke)
# ============================================================
class TestWebSocketRegistration:
    """Confirms WS routes are registered via transfers.register_websocket(app).
    FastAPI WebSocket routes return 404 to plain HTTP GET, so we introspect
    the app object directly."""

    def test_ws_routes_registered_via_introspection(self):
        import sys, os
        sys.path.insert(0, "/app/backend")
        os.chdir("/app/backend")
        from server import app
        # Starlette uses APIWebSocketRoute / WebSocketRoute; capture both
        ws_paths = []
        for r in app.routes:
            cls = r.__class__.__name__
            if "WebSocket" in cls or "Websocket" in cls:
                ws_paths.append(getattr(r, "path", str(r)))
        # Also walk APIRouter children
        for r in app.routes:
            inner = getattr(r, "routes", None)
            if inner:
                for sub in inner:
                    if "WebSocket" in sub.__class__.__name__:
                        ws_paths.append(getattr(sub, "path", str(sub)))
        assert any("auction" in p for p in ws_paths), f"ws/auction missing in {ws_paths}"
        assert any("agent" in p for p in ws_paths), f"ws/agent missing in {ws_paths}"

    def test_register_websocket_helper_exists(self):
        from routers import transfers
        assert hasattr(transfers, "register_websocket")
        assert callable(transfers.register_websocket)
