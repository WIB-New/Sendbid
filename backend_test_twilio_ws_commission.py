"""
Backend test — Twilio Lookup + WebSocket Agent + Commission breakdown
Tests:
1. POST /api/auth/lookup-phone (public)
2. POST /api/auth/register (Twilio validation)
3. POST /api/agent/auctions/{id}/bid (commission breakdown)
4. WebSocket /api/ws/agent
5. POST /api/auth/resend-otp (Twilio SMS)
6. Regression: /api/wallet/recharge-qr, /api/paypal/order, /api/wallet/withdraw
"""
import asyncio
import json
import time
import uuid
import requests
import websockets

BASE = "https://paybid-preview.preview.emergentagent.com"
API = f"{BASE}/api"
WS_BASE = "wss://paybid-preview.preview.emergentagent.com"

CLIENT_EMAIL = "client@sendbid.app"
CLIENT_PASSWORD = "Client@123!"
CLIENT_PIN = "123456"

AGENT_EMAIL = "agent@paybid.app"
AGENT_PASSWORD = "Agent@123!"
AGENT_PIN = "123456"

results = []


def record(name, ok, detail=""):
    sym = "✅" if ok else "❌"
    print(f"{sym} {name}{' — ' + detail if detail else ''}")
    results.append((name, ok, detail))


def login(email, password):
    r = requests.post(f"{API}/auth/login", json={"identifier": email, "password": password}, timeout=20)
    r.raise_for_status()
    return r.json()["access_token"]


# ============================================================
# 1) /api/auth/lookup-phone
# ============================================================
def test_lookup_phone():
    print("\n=== 1) POST /api/auth/lookup-phone ===")

    # Case A — no phone
    r = requests.post(f"{API}/auth/lookup-phone", json={}, timeout=20)
    j = r.json()
    record("1.A no phone → valid:false",
           r.status_code == 200 and j.get("valid") is False,
           f"status={r.status_code} body={j}")

    # Case B — too short
    r = requests.post(f"{API}/auth/lookup-phone", json={"phone": "123"}, timeout=20)
    j = r.json()
    record("1.B too short → valid:false / invalid",
           r.status_code == 200 and j.get("valid") is False and j.get("line_type") == "invalid",
           f"status={r.status_code} body={j}")

    # Case C — Twilio test number US
    r = requests.post(f"{API}/auth/lookup-phone", json={"phone": "+14155552671"}, timeout=20)
    j = r.json()
    record("1.C US +14155552671 → 200",
           r.status_code == 200,
           f"status={r.status_code} body={j}")
    record("1.C valid:true",
           j.get("valid") is True,
           f"valid={j.get('valid')}")
    record("1.C country=US",
           j.get("country") == "US",
           f"country={j.get('country')}")
    record("1.C carrier_name present",
           j.get("carrier_name") is not None,
           f"carrier_name={j.get('carrier_name')}")
    record("1.C line_type in expected set",
           j.get("line_type") in ("mobile", "landline", "voip", "nonFixedVoip", "non_fixed_voip", "fixedVoip", "fixed_voip", "tollFree", "personal", "unknown"),
           f"line_type={j.get('line_type')}")

    # Case D — FR mobile +33612345678
    r = requests.post(f"{API}/auth/lookup-phone", json={"phone": "+33612345678"}, timeout=20)
    j = r.json()
    record("1.D FR +33612345678 → 200",
           r.status_code == 200,
           f"status={r.status_code} body={j}")
    record("1.D valid:true",
           j.get("valid") is True,
           f"valid={j.get('valid')}")
    record("1.D country=FR",
           j.get("country") == "FR",
           f"country={j.get('country')}")


