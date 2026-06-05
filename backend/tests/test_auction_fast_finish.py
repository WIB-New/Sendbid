"""
SENDBID — Test FAST-FINISH new auction logic in /app/backend/routers/transfers.py

Spec:
- Each round lasts up to 30s.
- FAST-FINISH: if all pool agents responded AND at least 1 valid bid (bid_fee_percent <= client_fee_pct)
  → broadcast `round_ended_early` and proceed to selection immediately.
- Backward-compat: `agent_assigned` should still arrive after `round_ended_early`.
- Bid cap regression: POST /api/agent/auctions/{id}/bid must reject bid >= client_fee_pct (HTTP 400).
"""
import asyncio
import json
import os
import time

import pytest
import requests
import websockets

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://paybid-preview.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
WS_BASE = BASE_URL.replace("https://", "wss://").replace("http://", "ws://")

CLIENT_EMAIL = "client@sendbid.app"
CLIENT_PASSWORD = "Client@123!"
CLIENT_PIN = "123456"


def _login_client():
    r = requests.post(f"{API}/auth/login",
                      json={"identifier": CLIENT_EMAIL, "password": CLIENT_PASSWORD},
                      timeout=20)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text[:300]}"
    token = r.json().get("token") or r.json().get("access_token")
    assert token
    return token


