"""Phase 2 — Security hardening tests.

Covers:
- GET /api/ returns env=dev in development
- /auth/create-pin rejects weak PINs (sequential, repeated, common)
- /auth/create-pin rejects non-numeric / wrong length
- /auth/register rejects passwords < 8 chars
- /auth/reset-password rejects new_password < 8 chars
- /profile/change-password rejects new < 8 chars
- /wallet/p2p atomic: insufficient balance returns 400 without debiting
- WebSocket /api/ws/auction/{id} backward compat (no token) + valid token + invalid token (4401)
"""
import asyncio
import json
import os
import time
import uuid

import pytest
import requests
import websockets

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://mobile-transfer-hub-3.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
WS_BASE = BASE_URL.replace("https://", "wss://").replace("http://", "ws://") + "/api/ws"

DEMO_EMAIL = "client@sendbid.app"
DEMO_PASSWORD = "Client@123!"
DEMO_PIN = "123456"


@pytest.fixture(scope="module")
def s():
    return requests.Session()


@pytest.fixture(scope="module")
def demo_token(s):
    r = s.post(f"{API}/auth/login", json={"identifier": DEMO_EMAIL, "password": DEMO_PASSWORD}, timeout=15)
    assert r.status_code == 200
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def demo_headers(demo_token):
    return {"Authorization": f"Bearer {demo_token}", "Content-Type": "application/json"}


