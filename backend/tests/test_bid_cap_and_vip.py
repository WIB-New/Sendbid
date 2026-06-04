"""Test P0 backend changes:
1. Bid cap: agent bid_fee_percent must be < client fee_percent.
2. TransferDraftIn vip_fee_amount field - total computation.
3. Confirm flow still works with new total.
"""
import os
import pytest
import requests
import time

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://paybid-preview.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

CLIENT_EMAIL = "client@sendbid.app"
CLIENT_PASSWORD = "Client@123!"
CLIENT_PIN = "123456"

ADMIN_EMAIL = "admin@sendbid.app"
ADMIN_PASSWORD = "Admin@123!"


@pytest.fixture(scope="module")
def client_token():
    r = requests.post(f"{API}/auth/login", json={"identifier": CLIENT_EMAIL, "password": CLIENT_PASSWORD})
    if r.status_code != 200:
        # Fallback alternate payload keys
        r = requests.post(f"{API}/auth/login", json={"email": CLIENT_EMAIL, "password": CLIENT_PASSWORD})
    assert r.status_code == 200, f"client login failed: {r.status_code} {r.text[:300]}"
    data = r.json()
    token = data.get("token") or data.get("access_token")
    assert token, f"no token in response: {data}"
    return token


def auth_headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def _make_draft(token, send_amount=100.0, fee_percent=2.0, vip_fee_amount=0.0, vip_express=False, vip_delivery=False, delivery_mode="cash"):
    payload = {
        "destination_country": "SN",
        "destination_currency": "XOF",
        "send_amount": send_amount,
        "receive_amount": round(send_amount * 655.957, 2),
        "fx_rate": 655.957,
        "fee_percent": fee_percent,
        "delivery_mode": delivery_mode,
        "beneficiary": {"full_name": "TEST Beneficiary", "phone": "+221700000000", "city": "Dakar", "country": "SN"},
        "delivery_details": {},
        "purpose": "family",
        "source_of_funds": "salary",
        "vip_delivery": vip_delivery,
        "vip_express": vip_express,
        "vip_fee_amount": vip_fee_amount,
    }
    r = requests.post(f"{API}/transfers/draft", json=payload, headers=auth_headers(token))
    return r


# ===== VIP FEE AMOUNT (TransferDraftIn) =====
class TestVipFeeAmount:
    def test_draft_no_vip_backcompat(self, client_token):
        """Payload SANS vip_fee_amount should still work (default = 0)."""
        payload = {
            "destination_country": "SN",
            "destination_currency": "XOF",
            "send_amount": 100.0,
            "receive_amount": 65595.7,
            "fx_rate": 655.957,
            "fee_percent": 2.0,
            "delivery_mode": "cash",
            "beneficiary": {"full_name": "TEST BC", "phone": "+221700000001", "city": "Dakar", "country": "SN"},
            "purpose": "family",
            "source_of_funds": "salary",
        }
        r = requests.post(f"{API}/transfers/draft", json=payload, headers=auth_headers(client_token))
        assert r.status_code == 200, f"draft backcompat failed: {r.status_code} {r.text[:300]}"
        data = r.json()
        assert data["fee_amount"] == 2.0
        assert data.get("vip_fee_amount", 0) == 0
        assert data["total_amount"] == 102.0

    def test_draft_vip_100_eur(self, client_token):
        """100€ + fee 2% + VIP 15€ = 117€"""
        r = _make_draft(client_token, 100.0, 2.0, 15.0, vip_delivery=True)
        assert r.status_code == 200, f"{r.status_code} {r.text[:300]}"
        d = r.json()
        assert d["fee_amount"] == 2.0
        assert d["vip_fee_amount"] == 15.0
        assert d["total_amount"] == 117.0, f"expected 117 got {d['total_amount']}"

    def test_draft_vip_plus_100_eur(self, client_token):
        """100€ + fee 2% + VIP+ 20€ = 122€"""
        r = _make_draft(client_token, 100.0, 2.0, 20.0, vip_express=True, vip_delivery=True)
        assert r.status_code == 200, f"{r.status_code} {r.text[:300]}"
        d = r.json()
        assert d["fee_amount"] == 2.0
        assert d["vip_fee_amount"] == 20.0
        assert d["total_amount"] == 122.0

    def test_draft_vip_plus_1000_eur(self, client_token):
        """1000€ + fee 2% (=20) + VIP+ 20€ = 1040€"""
        r = _make_draft(client_token, 1000.0, 2.0, 20.0, vip_express=True, vip_delivery=True)
        assert r.status_code == 200, f"{r.status_code} {r.text[:300]}"
        d = r.json()
        assert d["fee_amount"] == 20.0
        assert d["vip_fee_amount"] == 20.0
        assert d["total_amount"] == 1040.0