def _auth(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def _topup_wallet_if_needed(token, min_balance=200.0):
    """Ensure wallet has enough balance for several cash drafts."""
    r = requests.get(f"{API}/wallet", headers=_auth(token), timeout=20)
    if r.status_code != 200:
        return
    bal = float(r.json().get("balance", 0))
    if bal >= min_balance:
        return
    # Try topup endpoint (best-effort, ignore if not present)
    for ep, payload in [
        (f"{API}/wallet/topup", {"amount": 500.0, "method": "card"}),
        (f"{API}/wallet/deposit", {"amount": 500.0}),
    ]:
        try:
            tr = requests.post(ep, json=payload, headers=_auth(token), timeout=10)
            if tr.status_code in (200, 201):
                return
        except Exception:
            pass


def _make_cm_cash_draft(token, send_amount=40.0, fee_percent=2.5):
    payload = {
        "destination_country": "CM",
        "destination_currency": "XAF",
        "send_amount": send_amount,
        "receive_amount": round(send_amount * 655.957, 2),
        "fx_rate": 655.957,
        "fee_percent": fee_percent,
        "delivery_mode": "cash",
        "beneficiary": {"full_name": "TEST Beneficiary CM",
                        "phone": "+237699000000",
                        "city": "Douala", "country": "CM"},
        "delivery_details": {},
        "purpose": "family",
        "source_of_funds": "salary",
        "vip_delivery": False,
        "vip_express": False,
        "vip_fee_amount": 0.0,
    }
    r = requests.post(f"{API}/transfers/draft", json=payload,
                      headers=_auth(token), timeout=20)
    assert r.status_code == 200, f"draft failed: {r.status_code} {r.text[:300]}"
    return r.json()


def _confirm(token, draft_id):
    r = requests.post(f"{API}/transfers/confirm",
                      json={"draft_id": draft_id, "pin": CLIENT_PIN},
                      headers=_auth(token), timeout=20)
    return r


# ====================================================================
# 1. FAST-FINISH
# ====================================================================
class TestFastFinish:
    """Confirm a CM cash transfer and verify auction ends in < 30s."""

    @pytest.fixture(scope="class")
    def token(self):
        return _login_client()

    def test_fast_finish_triggered(self, token):
        _topup_wallet_if_needed(token)
        draft = _make_cm_cash_draft(token, send_amount=40.0, fee_percent=2.5)

        # We cannot open the WS before the transfer exists, but `start_auction` runs
        # in a background asyncio task. The `round_started` broadcast happens AT THE
        # VERY BEGINNING of run_auction, so we may or may not catch it.
        # Therefore we use `round_ended_early.elapsed_sec` (server-computed) as the
        # canonical proof of how long the round took before fast-finish kicked in.
        confirm = _confirm(token, draft["id"])
        if confirm.status_code != 200:
            pytest.skip(f"Could not confirm (wallet?): {confirm.status_code} {confirm.text[:200]}")
        transfer = confirm.json()
        transfer_id = transfer["id"]
        assert transfer["status"] == "BIDDING"

        ws_url = f"{WS_BASE}/api/ws/auction/{transfer_id}?token={token}"
        events = []
        timings = {}

        async def listen():
            try:
                async with websockets.connect(ws_url, open_timeout=10) as ws:
                    t_open = time.monotonic()
                    timings["ws_open"] = t_open
                    end_t = t_open + 45
                    while time.monotonic() < end_t:
                        try:
                            raw = await asyncio.wait_for(ws.recv(), timeout=end_t - time.monotonic())
                        except asyncio.TimeoutError:
                            break
                        try:
                            msg = json.loads(raw)
                        except Exception:
                            continue
                        ev = msg.get("event")
                        ts = time.monotonic()
                        events.append((ts, msg))
                        if ev == "round_started" and "round_started" not in timings:
                            timings["round_started"] = ts
                        elif ev == "round_ended_early" and "round_ended_early" not in timings:
                            timings["round_ended_early"] = ts
                            timings["round_ended_early_payload"] = msg
                        elif ev in ("agent_assigned", "auction_absorbed", "auction_expired"):
                            timings[ev] = ts
                            if ev == "agent_assigned":
                                timings["agent_assigned_payload"] = msg
                            return
            except Exception as e:
                timings["error"] = str(e)

        asyncio.run(listen())

        print(f"\n[fast-finish] captured {len(events)} events:")
        for ts, m in events:
            print(f"  +{ts - timings.get('ws_open', ts):.2f}s  {m.get('event')}  payload={ {k:v for k,v in m.items() if k!='bid' and k!='agent'} }")

        # --- Core assertions: fast-finish must trigger ---
        assert "round_ended_early" in timings, (
            f"round_ended_early event missing; fast-finish broadcast not emitted. "
            f"events={[m.get('event') for _, m in events]}"
        )
        rpayload = timings["round_ended_early_payload"]
        assert rpayload.get("reason") in ("all_agents_responded", "satisfactory_offer_received"), \
            f"unexpected reason: {rpayload}"
        assert rpayload.get("valid_bids", 0) >= 1, f"valid_bids should be >=1: {rpayload}"
        assert rpayload.get("round") == 1
        # Server-side elapsed_sec proves the round did NOT wait the full 30s
        elapsed_sec = float(rpayload.get("elapsed_sec", 99))
        print(f"[fast-finish] server elapsed_sec = {elapsed_sec:.2f}s (must be < 30)")
        assert elapsed_sec < 30, f"elapsed_sec {elapsed_sec} >= 30s — fast-finish NOT applied"

        # agent_assigned must arrive AFTER round_ended_early (backward-compat)
        assert "agent_assigned" in timings, (
            f"No agent_assigned in 45s. events={[m.get('event') for _, m in events]}"
        )
        assert timings["round_ended_early"] <= timings["agent_assigned"], \
            "agent_assigned arrived before round_ended_early (ordering broken)"

        # The selected bid must respect the client cap (≤ client_fee_pct=2.5)
        selected = timings["agent_assigned_payload"].get("bid") or {}
        assert float(selected.get("bid_fee_percent", 99)) <= 2.5, \
            f"selected bid {selected.get('bid_fee_percent')} > cap 2.5"

    def test_selected_bid_respects_cap(self, token):
        """The selected bid_fee_percent must be <= client_fee_pct."""
        _topup_wallet_if_needed(token)
        draft = _make_cm_cash_draft(token, send_amount=35.0, fee_percent=2.5)
        confirm = _confirm(token, draft["id"])
        if confirm.status_code != 200:
            pytest.skip("balance issue")
        transfer_id = confirm.json()["id"]
        client_fee_pct = 2.5

        # Poll for agent assignment for up to 35s
        end = time.time() + 35
        assigned = None
        while time.time() < end:
            r = requests.get(f"{API}/transfers/{transfer_id}",
                             headers=_auth(token), timeout=10)
            if r.status_code == 200 and r.json().get("agent_id"):
                assigned = r.json()
                break
            time.sleep(1.5)
        assert assigned, "no agent assigned in 35s"
        bid = assigned.get("selected_bid") or {}
        assert bid.get("bid_fee_percent", 99) <= client_fee_pct, \
            f"selected bid {bid.get('bid_fee_percent')} > client cap {client_fee_pct}"


# ====================================================================
# 2. BID CAP REGRESSION (agent.py)
# ====================================================================
class TestBidCapRegression:
    """POST /api/agent/auctions/{id}/bid must reject bid >= client_fee_pct."""

    def test_endpoint_requires_auth(self):
        r = requests.post(f"{API}/agent/auctions/fake/bid",
                          json={"transfer_id": "fake", "bid_fee_percent": 3.0},
                          timeout=10)
        assert r.status_code in (401, 403, 422), f"{r.status_code} {r.text[:200]}"

    def test_bid_above_cap_rejected(self):
        """End-to-end: confirm a CM transfer, then try to over-bid."""
        token = _login_client()
        _topup_wallet_if_needed(token)
        draft = _make_cm_cash_draft(token, send_amount=30.0, fee_percent=2.0)
        c = _confirm(token, draft["id"])
        if c.status_code != 200:
            pytest.skip(f"could not confirm: {c.status_code} {c.text[:200]}")
        transfer_id = c.json()["id"]

        # Try to login as agent (CM)
        agent_token = None
        for email, pwd in [
            ("patrick.mbarga@paybid.app", "Agent@123!"),
            ("agent@paybid.app", "Agent@123!"),
            ("agent.cm@paybid.app", "Agent@123!"),
        ]:
            lr = requests.post(f"{API}/auth/login",
                               json={"identifier": email, "password": pwd},
                               timeout=10)
            if lr.status_code == 200:
                agent_token = lr.json().get("token") or lr.json().get("access_token")
                break
        if not agent_token:
            pytest.skip("no agent account available to test bid cap (CM)")

        time.sleep(1)
        # Bid 3.0% > 2.0% must be rejected with 400
        r = requests.post(
            f"{API}/agent/auctions/{transfer_id}/bid",
            json={"transfer_id": transfer_id, "bid_fee_percent": 3.0, "eta_minutes": 30},
            headers=_auth(agent_token), timeout=10,
        )
        if r.status_code == 403:
            pytest.skip(f"agent country mismatch: {r.text[:200]}")
        if r.status_code == 409:
            pytest.skip("auction already closed by fast-finish")
        assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text[:300]}"

        # Bid equal to cap must also be rejected (strictly inferior)
        r2 = requests.post(
            f"{API}/agent/auctions/{transfer_id}/bid",
            json={"transfer_id": transfer_id, "bid_fee_percent": 2.0, "eta_minutes": 30},
            headers=_auth(agent_token), timeout=10,
        )
        if r2.status_code not in (400, 409):
            pytest.fail(f"expected 400 or 409, got {r2.status_code}: {r2.text[:300]}")