# ============================================================
# 2) /api/auth/register — Twilio validation
# ============================================================
def test_register():
    print("\n=== 2) POST /api/auth/register ===")

    # Case A — invalid phone +0000
    payload = {
        "email": f"reg_invalid_{int(time.time())}@test.com",
        "phone": "+0000",
        "password": "Pass@1234",
        "full_name": "Bad Phone",
        "country": "FR",
        "city": "Paris",
        "accept_terms": True,
    }
    r = requests.post(f"{API}/auth/register", json=payload, timeout=30)
    detail = ""
    try:
        detail = r.json().get("detail", "")
    except Exception:
        pass
    record("2.A invalid phone → 400",
           r.status_code == 400 and "invalide" in detail.lower(),
           f"status={r.status_code} detail={detail}")

    # Case B — valid phone (use unique FR mobile)
    ts = int(time.time())
    # Pick a French mobile number that should validate. Use a unique suffix.
    phone_valid = f"+3361234{ts % 10000:04d}"  # FR mobile-looking format
    # Better to use real test Twilio number; lookup may say valid:true even for many.
    payload2 = {
        "email": f"reg_ok_{ts}@test.com",
        "phone": phone_valid,
        "password": "Pass@1234",
        "full_name": "Valid User",
        "country": "FR",
        "city": "Paris",
        "accept_terms": True,
    }
    r = requests.post(f"{API}/auth/register", json=payload2, timeout=30)
    j = {}
    try:
        j = r.json()
    except Exception:
        pass
    record("2.B valid FR phone → 200",
           r.status_code == 200 and j.get("user_id"),
           f"status={r.status_code} body_keys={list(j.keys())[:6]}")

    if r.status_code == 200:
        user_id = j["user_id"]
        # check DB via /auth/me with token
        token = j.get("token")
        if token:
            hh = {"Authorization": f"Bearer {token}"}
            r2 = requests.get(f"{API}/auth/me", headers=hh, timeout=20)
            u = r2.json().get("user", {})
            # carrier_name / phone_line_type are set in DB; /auth/me returns clean user
            has_carrier = "carrier_name" in u
            has_line = "phone_line_type" in u
            record("2.B user doc contains carrier_name field",
                   has_carrier,
                   f"carrier_name={u.get('carrier_name')!r}")
            record("2.B user doc contains phone_line_type field",
                   has_line,
                   f"phone_line_type={u.get('phone_line_type')!r}")
        # Cleanup
        # (No delete endpoint — leave it; not pollutant for re-runs because email/phone unique with timestamp)
        return user_id
    return None


# ============================================================
# 3) Commission breakdown on /api/agent/auctions/{id}/bid
# ============================================================
def create_bidding_transfer_to_sn(client_token):
    """Create a fresh cash transfer to SN/Dakar, return transfer_id and fee_percent."""
    hh = {"Authorization": f"Bearer {client_token}"}
    send_amount = 50.0
    fx_rate = 655.957
    draft = {
        "destination_country": "SN",
        "destination_currency": "XOF",
        "send_amount": send_amount,
        "receive_amount": round(send_amount * fx_rate, 2),
        "fx_rate": fx_rate,
        "fee_percent": 2.0,
        "delivery_mode": "cash",
        "vip_delivery": False,
        "beneficiary": {
            "full_name": "Test Bénéficiaire",
            "phone": "+221770000123",
            "city": "Dakar",
        },
        "purpose": "family_support",
        "source_of_funds": "salary",
    }
    r = requests.post(f"{API}/transfers/draft", json=draft, headers=hh, timeout=20)
    if r.status_code != 200:
        print(f"draft fail: {r.status_code} {r.text}")
        return None
    draft_resp = r.json()
    draft_id = draft_resp.get("id")
    confirm = {"draft_id": draft_id, "pin": CLIENT_PIN}
    r = requests.post(f"{API}/transfers/confirm", json=confirm, headers=hh, timeout=20)
    if r.status_code != 200:
        print(f"confirm fail: {r.status_code} {r.text}")
        return None
    conf = r.json()
    return conf.get("id") or conf.get("transfer_id") or conf.get("transfer", {}).get("id")


def test_commission_breakdown():
    print("\n=== 3) POST /api/agent/auctions/{id}/bid — commission breakdown ===")
    client_token = login(CLIENT_EMAIL, CLIENT_PASSWORD)
    agent_token = login(AGENT_EMAIL, AGENT_PASSWORD)

    transfer_id = create_bidding_transfer_to_sn(client_token)
    record("3.0 created BIDDING transfer to SN",
           transfer_id is not None,
           f"transfer_id={transfer_id}")
    if not transfer_id:
        return

    # Need send_amount and fee_percent — fetch the transfer (as client owner)
    hh_c = {"Authorization": f"Bearer {client_token}"}
    r = requests.get(f"{API}/transfers/{transfer_id}", headers=hh_c, timeout=20)
    t = r.json() if r.status_code == 200 else {}
    send_amount = t.get("send_amount", 50)
    fee_max = t.get("fee_percent", 2.0)
    print(f"  transfer send_amount={send_amount} fee_percent={fee_max}")

    # Bid as agent — bid below fee_max
    bid_pct = round(fee_max - 0.1, 2)  # e.g. 1.90 if fee_max=2.0
    if bid_pct >= fee_max:
        bid_pct = fee_max - 0.1
    payload = {"transfer_id": transfer_id, "bid_fee_percent": bid_pct, "eta_minutes": 25}
    hh_a = {"Authorization": f"Bearer {agent_token}"}
    r = requests.post(f"{API}/agent/auctions/{transfer_id}/bid", json=payload, headers=hh_a, timeout=20)
    j = {}
    try:
        j = r.json()
    except Exception:
        pass
    record("3.1 bid 200",
           r.status_code == 200,
           f"status={r.status_code} detail={j.get('detail') if r.status_code != 200 else ''}")
    if r.status_code != 200:
        print(f"  body={j}")
        return

    commission = j.get("commission")
    record("3.2 commission field present",
           commission is not None,
           f"keys={list(j.keys())}")
    if not commission:
        return

    expected_keys = {"client_fee_pct", "client_fee_amount", "company_commission_pct",
                     "company_share", "agent_net", "currency", "message"}
    missing = expected_keys - set(commission.keys())
    record("3.3 commission has all expected keys",
           not missing,
           f"missing={missing} got={list(commission.keys())}")
    record("3.4 company_commission_pct == 20.0",
           commission.get("company_commission_pct") == 20.0,
           f"value={commission.get('company_commission_pct')}")
    record("3.5 currency == EUR",
           commission.get("currency") == "EUR",
           f"value={commission.get('currency')}")

    expected_client_fee = round(send_amount * bid_pct / 100, 2)
    record("3.6 client_fee_amount = send_amount * bid_pct / 100",
           abs(commission.get("client_fee_amount", 0) - expected_client_fee) < 0.01,
           f"got={commission.get('client_fee_amount')} expected={expected_client_fee}")

    expected_agent_net = round(expected_client_fee * 0.8, 2)
    record("3.7 agent_net = client_fee_amount * 0.8 (80%)",
           abs(commission.get("agent_net", 0) - expected_agent_net) < 0.05,
           f"got={commission.get('agent_net')} expected={expected_agent_net}")