def _register_fresh(s, password="TestPass@123"):
    """Helper: register and verify OTPs for a fresh user. Returns (user_id, email, password, token)."""
    suffix = uuid.uuid4().hex[:8]
    email = f"sec_{suffix}@sendbid.app"
    phone = f"+339{int(time.time()*1000) % 100000000:08d}"
    r = s.post(f"{API}/auth/register", json={
        "email": email, "phone": phone, "password": password, "full_name": "Sec Test"
    }, timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    rv = s.post(f"{API}/auth/verify-otp", json={
        "user_id": data["user_id"],
        "email_code": data["dev_email_otp"],
        "phone_code": data["dev_phone_otp"],
    }, timeout=15)
    assert rv.status_code == 200, rv.text
    return {
        "user_id": data["user_id"], "email": email, "phone": phone,
        "password": password, "token": rv.json()["access_token"],
    }


# -------------------------------------------------------------------
# 1. Env gating
# -------------------------------------------------------------------
def test_root_env_dev(s):
    r = s.get(f"{API}/", timeout=15)
    assert r.status_code == 200
    body = r.json()
    assert body.get("env") == "dev", f"Expected env=dev, got {body}"


# -------------------------------------------------------------------
# 2. Weak PIN rejection on /auth/create-pin
# -------------------------------------------------------------------
@pytest.fixture(scope="module")
def fresh_user_for_pin(s):
    return _register_fresh(s)


def _hdr(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def test_create_pin_rejects_123456(s, fresh_user_for_pin):
    r = s.post(f"{API}/auth/create-pin", json={"pin": "123456"},
               headers=_hdr(fresh_user_for_pin["token"]), timeout=15)
    assert r.status_code == 400
    assert "trop faible" in r.json().get("detail", "").lower() or "faible" in r.json().get("detail", "").lower()


def test_create_pin_rejects_111111(s, fresh_user_for_pin):
    r = s.post(f"{API}/auth/create-pin", json={"pin": "111111"},
               headers=_hdr(fresh_user_for_pin["token"]), timeout=15)
    assert r.status_code == 400


def test_create_pin_rejects_654321(s, fresh_user_for_pin):
    r = s.post(f"{API}/auth/create-pin", json={"pin": "654321"},
               headers=_hdr(fresh_user_for_pin["token"]), timeout=15)
    assert r.status_code == 400


def test_create_pin_rejects_non_numeric(s, fresh_user_for_pin):
    r = s.post(f"{API}/auth/create-pin", json={"pin": "12345a"},
               headers=_hdr(fresh_user_for_pin["token"]), timeout=15)
    assert r.status_code == 400


def test_create_pin_accepts_random_strong(s, fresh_user_for_pin):
    r = s.post(f"{API}/auth/create-pin", json={"pin": "581739"},
               headers=_hdr(fresh_user_for_pin["token"]), timeout=15)
    assert r.status_code == 200, r.text
    assert r.json().get("ok") is True


# -------------------------------------------------------------------
# 3. Password length on /auth/register, reset-password, change-password
# -------------------------------------------------------------------
def test_register_rejects_short_password(s):
    suffix = uuid.uuid4().hex[:8]
    r = s.post(f"{API}/auth/register", json={
        "email": f"shortpwd_{suffix}@sendbid.app",
        "phone": f"+335{int(time.time()*1000) % 100000000:08d}",
        "password": "abcde",  # 5 chars
        "full_name": "Short",
    }, timeout=15)
    assert r.status_code == 400
    assert "court" in r.json().get("detail", "").lower() or "short" in r.json().get("detail", "").lower()


def test_reset_password_rejects_short(s):
    """Use forgot-password flow with a fresh user, then attempt to reset with 5-char password."""
    fresh = _register_fresh(s, password="OkayPass@12")
    fp = s.post(f"{API}/auth/forgot-password", json={"email": fresh["email"]}, timeout=15)
    assert fp.status_code == 200
    token = fp.json().get("dev_reset_token")
    assert token, "Expected dev_reset_token in dev mode"
    r = s.post(f"{API}/auth/reset-password", json={"token": token, "new_password": "abcde"}, timeout=15)
    assert r.status_code == 400
    assert "court" in r.json().get("detail", "").lower()


def test_change_password_rejects_short(s):
    """Use a fresh user with valid current password; attempt new password of 5 chars."""
    fresh = _register_fresh(s, password="OkayPass@34")
    r = s.post(f"{API}/profile/change-password",
               json={"current": fresh["password"], "new": "abcde"},
               headers=_hdr(fresh["token"]), timeout=15)
    assert r.status_code == 400
    assert "court" in r.json().get("detail", "").lower()


# -------------------------------------------------------------------
# 4. P2P atomic — insufficient balance must NOT debit
# -------------------------------------------------------------------
def test_p2p_normal_then_insufficient(s, demo_headers):
    """Send a small valid P2P, then attempt one larger than balance and verify no debit."""
    # Recipient
    recipient = _register_fresh(s)

    # Get demo balance before
    w0 = s.get(f"{API}/wallet", headers=demo_headers, timeout=15).json()
    bal0 = w0["balance"]
    assert bal0 > 0

    # Normal P2P
    r1 = s.post(f"{API}/wallet/p2p", json={
        "recipient_identifier": recipient["email"],
        "amount": 1.0, "note": "TEST_atomic_ok", "pin": DEMO_PIN,
    }, headers=demo_headers, timeout=15)
    assert r1.status_code == 200, r1.text

    w1 = s.get(f"{API}/wallet", headers=demo_headers, timeout=15).json()
    bal1 = w1["balance"]
    assert abs((bal0 - bal1) - 1.0) < 0.001, f"Expected debit of 1.0 EUR, got delta={bal0 - bal1}"

    # Insufficient balance attempt
    huge = bal1 + 1_000_000.0
    r2 = s.post(f"{API}/wallet/p2p", json={
        "recipient_identifier": recipient["email"],
        "amount": huge, "note": "TEST_atomic_fail", "pin": DEMO_PIN,
    }, headers=demo_headers, timeout=15)
    assert r2.status_code == 400
    assert "insuffisant" in r2.json().get("detail", "").lower() or "solde" in r2.json().get("detail", "").lower()

    # Balance must be unchanged
    w2 = s.get(f"{API}/wallet", headers=demo_headers, timeout=15).json()
    assert abs(w2["balance"] - bal1) < 0.001, f"Balance changed after failed P2P: {bal1} -> {w2['balance']}"


# -------------------------------------------------------------------
# 5. WebSocket auth gating (?token=)
# -------------------------------------------------------------------
def _make_transfer(s, headers):
    draft = {
        "destination_country": "SN", "destination_currency": "XOF",
        "send_amount": 50.0, "receive_amount": 32797.85, "fx_rate": 655.957,
        "fee_percent": 1.5, "delivery_mode": "cash",
        "beneficiary": {"full_name": "WS Bene", "phone": "+221770000099", "country": "SN", "currency": "XOF"},
        "purpose": "x", "source_of_funds": "salary", "vip_delivery": False,
    }
    rd = s.post(f"{API}/transfers/draft", json=draft, headers=headers, timeout=15).json()
    rc = s.post(f"{API}/transfers/confirm", json={"draft_id": rd["id"], "pin": DEMO_PIN},
                headers=headers, timeout=15)
    assert rc.status_code == 200, rc.text
    return rc.json()


@pytest.fixture(scope="module")
def transfer_for_ws(s, demo_headers):
    return _make_transfer(s, demo_headers)


def test_ws_anonymous_backward_compat(transfer_for_ws):
    async def _run():
        url = f"{WS_BASE}/auction/{transfer_for_ws['id']}"
        async with websockets.connect(url, open_timeout=15) as ws:
            msg = await asyncio.wait_for(ws.recv(), timeout=15)
            data = json.loads(msg)
            assert data.get("event") == "snapshot"
    asyncio.run(_run())


def test_ws_with_valid_token(transfer_for_ws, demo_token):
    async def _run():
        url = f"{WS_BASE}/auction/{transfer_for_ws['id']}?token={demo_token}"
        async with websockets.connect(url, open_timeout=15) as ws:
            msg = await asyncio.wait_for(ws.recv(), timeout=15)
            data = json.loads(msg)
            assert data.get("event") == "snapshot"
            assert "bids" in data
    asyncio.run(_run())


def test_ws_with_invalid_token_closes_4401(transfer_for_ws):
    async def _run():
        url = f"{WS_BASE}/auction/{transfer_for_ws['id']}?token=invalid_token_xxx"
        try:
            async with websockets.connect(url, open_timeout=15) as ws:
                # Server should close. Try recv -> raises ConnectionClosed
                await asyncio.wait_for(ws.recv(), timeout=10)
                # If we got here without exception, fail
                assert False, "Expected connection to be closed by server"
        except websockets.exceptions.ConnectionClosed as e:
            assert e.code == 4401, f"Expected close code 4401, got {e.code}"
        except websockets.exceptions.InvalidStatus as e:
            # Some servers reject during handshake
            assert e.response.status_code in (401, 403), f"Unexpected status: {e.response.status_code}"
    asyncio.run(_run())
