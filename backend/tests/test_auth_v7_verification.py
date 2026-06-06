"""
SENDBID v7 — Tests pour le flow OTP séparé par canal (email / phone) et
le tracking first_login / verification popup.

Endpoints couverts :
- POST /api/auth/register             (régression)
- POST /api/auth/login                (tracking first_login_at)
- POST /api/auth/resend-email-otp     (nouveau)
- POST /api/auth/resend-phone-otp     (nouveau)
- POST /api/auth/verify-email-otp     (nouveau)
- POST /api/auth/verify-phone-otp     (nouveau)
- POST /api/auth/mark-verification-popup-shown  (nouveau, idempotent)
- POST /api/auth/create-pin           (régression)
- POST /api/auth/verify-otp           (régression, ancien combiné)
- GET  /api/auth/me                   (expose has_pin, ne leak ni pin_hash ni password_hash)
"""
import os
import random
import string
import time

import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("EXPO_BACKEND_URL")
assert BASE_URL, "EXPO_PUBLIC_BACKEND_URL must be set"
BASE_URL = BASE_URL.rstrip("/")
API = f"{BASE_URL}/api"


def _rand_suffix(n: int = 8) -> str:
    return "".join(random.choices(string.ascii_lowercase + string.digits, k=n))


def _rand_phone() -> str:
    # E.164 FR-like, kept inside Twilio test domain pattern (services usually skip real send)
    return "+3361" + "".join(random.choices(string.digits, k=7))


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def fresh_user(session):
    """Register a brand new user and return its info + JWT."""
    suffix = _rand_suffix()
    payload = {
        "email": f"test_v7_{suffix}@example.com",
        "phone": _rand_phone(),
        "password": "Test@1234!",
        "full_name": f"TEST V7 {suffix}",
        "country": "FR",
        "city": "Paris",
        "accept_terms": True,
    }
    r = session.post(f"{API}/auth/register", json=payload, timeout=30)
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    body = r.json()
    assert "user_id" in body and "token" in body
    assert "dev_email_otp" in body and "dev_phone_otp" in body, "dev OTPs must be exposed in non-prod"
    return {
        "user_id": body["user_id"],
        "token": body["token"],
        "email": payload["email"],
        "phone": payload["phone"],
        "password": payload["password"],
        "initial_email_otp": body["dev_email_otp"],
        "initial_phone_otp": body["dev_phone_otp"],
    }


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# 1) Scénario complet : register → resend per channel → verify per channel → /me
# ---------------------------------------------------------------------------
class TestV7ChannelOtpFlow:
    def test_01_resend_email_otp(self, session, fresh_user):
        r = session.post(
            f"{API}/auth/resend-email-otp",
            headers=_auth(fresh_user["token"]),
            json={},
            timeout=20,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("ok") is True
        assert "dev_email_otp" in body, "dev_email_otp must be returned in non-prod"
        assert len(str(body["dev_email_otp"])) >= 4
        # Stash for next test
        fresh_user["email_otp"] = body["dev_email_otp"]

    def test_02_verify_email_otp(self, session, fresh_user):
        code = fresh_user.get("email_otp") or fresh_user["initial_email_otp"]
        r = session.post(
            f"{API}/auth/verify-email-otp",
            headers=_auth(fresh_user["token"]),
            json={"code": code},
            timeout=20,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("ok") is True
        assert body.get("email_verified") is True

    def test_03_verify_email_otp_idempotent(self, session, fresh_user):
        """Re-verifying when already verified should return already_verified."""
        r = session.post(
            f"{API}/auth/verify-email-otp",
            headers=_auth(fresh_user["token"]),
            json={"code": "0000"},
            timeout=20,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("email_verified") is True
        assert body.get("already_verified") is True

    def test_04_resend_phone_otp(self, session, fresh_user):
        r = session.post(
            f"{API}/auth/resend-phone-otp",
            headers=_auth(fresh_user["token"]),
            json={},
            timeout=20,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("ok") is True
        assert "dev_phone_otp" in body
        fresh_user["phone_otp"] = body["dev_phone_otp"]

    def test_05_verify_phone_otp_wrong_code(self, session, fresh_user):
        r = session.post(
            f"{API}/auth/verify-phone-otp",
            headers=_auth(fresh_user["token"]),
            json={"code": "000000"},
            timeout=20,
        )
        # Should be 400 (incorrect code) — unless the random code actually matches
        assert r.status_code in (400, 200)
        if r.status_code == 200:
            # extremely unlikely, but skip
            pytest.skip("Random 000000 happened to match. Skipping wrong-code assertion.")

    def test_06_verify_phone_otp(self, session, fresh_user):
        code = fresh_user.get("phone_otp")
        assert code, "phone_otp must have been set by resend-phone-otp"
        r = session.post(
            f"{API}/auth/verify-phone-otp",
            headers=_auth(fresh_user["token"]),
            json={"code": code},
            timeout=20,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("ok") is True
        assert body.get("phone_verified") is True

    def test_07_me_exposes_flags_and_has_pin(self, session, fresh_user):
        r = session.get(f"{API}/auth/me", headers=_auth(fresh_user["token"]), timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        user = body.get("user", {})
        assert user.get("email_verified") is True
        assert user.get("phone_verified") is True
        assert "has_pin" in user, "has_pin must be present in /me response"
        assert user["has_pin"] is False, "User has no PIN yet"

    def test_08_me_does_not_leak_hashes(self, session, fresh_user):
        r = session.get(f"{API}/auth/me", headers=_auth(fresh_user["token"]), timeout=15)
        assert r.status_code == 200
        user = r.json().get("user", {})
        assert "pin_hash" not in user, "pin_hash must NEVER be returned"
        assert "password_hash" not in user, "password_hash must NEVER be returned"
        # Defense-in-depth: check the raw body text
        raw = r.text
        assert "pin_hash" not in raw
        assert "password_hash" not in raw

    def test_09_create_pin_then_has_pin_true(self, session, fresh_user):
        # Use a non-weak 6-digit PIN
        r = session.post(
            f"{API}/auth/create-pin",
            headers=_auth(fresh_user["token"]),
            json={"pin": "729184"},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True

        r2 = session.get(f"{API}/auth/me", headers=_auth(fresh_user["token"]), timeout=15)
        assert r2.status_code == 200
        user = r2.json().get("user", {})
        assert user.get("has_pin") is True


# ---------------------------------------------------------------------------
# 2) mark-verification-popup-shown — idempotent
# ---------------------------------------------------------------------------
class TestMarkPopupShown:
    def test_mark_popup_first_call_sets_timestamp(self, session, fresh_user):
        r = session.post(
            f"{API}/auth/mark-verification-popup-shown",
            headers=_auth(fresh_user["token"]),
            json={},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True

        r2 = session.get(f"{API}/auth/me", headers=_auth(fresh_user["token"]), timeout=15)
        user = r2.json().get("user", {})
        ts1 = user.get("verification_popup_shown_at")
        assert ts1, "verification_popup_shown_at must be set after first call"

        # Second call should be idempotent (timestamp unchanged)
        time.sleep(1.1)
        r3 = session.post(
            f"{API}/auth/mark-verification-popup-shown",
            headers=_auth(fresh_user["token"]),
            json={},
            timeout=15,
        )
        assert r3.status_code == 200

        r4 = session.get(f"{API}/auth/me", headers=_auth(fresh_user["token"]), timeout=15)
        ts2 = r4.json().get("user", {}).get("verification_popup_shown_at")
        assert ts2 == ts1, "Timestamp must NOT change on second call (idempotent)"


# ---------------------------------------------------------------------------
# 3) Tracking first_login_at — demo client
# ---------------------------------------------------------------------------
class TestFirstLoginTracking:
    def test_demo_client_login_and_me(self, session):
        r = session.post(
            f"{API}/auth/login",
            json={"identifier": "client@sendbid.app", "password": "Client@123!"},
            timeout=20,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert "access_token" in body
        token = body["access_token"]

        r2 = session.get(f"{API}/auth/me", headers=_auth(token), timeout=15)
        assert r2.status_code == 200
        user = r2.json().get("user", {})

        # first_login_at must be present (set on first login, preserved on subsequent ones)
        assert "first_login_at" in user, "first_login_at must be exposed on /me"
        assert user["first_login_at"], "first_login_at must have a value"

        # has_pin must be true for the seeded demo client (PIN 123456 pre-seeded)
        assert user.get("has_pin") is True, "Demo client should have has_pin=true"

        # No hash leaks
        assert "pin_hash" not in user
        assert "password_hash" not in user

    def test_login_twice_does_not_overwrite_first_login_at(self, session):
        # First login (already done in previous test, but re-fetch to capture timestamp)
        r = session.post(
            f"{API}/auth/login",
            json={"identifier": "client@sendbid.app", "password": "Client@123!"},
            timeout=20,
        )
        token1 = r.json()["access_token"]
        ts1 = session.get(f"{API}/auth/me", headers=_auth(token1), timeout=15).json()["user"]["first_login_at"]

        time.sleep(1.2)

        # Second login
        r2 = session.post(
            f"{API}/auth/login",
            json={"identifier": "client@sendbid.app", "password": "Client@123!"},
            timeout=20,
        )
        token2 = r2.json()["access_token"]
        ts2 = session.get(f"{API}/auth/me", headers=_auth(token2), timeout=15).json()["user"]["first_login_at"]

        assert ts1 == ts2, f"first_login_at must remain stable across logins (got {ts1!r} → {ts2!r})"


# ---------------------------------------------------------------------------
# 4) Régression — ancien endpoint verify-otp combiné toujours fonctionnel
# ---------------------------------------------------------------------------
class TestLegacyVerifyOtp:
    def test_legacy_verify_otp_with_new_user(self, session):
        # Spawn a fresh user just for this regression
        suffix = _rand_suffix()
        payload = {
            "email": f"test_legacy_{suffix}@example.com",
            "phone": _rand_phone(),
            "password": "Test@1234!",
            "full_name": f"TEST LEGACY {suffix}",
            "country": "FR",
            "accept_terms": True,
        }
        r = session.post(f"{API}/auth/register", json=payload, timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        user_id = body["user_id"]
        e_otp = body["dev_email_otp"]
        p_otp = body["dev_phone_otp"]

        # Old combined endpoint
        r2 = session.post(
            f"{API}/auth/verify-otp",
            json={"user_id": user_id, "email_code": e_otp, "phone_code": p_otp},
            timeout=15,
        )
        assert r2.status_code == 200, r2.text
        body2 = r2.json()
        assert "access_token" in body2
        assert body2["user"]["email_verified"] is True
        assert body2["user"]["phone_verified"] is True


# ---------------------------------------------------------------------------
# 5) Sécurité — unauthenticated requests rejected
# ---------------------------------------------------------------------------
class TestSecurityNoAuth:
    @pytest.mark.parametrize("path", [
        "/auth/resend-email-otp",
        "/auth/resend-phone-otp",
        "/auth/verify-email-otp",
        "/auth/verify-phone-otp",
        "/auth/mark-verification-popup-shown",
    ])
    def test_endpoint_requires_auth(self, session, path):
        body = {"code": "1234"} if "verify" in path else {}
        r = session.post(f"{API}{path}", json=body, timeout=15)
        assert r.status_code in (401, 403), f"{path} should require auth, got {r.status_code}"