# ============================================================
# 4) WebSocket /api/ws/agent
# ============================================================
async def test_ws_agent():
    print("\n=== 4) WebSocket /api/ws/agent ===")

    # 4.A No token → 4401
    try:
        async with websockets.connect(f"{WS_BASE}/api/ws/agent") as ws:
            # If we reach here, server didn't close
            try:
                msg = await asyncio.wait_for(ws.recv(), timeout=3)
                record("4.A no token → close", False, f"unexpected message {msg!r}")
            except websockets.ConnectionClosed as e:
                record("4.A no token → close 4401",
                       e.code == 4401,
                       f"code={e.code}")
            except asyncio.TimeoutError:
                record("4.A no token → close", False, "timeout no close")
    except websockets.exceptions.InvalidStatusCode as e:
        record("4.A no token (invalid status)",
               True,
               f"http rejected status={e.status_code}")
    except websockets.ConnectionClosed as e:
        record("4.A no token → close 4401",
               e.code == 4401,
               f"code={e.code}")
    except Exception as e:
        # Some implementations close immediately on handshake, raising ConnectionClosedError
        record("4.A no token", "4401" in str(e) or "401" in str(e), f"err={type(e).__name__}: {e}")

    # 4.B Client token (role=user) → 4403
    client_token = login(CLIENT_EMAIL, CLIENT_PASSWORD)
    url = f"{WS_BASE}/api/ws/agent?token={client_token}"
    try:
        async with websockets.connect(url) as ws:
            try:
                msg = await asyncio.wait_for(ws.recv(), timeout=3)
                record("4.B client token → close", False, f"unexpected msg {msg!r}")
            except websockets.ConnectionClosed as e:
                record("4.B client token → close 4403",
                       e.code == 4403,
                       f"code={e.code}")
            except asyncio.TimeoutError:
                record("4.B client token", False, "timeout no close")
    except websockets.ConnectionClosed as e:
        record("4.B client token → close 4403",
               e.code == 4403,
               f"code={e.code}")
    except Exception as e:
        record("4.B client token close", "4403" in str(e), f"err={type(e).__name__}: {e}")

    # 4.C Agent token → success, receive agent_connected
    agent_token = login(AGENT_EMAIL, AGENT_PASSWORD)
    url = f"{WS_BASE}/api/ws/agent?token={agent_token}"
    try:
        async with websockets.connect(url) as ws:
            try:
                raw = await asyncio.wait_for(ws.recv(), timeout=5)
                data = json.loads(raw)
                record("4.C agent token connected & received message",
                       True,
                       f"msg={data}")
                record("4.C event=agent_connected",
                       data.get("event") == "agent_connected",
                       f"event={data.get('event')}")
                record("4.C agent_id present",
                       data.get("agent_id") is not None,
                       f"agent_id={data.get('agent_id')}")
                # Stay connected briefly to verify no immediate close
                await asyncio.sleep(1.5)
                # send a ping/keepalive then check still open
                try:
                    await ws.send("ping")
                except Exception as e:
                    record("4.C stays open after 1.5s", False, f"send fail: {e}")
                    return
                record("4.C stays open after 1.5s",
                       not ws.closed if hasattr(ws, 'closed') else True,
                       "still open")
            except asyncio.TimeoutError:
                record("4.C agent token first message", False, "timeout waiting for message")
            except websockets.ConnectionClosed as e:
                record("4.C agent token NOT closed",
                       False,
                       f"unexpected close code={e.code} reason={e.reason!r}")
    except Exception as e:
        record("4.C agent token connect", False, f"err={type(e).__name__}: {e}")


