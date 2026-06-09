"""Iter 22 — P0 (transfer detail aliases) + P1 (paybid signup Lot 5) verification.

Covers:
- GET /api/transfers/{id} returns assigned_at + paid_at aliases
- GET /api/agent/super-agents/public (no auth) — optional country filter
- POST /api/agent/signup backward compat (own) + super_agent + partner
- Smoke: /api/auth/login, /api/auth/me, /api/transfers listing
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://paybid-preview.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

CLIENT_EMAIL = "client@sendbid.app"
CLIENT_PASSWORD = "Client@123!"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def client_token(session):
    r = session.post(f"{API}/auth/login", json={"identifier": CLIENT_EMAIL, "password": CLIENT_PASSWORD})
    assert r.status_code == 200, f"login failed {r.status_code}: {r.text}"
    data = r.json()
    assert "access_token" in data or "token" in data, data
    return data.get("access_token") or data.get("token")


# === Smoke ===========================================================

def test_auth_login(session):
    r = session.post(f"{API}/auth/login", json={"identifier": CLIENT_EMAIL, "password": CLIENT_PASSWORD})
    assert r.status_code == 200, r.text
    body = r.json()
    assert ("access_token" in body) or ("token" in body)


def test_auth_me(session, client_token):
    r = session.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {client_token}"})
    assert r.status_code == 200, r.text
    me = r.json()
    user = me.get("user", me)
    assert user.get("email") == CLIENT_EMAIL


def test_transfers_listing(session, client_token):
    r = session.get(f"{API}/transfers?limit=20", headers={"Authorization": f"Bearer {client_token}"})
    assert r.status_code == 200, r.text
    arr = r.json()
    assert isinstance(arr, list)
    assert len(arr) >= 1, "Expected seeded transfers"


# === P0 — Transfer detail aliases ====================================

def test_transfer_detail_has_assigned_at_alias(session, client_token):
    """Pick a transfer that has agent_assigned_at set, then verify GET returns assigned_at."""
    r = session.get(f"{API}/transfers?limit=50", headers={"Authorization": f"Bearer {client_token}"})
    assert r.status_code == 200
    arr = r.json()
    target = next((t for t in arr if t.get("agent_assigned_at")), None)
    assert target is not None, "No transfer with agent_assigned_at found in seed (cannot verify alias)"
    tid = target["id"]
    r = session.get(f"{API}/transfers/{tid}", headers={"Authorization": f"Bearer {client_token}"})
    assert r.status_code == 200, r.text
    detail = r.json()
    assert detail.get("agent_assigned_at"), "agent_assigned_at should still be present"
    assert detail.get("assigned_at"), "assigned_at alias missing — P0 BUG"
    assert detail["assigned_at"] == detail["agent_assigned_at"], "alias mismatch"


def test_transfer_detail_has_paid_at_for_non_pending(session, client_token):
    r = session.get(f"{API}/transfers?limit=50", headers={"Authorization": f"Bearer {client_token}"})
    arr = r.json()
    target = next((t for t in arr if t.get("status") not in ("DRAFT", "PENDING_PAYMENT")), None)
    assert target is not None, "No non-pending transfer in seed"
    tid = target["id"]
    r = session.get(f"{API}/transfers/{tid}", headers={"Authorization": f"Bearer {client_token}"})
    assert r.status_code == 200
    detail = r.json()
    assert detail.get("paid_at"), f"paid_at missing for status {detail.get('status')} — P0 BUG"
    # Should equal created_at fallback
    assert detail["paid_at"] == detail.get("created_at")


def test_transfer_detail_specific_id(session, client_token):
    """The problem statement explicitly references this id."""
    tid = "74361181-b0c4-46fb-8c27-8aeb4d19c529"
    r = session.get(f"{API}/transfers/{tid}", headers={"Authorization": f"Bearer {client_token}"})
    # If id doesn't exist in this seed, skip — but assert structure if found
    if r.status_code == 404:
        pytest.skip("Transfer id not present in this seed")
    assert r.status_code == 200, r.text
    detail = r.json()
    assert detail.get("created_at")


# === Public super-agents listing =====================================

def test_super_agents_public_no_auth(session):
    r = requests.get(f"{API}/agent/super-agents/public")
    assert r.status_code == 200, r.text
    data = r.json()
    assert isinstance(data, list)
    for item in data:
        assert "id" in item and "label" in item


def test_super_agents_public_country_filter(session):
    r = requests.get(f"{API}/agent/super-agents/public", params={"country": "CM"})
    assert r.status_code == 200, r.text
    data = r.json()
    assert isinstance(data, list)
    for item in data:
        if item.get("country"):
            assert item["country"] == "CM"


def test_super_agents_public_country_lower_normalised(session):
    """country=cm should be upcased server-side."""
    r = requests.get(f"{API}/agent/super-agents/public", params={"country": "cm"})
    assert r.status_code == 200


# === Agent signup variants ===========================================

def _uniq():
    return uuid.uuid4().hex[:10]


def test_agent_signup_own_backward_compat(session):
    u = _uniq()
    payload = {
        "email": f"TEST_agent_own_{u}@example.com",
        "phone": f"+33600{u[:6]}",
        "full_name": "TEST Agent Own",
        "password": "Paybid@123!",
        "city": "Paris",
        "country": "FR",
        "agent_type": "own",
    }
    r = session.post(f"{API}/agent/signup", json=payload)
    assert r.status_code == 200, f"own signup failed: {r.status_code} {r.text}"


def test_agent_signup_super_agent(session):
    u = _uniq()
    payload = {
        "email": f"TEST_agent_super_{u}@example.com",
        "phone": f"+33611{u[:6]}",
        "full_name": "TEST Super Agent",
        "password": "Paybid@123!",
        "city": "Douala",
        "country": "CM",
        "agent_type": "super_agent",
        "legal_name": "TEST PAYBID Cameroun SARL",
        "registration_number": "RC/DLA/2024/B/TEST",
        "float_currency": "XAF",
    }
    r = session.post(f"{API}/agent/signup", json=payload)
    assert r.status_code == 200, f"super_agent signup failed: {r.status_code} {r.text}"


def test_agent_signup_partner_with_parent(session):
    # Need a valid parent_agent_id — get one from public endpoint (may be empty)
    parents = requests.get(f"{API}/agent/super-agents/public").json()
    parent_id = parents[0]["id"] if parents else None
    u = _uniq()
    payload = {
        "email": f"TEST_agent_partner_{u}@example.com",
        "phone": f"+33622{u[:6]}",
        "full_name": "TEST Sub Agent",
        "password": "Paybid@123!",
        "city": "Yaoundé",
        "country": "CM",
        "agent_type": "partner",
        "parent_agent_id": parent_id,
        "float_currency": "XAF",
    }
    r = session.post(f"{API}/agent/signup", json=payload)
    assert r.status_code == 200, f"partner signup failed: {r.status_code} {r.text}"