# ===== CONFIRM FLOW =====
class TestConfirmFlow:
    def test_confirm_with_vip_total(self, client_token):
        """Create VIP draft and confirm with PIN -> success."""
        r = _make_draft(client_token, 50.0, 2.0, 15.0, vip_delivery=True, delivery_mode="bank")
        assert r.status_code == 200, r.text[:300]
        draft = r.json()
        assert draft["total_amount"] == 66.0  # 50 + 1 + 15
        confirm = requests.post(
            f"{API}/transfers/confirm",
            json={"draft_id": draft["id"], "pin": CLIENT_PIN},
            headers=auth_headers(client_token),
        )
        # Either 200 (success) or 400 if balance insufficient — accept those.
        assert confirm.status_code in (200, 400), f"unexpected: {confirm.status_code} {confirm.text[:300]}"
        if confirm.status_code == 400:
            assert "Solde" in confirm.text or "insuffisant" in confirm.text.lower()
        else:
            data = confirm.json()
            assert "id" in data
            assert data["total_amount"] == 66.0


# ===== BID CAP (PAYBID Agent) =====
class TestAgentBidCap:
    """Try to find an active BIDDING transfer and check bid > fee_percent is rejected.
    Without an agent token, we test that the endpoint exists and validate signature works.
    """

    def test_bid_endpoint_requires_auth(self):
        r = requests.post(f"{API}/agent/auctions/fake-id/bid", json={"transfer_id": "fake", "bid_fee_percent": 3.0})
        # 401 (no token) or 403 not agent
        assert r.status_code in (401, 403, 422), f"{r.status_code} {r.text[:200]}"

    def test_create_bidding_transfer_for_bid_cap(self, client_token):
        """Create a cash transfer to spawn an auction. Then call bid endpoint as agent.
        We need an agent account. Let's try seed agent."""
        # Create draft + confirm to put it in BIDDING
        r = _make_draft(client_token, 30.0, 2.0, 0.0, delivery_mode="cash")
        assert r.status_code == 200, r.text[:300]
        draft = r.json()
        c = requests.post(
            f"{API}/transfers/confirm",
            json={"draft_id": draft["id"], "pin": CLIENT_PIN},
            headers=auth_headers(client_token),
        )
        if c.status_code != 200:
            pytest.skip(f"Could not confirm transfer (balance?): {c.status_code} {c.text[:200]}")
        transfer = c.json()
        transfer_id = transfer["id"]
        fee_pct = transfer["fee_percent"]
        assert fee_pct == 2.0

        # Try login as an agent (seed). Common agent emails
        agent_token = None
        for email, pwd in [("agent@paybid.app", "Agent@123!"), ("agent@sendbid.app", "Agent@123!")]:
            lr = requests.post(f"{API}/auth/login", json={"identifier": email, "password": pwd})
            if lr.status_code == 200:
                agent_token = lr.json().get("token") or lr.json().get("access_token")
                if agent_token:
                    break
        if not agent_token:
            pytest.skip("No agent seed account available to test bid cap")

        # Wait for transfer to be BIDDING
        time.sleep(2)
        # Try bid 3.0% > 2.0% -> must be rejected
        bid_high = requests.post(
            f"{API}/agent/auctions/{transfer_id}/bid",
            json={"transfer_id": transfer_id, "bid_fee_percent": 3.0, "eta_minutes": 30},
            headers=auth_headers(agent_token),
        )
        # Bid endpoint should reject (400) with message about strictly inférieure
        if bid_high.status_code == 403:
            pytest.skip(f"agent country mismatch: {bid_high.text[:200]}")
        assert bid_high.status_code == 400, f"bid 3.0% should be rejected with 400; got {bid_high.status_code}: {bid_high.text[:300]}"
        assert "inférieure" in bid_high.text or "inferieure" in bid_high.text.lower(), f"missing expected error msg: {bid_high.text[:200]}"

        # Try bid equal to client fee — must also be rejected (strictly inferior)
        bid_eq = requests.post(
            f"{API}/agent/auctions/{transfer_id}/bid",
            json={"transfer_id": transfer_id, "bid_fee_percent": 2.0, "eta_minutes": 30},
            headers=auth_headers(agent_token),
        )
        assert bid_eq.status_code == 400, f"bid 2.0% (=client fee) should be rejected; got {bid_eq.status_code}: {bid_eq.text[:300]}"

        # Try valid bid 1.5% — should pass (or race with simulated auction)
        bid_ok = requests.post(
            f"{API}/agent/auctions/{transfer_id}/bid",
            json={"transfer_id": transfer_id, "bid_fee_percent": 1.5, "eta_minutes": 30},
            headers=auth_headers(agent_token),
        )
        # 200 ok, OR 400 if simulated auction already placed a lower bid (descending only),
        # OR 409 if auction completed.
        assert bid_ok.status_code in (200, 400, 409), f"unexpected: {bid_ok.status_code} {bid_ok.text[:300]}"