# ============================================================
# 5) /api/auth/resend-otp Twilio SMS
# ============================================================
def test_resend_otp():
    print("\n=== 5) POST /api/auth/resend-otp ===")
    client_token = login(CLIENT_EMAIL, CLIENT_PASSWORD)
    hh = {"Authorization": f"Bearer {client_token}"}
    # Need user_id — fetch /auth/me
    me = requests.get(f"{API}/auth/me", headers=hh, timeout=20).json()
    user_id = me.get("user", {}).get("id")
    if not user_id:
        record("5.0 fetch user_id", False, f"me={me}")
        return
    r = requests.post(f"{API}/auth/resend-otp", json={"user_id": user_id}, timeout=20)
    record("5.1 resend-otp → 200",
           r.status_code == 200,
           f"status={r.status_code} body={r.text[:200]}")


def test_resend_otp_logs():
    """Inspect backend logs for Twilio SMS attempt."""
    print("\n=== 5b) Backend logs — Twilio SMS attempt ===")
    import subprocess
    out = subprocess.run(
        ["tail", "-n", "200", "/var/log/supervisor/backend.err.log"],
        capture_output=True, text=True
    )
    log = out.stdout + out.stderr
    has_attempt = ("[twilio] sms sent" in log) or ("[twilio] sms send failed" in log) or ("[twilio] sms exception" in log) or ("[OTP resend] sms send" in log) or ("[twilio]" in log and "sms" in log.lower())
    record("5b Twilio SMS attempt in logs",
           has_attempt,
           "found Twilio sms log line" if has_attempt else "no [twilio] sms log within last 200 lines (may be earlier)")


# ============================================================
# 6) Regression
# ============================================================
def test_regressions():
    print("\n=== 6) Regression ===")
    client_token = login(CLIENT_EMAIL, CLIENT_PASSWORD)
    hh = {"Authorization": f"Bearer {client_token}"}

    # 6.1 recharge-qr with PIN OK
    r = requests.post(f"{API}/wallet/recharge-qr", json={"amount": 50, "pin": CLIENT_PIN}, headers=hh, timeout=20)
    j = {}
    try:
        j = r.json()
    except Exception:
        pass
    record("6.1 /wallet/recharge-qr PIN OK → 200",
           r.status_code == 200 and j.get("qr_token"),
           f"status={r.status_code} keys={list(j.keys()) if isinstance(j, dict) else 'n/a'}")

    # 6.2 paypal/order
    r = requests.post(f"{API}/paypal/order", json={"amount": 50}, headers=hh, timeout=30)
    j = {}
    try:
        j = r.json()
    except Exception:
        pass
    record("6.2 /paypal/order amount=50 → 200",
           r.status_code == 200 and j.get("order_id"),
           f"status={r.status_code} keys={list(j.keys()) if isinstance(j, dict) else 'n/a'}")

    # 6.3 /wallet/withdraw with PIN OK
    payload = {
        "amount": 10, "method": "bank", "pin": CLIENT_PIN,
        "details": {"iban": "FR7630006000011234567890189", "holder": "Demo Client"},
    }
    r = requests.post(f"{API}/wallet/withdraw", json=payload, headers=hh, timeout=20)
    j = {}
    try:
        j = r.json()
    except Exception:
        pass
    record("6.3 /wallet/withdraw PIN OK → 200",
           r.status_code == 200 and (j.get("ok") or j.get("tx_id")),
           f"status={r.status_code} keys={list(j.keys()) if isinstance(j, dict) else 'n/a'}")


# ============================================================
# Main
# ============================================================
def main():
    test_lookup_phone()
    test_register()
    test_commission_breakdown()
    asyncio.run(test_ws_agent())
    test_resend_otp()
    test_resend_otp_logs()
    test_regressions()

    # Summary
    print("\n" + "=" * 60)
    passed = sum(1 for _, ok, _ in results if ok)
    total = len(results)
    print(f"TOTAL: {passed}/{total} PASS")
    fails = [(n, d) for n, ok, d in results if not ok]
    if fails:
        print("\nFAILURES:")
        for n, d in fails:
            print(f"  ❌ {n} — {d}")
    print("=" * 60)


if __name__ == "__main__":
    main()
