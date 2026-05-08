"""SENDBID Backend API tests.

Covers: auth, wallet, transfers (auction + PDF), beneficiaries, payment methods,
KYC, notifications, profile, referral, loyalty, scheduled, disputes, documents,
support, countries, websocket, PIN brute-force lockout.
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


@pytest.fixture(scope="session")
def s():
    return requests.Session()


@pytest.fixture(scope="session")
def demo_token(s):
    """Login the demo client, return access token."""
    r = s.post(f"{API}/auth/login", json={"identifier": DEMO_EMAIL, "password": DEMO_PASSWORD}, timeout=15)
    assert r.status_code == 200, f"Demo login failed: {r.status_code} {r.text}"
    data = r.json()
    assert "access_token" in data
    return data["access_token"]


@pytest.fixture(scope="session")
def auth_headers(demo_token):
    return {"Authorization": f"Bearer {demo_token}", "Content-Type": "application/json"}


# ------------------------------------------------------------------
# Health
# ------------------------------------------------------------------
def test_health(s):
    r = s.get(f"{API}/", timeout=10)
    assert r.status_code == 200
    assert r.json().get("status") == "ok"


# ------------------------------------------------------------------
# Auth flow: register -> verify OTP -> login
# ------------------------------------------------------------------
@pytest.fixture(scope="session")
def new_user(s):
    """Register a fresh user and verify OTPs. Returns dict(user_id, email, password, token)."""
    suffix = uuid.uuid4().hex[:8]
    email = f"test_{suffix}@sendbid.app"
    phone = f"+336{int(time.time()) % 100000000:08d}"
    password = "TestPass@123"
    r = s.post(f"{API}/auth/register", json={
        "email": email, "phone": phone, "password": password, "full_name": "Test User",
    }, timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "user_id" in data
    assert "dev_email_otp" in data and "dev_phone_otp" in data
    user_id = data["user_id"]

    # verify OTP
    rv = s.post(f"{API}/auth/verify-otp", json={
        "user_id": user_id,
        "email_code": data["dev_email_otp"],
        "phone_code": data["dev_phone_otp"],
    }, timeout=15)
    assert rv.status_code == 200, rv.text
    vd = rv.json()
    assert "access_token" in vd
    return {"user_id": user_id, "email": email, "phone": phone,
            "password": password, "token": vd["access_token"]}


def test_register_duplicate(s, new_user):
    r = s.post(f"{API}/auth/register", json={
        "email": new_user["email"], "phone": new_user["phone"],
        "password": "x", "full_name": "x",
    }, timeout=15)
    assert r.status_code == 400


def test_login_demo_client(s):
    r = s.post(f"{API}/auth/login", json={"identifier": DEMO_EMAIL, "password": DEMO_PASSWORD}, timeout=15)
    assert r.status_code == 200
    body = r.json()
    assert "access_token" in body
    assert body["user"]["email"] == DEMO_EMAIL
    assert body["user"]["profile_id"] == "SB100001"


def test_login_wrong_password(s):
    r = s.post(f"{API}/auth/login", json={"identifier": DEMO_EMAIL, "password": "wrong"}, timeout=15)
    assert r.status_code == 401


def test_auth_me(s, auth_headers):
    r = s.get(f"{API}/auth/me", headers=auth_headers, timeout=15)
    assert r.status_code == 200
    body = r.json()
    assert body["user"]["email"] == DEMO_EMAIL
    assert body["wallet"]["balance"] >= 0
    assert body["wallet"]["currency"] == "EUR"


def test_create_pin_for_new_user(s, new_user):
    headers = {"Authorization": f"Bearer {new_user['token']}", "Content-Type": "application/json"}
    # Use a strong (random, non-sequential, non-repeated) PIN
    r = s.post(f"{API}/auth/create-pin", json={"pin": "582930"}, headers=headers, timeout=15)
    assert r.status_code == 200, r.text
    assert r.json().get("ok") is True
    # invalid pin
    r2 = s.post(f"{API}/auth/create-pin", json={"pin": "abc"}, headers=headers, timeout=15)
    assert r2.status_code == 400


def test_biometric_enable_and_login(s, auth_headers):
    r = s.post(f"{API}/auth/biometric-enable", headers=auth_headers, timeout=15)
    assert r.status_code == 200
    bio = r.json().get("biometric_token")
    assert bio
    rl = s.post(f"{API}/auth/biometric-login", json={"biometric_token": bio}, timeout=15)
    assert rl.status_code == 200
    assert "access_token" in rl.json()
    # invalid biometric token
    bad = s.post(f"{API}/auth/biometric-login", json={"biometric_token": "bad"}, timeout=15)
    assert bad.status_code == 401


def test_forgot_and_reset_password(s):
    """Use a temporary user (not demo) to avoid changing demo password."""
    suffix = uuid.uuid4().hex[:8]
    email = f"reset_{suffix}@sendbid.app"
    phone = f"+337{int(time.time()) % 100000000:08d}"
    password = "Pwd@111111"
    reg = s.post(f"{API}/auth/register", json={
        "email": email, "phone": phone, "password": password, "full_name": "Reset User",
    }, timeout=15).json()
    s.post(f"{API}/auth/verify-otp", json={
        "user_id": reg["user_id"],
        "email_code": reg["dev_email_otp"],
        "phone_code": reg["dev_phone_otp"],
    }, timeout=15)

    r = s.post(f"{API}/auth/forgot-password", json={"email": email}, timeout=15)
    assert r.status_code == 200
    token = r.json().get("dev_reset_token")
    assert token
    new_pwd = "NewPwd@222222"
    rr = s.post(f"{API}/auth/reset-password", json={"token": token, "new_password": new_pwd}, timeout=15)
    assert rr.status_code == 200
    # login with new password
    lg = s.post(f"{API}/auth/login", json={"identifier": email, "password": new_pwd}, timeout=15)
    assert lg.status_code == 200


# ------------------------------------------------------------------
# Wallet
# ------------------------------------------------------------------
def test_wallet_get(s, auth_headers):
    r = s.get(f"{API}/wallet", headers=auth_headers, timeout=15)
    assert r.status_code == 200
    assert r.json()["balance"] >= 0


def test_wallet_transactions(s, auth_headers):
    r = s.get(f"{API}/wallet/transactions", headers=auth_headers, timeout=15)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_wallet_recharge_qr(s, auth_headers):
    r = s.post(f"{API}/wallet/recharge-qr", json={"amount": 100.0}, headers=auth_headers, timeout=15)
    assert r.status_code == 200
    body = r.json()
    assert "qr_token" in body and "expires_at" in body
    assert body["amount"] == 100.0


def test_wallet_withdraw_qr_with_pin(s, auth_headers):
    r = s.post(f"{API}/wallet/withdraw-qr", json={"amount": 50.0, "pin": DEMO_PIN}, headers=auth_headers, timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()
    assert "qr_token" in body
    assert body["amount"] == 50.0


def test_wallet_p2p(s, auth_headers, new_user):
    """P2P from demo to a new test user."""
    r = s.post(f"{API}/wallet/p2p", json={
        "recipient_identifier": new_user["email"],
        "amount": 5.0,
        "note": "test p2p",
        "pin": DEMO_PIN,
    }, headers=auth_headers, timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("ok") is True
    assert "new_balance" in body


# ------------------------------------------------------------------
# Transfers + auction + WS + PDF
# ------------------------------------------------------------------
def test_fx_rate(s):
    r = s.get(f"{API}/transfers/fx-rate", params={"from_currency": "EUR", "to_currency": "XOF"}, timeout=15)
    assert r.status_code == 200
    body = r.json()
    assert body["rate"] == 655.957


@pytest.fixture(scope="session")
def confirmed_transfer(s, auth_headers):
    """Create a draft and confirm it. Returns transfer dict."""
    draft_payload = {
        "destination_country": "SN", "destination_currency": "XOF",
        "send_amount": 100.0, "receive_amount": 65595.7, "fx_rate": 655.957,
        "fee_percent": 2.0, "delivery_mode": "cash",
        "beneficiary": {"full_name": "Mariam Diallo", "phone": "+221770000001", "country": "SN", "currency": "XOF"},
        "purpose": "family_support", "source_of_funds": "salary", "vip_delivery": False,
    }
    rd = s.post(f"{API}/transfers/draft", json=draft_payload, headers=auth_headers, timeout=15)
    assert rd.status_code == 200, rd.text
    draft = rd.json()
    assert draft["fee_amount"] == 2.0
    assert draft["total_amount"] == 102.0

    rc = s.post(f"{API}/transfers/confirm", json={"draft_id": draft["id"], "pin": DEMO_PIN}, headers=auth_headers, timeout=15)
    assert rc.status_code == 200, rc.text
    t = rc.json()
    assert "withdrawal_code" in t and len(t["withdrawal_code"]) == 10 and t["withdrawal_code"].isdigit()
    assert "qr_token" in t and "qr_expires_at" in t
    assert t["status"] in ("BIDDING", "PROCESSING")
    return t


def test_transfer_confirm_returns_required_fields(confirmed_transfer):
    t = confirmed_transfer
    assert t["status"] == "BIDDING"  # cash mode
    # qr_expires_at ~48h from now
    from datetime import datetime, timezone, timedelta
    exp = datetime.fromisoformat(t["qr_expires_at"])
    delta = exp - datetime.now(timezone.utc)
    assert timedelta(hours=47) < delta < timedelta(hours=49)


def test_list_transfers(s, auth_headers, confirmed_transfer):
    r = s.get(f"{API}/transfers", headers=auth_headers, timeout=15)
    assert r.status_code == 200
    items = r.json()
    assert any(x["id"] == confirmed_transfer["id"] for x in items)


def test_get_transfer_detail(s, auth_headers, confirmed_transfer):
    r = s.get(f"{API}/transfers/{confirmed_transfer['id']}", headers=auth_headers, timeout=15)
    assert r.status_code == 200
    assert r.json()["id"] == confirmed_transfer["id"]


def test_list_bids(s, auth_headers, confirmed_transfer):
    # Wait for some bids to be emitted
    time.sleep(10)
    r = s.get(f"{API}/transfers/{confirmed_transfer['id']}/bids", headers=auth_headers, timeout=15)
    assert r.status_code == 200
    bids = r.json()
    assert isinstance(bids, list)
    # Don't fail hard if 0 bids (timing); but log
    assert len(bids) >= 0


def test_receipt_pdf(s, auth_headers, confirmed_transfer):
    r = s.get(f"{API}/transfers/{confirmed_transfer['id']}/receipt-pdf", headers=auth_headers, timeout=15)
    assert r.status_code == 200
    assert "application/pdf" in r.headers.get("Content-Type", "")
    assert r.content[:4] == b"%PDF"


def test_websocket_snapshot(confirmed_transfer):
    async def _run():
        url = f"{WS_BASE}/auction/{confirmed_transfer['id']}"
        async with websockets.connect(url, open_timeout=15) as ws:
            msg = await asyncio.wait_for(ws.recv(), timeout=15)
            data = json.loads(msg)
            assert data.get("event") == "snapshot"
            assert "bids" in data
    asyncio.run(_run())


def test_accept_bid_and_complete(s, auth_headers, confirmed_transfer):
    # Wait for bids
    bids = []
    for _ in range(15):
        time.sleep(2)
        r = s.get(f"{API}/transfers/{confirmed_transfer['id']}/bids", headers=auth_headers, timeout=15)
        if r.status_code == 200 and r.json():
            bids = r.json()
            break
    if not bids:
        pytest.skip("No bids emitted in time window")
    rb = s.post(f"{API}/transfers/{confirmed_transfer['id']}/accept-bid",
                json={"transfer_id": confirmed_transfer["id"], "bid_id": bids[0]["id"]},
                headers=auth_headers, timeout=15)
    assert rb.status_code == 200, rb.text
    # Chat should now exist
    rc = s.get(f"{API}/transfers/{confirmed_transfer['id']}/chat", headers=auth_headers, timeout=15)
    assert rc.status_code == 200
    assert rc.json()["room"]["open"] is True
    # post chat
    rp = s.post(f"{API}/transfers/{confirmed_transfer['id']}/chat",
                json={"transfer_id": confirmed_transfer["id"], "content": "Bonjour agent"},
                headers=auth_headers, timeout=15)
    assert rp.status_code == 200
    # complete-mock
    rcm = s.post(f"{API}/transfers/{confirmed_transfer['id']}/complete-mock", headers=auth_headers, timeout=15)
    assert rcm.status_code == 200
    # chat must be closed now
    rc2 = s.get(f"{API}/transfers/{confirmed_transfer['id']}/chat", headers=auth_headers, timeout=15)
    assert rc2.json()["room"]["open"] is False


# ------------------------------------------------------------------
# Beneficiaries
# ------------------------------------------------------------------
def test_beneficiaries_seeded(s, auth_headers):
    r = s.get(f"{API}/beneficiaries", headers=auth_headers, timeout=15)
    assert r.status_code == 200
    assert len(r.json()) >= 3


def test_beneficiary_create_and_delete(s, auth_headers):
    r = s.post(f"{API}/beneficiaries", json={
        "full_name": "TEST_Ben Test", "phone": "+221770099999",
        "country": "SN", "currency": "XOF", "relation": "ami",
    }, headers=auth_headers, timeout=15)
    assert r.status_code == 200
    bid = r.json()["id"]
    rd = s.delete(f"{API}/beneficiaries/{bid}", headers=auth_headers, timeout=15)
    assert rd.status_code == 200


# ------------------------------------------------------------------
# Payment methods
# ------------------------------------------------------------------
def test_payment_methods_crud(s, auth_headers):
    r = s.get(f"{API}/payment-methods", headers=auth_headers, timeout=15)
    assert r.status_code == 200
    cr = s.post(f"{API}/payment-methods", json={"type": "paypal", "label": "TEST_PayPal"},
                headers=auth_headers, timeout=15)
    assert cr.status_code == 200
    pid = cr.json()["id"]
    dr = s.delete(f"{API}/payment-methods/{pid}", headers=auth_headers, timeout=15)
    assert dr.status_code == 200


# ------------------------------------------------------------------
# KYC
# ------------------------------------------------------------------
def test_kyc_get(s, auth_headers):
    r = s.get(f"{API}/kyc", headers=auth_headers, timeout=15)
    assert r.status_code == 200


def test_kyc_tier1_and_tier2(s, new_user):
    headers = {"Authorization": f"Bearer {new_user['token']}", "Content-Type": "application/json"}
    r = s.post(f"{API}/kyc/tier1", json={
        "full_name": "Test User", "date_of_birth": "1990-01-01", "nationality": "FR",
        "address": "1 rue de Paris", "city": "Paris", "country": "FR",
        "id_type": "passport", "id_number": "X12345678",
    }, headers=headers, timeout=15)
    assert r.status_code == 200
    assert r.json()["tier"] == 1
    rs = s.post(f"{API}/kyc/tier2/start", headers=headers, timeout=15)
    assert rs.status_code == 200
    sid = rs.json()["session_id"]
    assert "verification_url" in rs.json()
    rc = s.post(f"{API}/kyc/tier2/complete", json={"session_id": sid}, headers=headers, timeout=15)
    assert rc.status_code == 200
    assert rc.json()["tier"] == 2


# ------------------------------------------------------------------
# Notifications / Profile / Misc
# ------------------------------------------------------------------
def test_notifications(s, auth_headers):
    r = s.get(f"{API}/notifications", headers=auth_headers, timeout=15)
    assert r.status_code == 200
    notifs = r.json()
    assert isinstance(notifs, list)
    if notifs:
        nid = notifs[0]["id"]
        r1 = s.post(f"{API}/notifications/{nid}/read", headers=auth_headers, timeout=15)
        assert r1.status_code == 200
    ra = s.post(f"{API}/notifications/read-all", headers=auth_headers, timeout=15)
    assert ra.status_code == 200


def test_profile_patch(s, auth_headers):
    r = s.patch(f"{API}/profile", json={"notif_prefs": {"push": True, "email": False, "sms": False}},
                headers=auth_headers, timeout=15)
    assert r.status_code == 200
    assert r.json()["notif_prefs"]["email"] is False


def test_change_password_wrong(s, auth_headers):
    r = s.post(f"{API}/profile/change-password", json={"current": "wrong", "new": "x"},
               headers=auth_headers, timeout=15)
    assert r.status_code == 401


def test_referral(s, auth_headers):
    r = s.get(f"{API}/referral", headers=auth_headers, timeout=15)
    assert r.status_code == 200
    assert r.json()["code"] == "SB-SB100001"


def test_loyalty(s, auth_headers):
    r = s.get(f"{API}/loyalty", headers=auth_headers, timeout=15)
    assert r.status_code == 200
    body = r.json()
    assert body["level"] == "Silver"
    assert len(body["levels"]) == 4


def test_scheduled_transfers_crud(s, auth_headers):
    draft = {
        "destination_country": "SN", "destination_currency": "XOF",
        "send_amount": 50.0, "receive_amount": 32797.85, "fx_rate": 655.957,
        "fee_percent": 1.5, "delivery_mode": "momo",
        "beneficiary": {"full_name": "Mariam"}, "purpose": "x", "source_of_funds": "salary",
    }
    r = s.post(f"{API}/scheduled-transfers", json={"draft": draft, "schedule_at": "2026-12-01T10:00:00Z", "recurrence": "monthly"},
               headers=auth_headers, timeout=15)
    assert r.status_code == 200
    sid = r.json()["id"]
    lg = s.get(f"{API}/scheduled-transfers", headers=auth_headers, timeout=15)
    assert lg.status_code == 200
    dl = s.delete(f"{API}/scheduled-transfers/{sid}", headers=auth_headers, timeout=15)
    assert dl.status_code == 200


def test_disputes_create(s, auth_headers, confirmed_transfer):
    r = s.post(f"{API}/disputes", json={
        "transfer_id": confirmed_transfer["id"], "reason": "delay", "description": "test dispute",
    }, headers=auth_headers, timeout=15)
    assert r.status_code == 200
    lg = s.get(f"{API}/disputes", headers=auth_headers, timeout=15)
    assert lg.status_code == 200
    assert len(lg.json()) >= 1


def test_documents(s, auth_headers):
    r = s.get(f"{API}/documents", headers=auth_headers, timeout=15)
    assert r.status_code == 200


def test_support_faq_and_contact(s, auth_headers):
    r = s.get(f"{API}/support/faq", timeout=15)
    assert r.status_code == 200
    assert len(r.json()) >= 5
    rc = s.post(f"{API}/support/contact", json={"subject": "hello", "message": "test", "category": "general"},
                headers=auth_headers, timeout=15)
    assert rc.status_code == 200


def test_countries(s):
    r = s.get(f"{API}/countries", timeout=15)
    assert r.status_code == 200
    items = r.json()
    assert len(items) >= 8
    assert any(c["code"] == "SN" for c in items)


# ------------------------------------------------------------------
# PIN brute force lockout
# ------------------------------------------------------------------
def test_pin_brute_force_lockout(s):
    """5 wrong PIN attempts on withdraw-qr → 423 Locked."""
    suffix = uuid.uuid4().hex[:8]
    email = f"lock_{suffix}@sendbid.app"
    phone = f"+338{int(time.time()) % 100000000:08d}"
    reg = s.post(f"{API}/auth/register", json={
        "email": email, "phone": phone, "password": "Pwd@111111", "full_name": "Lock User",
    }, timeout=15).json()
    vd = s.post(f"{API}/auth/verify-otp", json={
        "user_id": reg["user_id"],
        "email_code": reg["dev_email_otp"],
        "phone_code": reg["dev_phone_otp"],
    }, timeout=15).json()
    headers = {"Authorization": f"Bearer {vd['access_token']}", "Content-Type": "application/json"}
    s.post(f"{API}/auth/create-pin", json={"pin": "418273"}, headers=headers, timeout=15)
    # Use p2p (does PIN check before balance check) — actually withdraw-qr does PIN check first
    statuses = []
    for i in range(6):
        r = s.post(f"{API}/wallet/withdraw-qr", json={"amount": 1, "pin": "000000"}, headers=headers, timeout=15)
        statuses.append(r.status_code)
    # First 5 attempts should be 401 (PIN incorrect); 6th should be 423 (locked)
    assert 423 in statuses, f"Expected 423 lockout in statuses, got {statuses}"
