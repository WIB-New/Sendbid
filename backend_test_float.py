"""PAYBID Float endpoints smoke test.

Tests:
1) Agent login (seed agent or signup new agent fallback)
2) GET /api/agent/float (auto-creates XOF entry)
3) POST /api/agent/float/declare 500000 XOF
4) GET /api/agent/float/movements (declare movement)
5) POST /api/agent/float/declare 200000 XOF -> balance 700000
6) POST /api/agent/float/settle 150000 XOF -> balance 550000 + settlement movement
7) POST /api/agent/float/settle 10000000 XOF -> 400 Float insuffisant
8) Security: client token -> 403
9) Best-effort: complete_transfer with float-insufficient -> 400 (skipped if not easy)
Regression:
10) POST /api/agent/signup with new fields (defaults)
11) Descending bid still works (sanity)
"""
import os
import sys
import json
import time
import uuid
import requests

BASE = "https://mobile-transfer-hub-3.preview.emergentagent.com/api"

results = []
def log(name, ok, detail=""):
    sym = "PASS" if ok else "FAIL"
    print(f"[{sym}] {name}" + (f" — {detail}" if detail else ""))
    results.append((name, ok, detail))

def http(method, path, token=None, json_body=None, expected=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    url = BASE + path
    r = requests.request(method, url, headers=headers, json=json_body, timeout=30)
    return r


# --- 1) Login agent (or signup) ---
print("\n== Auth ==")
agent_token = None
r = http("POST", "/auth/login", json_body={"identifier": "agent@paybid.app", "password": "Agent@123!"})
if r.status_code == 200:
    agent_token = r.json().get("access_token")
    log("agent login (seeded)", True, f"role={r.json().get('user',{}).get('role')}")
else:
    log("agent login (seeded)", False, f"status={r.status_code} body={r.text[:200]}")
    # Fallback: signup
    sig = {
        "full_name": "Test Agent", "email": f"test-agent-{uuid.uuid4().hex[:6]}@paybid.app",
        "phone": f"+22177{uuid.uuid4().int % 10000000:07d}",
        "city": "Dakar", "country": "SN", "password": "AgentTest123!",
        "agent_type": "own", "float_currency": "XOF",
    }
    rs = http("POST", "/agent/signup", json_body=sig)
    log("fallback agent signup", rs.status_code == 200, f"status={rs.status_code} body={rs.text[:300]}")
    if rs.status_code == 200:
        rl = http("POST", "/auth/login", json_body={"identifier": sig["email"], "password": sig["password"]})
        if rl.status_code == 200:
            agent_token = rl.json().get("access_token")

if not agent_token:
    print("FATAL: no agent token, abort")
    sys.exit(1)


# --- 2) GET /api/agent/float ---
print("\n== GET /agent/float ==")
r = http("GET", "/agent/float", token=agent_token)
ok = r.status_code == 200
items = r.json().get("items") if ok else None
detail = f"status={r.status_code} items_count={len(items) if items else 0}"
if ok and items:
    first = items[0]
    detail += f" first={{'currency':{first.get('currency')!r},'balance':{first.get('balance')}}}"
log("GET /agent/float -> 200 with items", ok and items and len(items) >= 1, detail)
if ok and items:
    has_xof = any(i.get("currency") == "XOF" for i in items)
    log("at least one XOF entry", has_xof, "")


# --- 3) POST /agent/float/declare 500000 ---
print("\n== Declare 500000 XOF ==")
# Note: balance may already be non-zero if seed agent had previous declarations; capture initial state
initial_balance = 0.0
if items:
    xof = next((i for i in items if i.get("currency") == "XOF"), None)
    if xof:
        initial_balance = float(xof.get("balance") or 0)
print(f"Initial XOF balance: {initial_balance}")

r = http("POST", "/agent/float/declare", token=agent_token,
         json_body={"amount": 500000, "currency": "XOF", "reason": "Approvisionnement bureau"})
ok = r.status_code == 200
body = r.json() if ok else {}
expected_balance_after_first_declare = initial_balance + 500000
balance_ok = body.get("balance") == expected_balance_after_first_declare and body.get("currency") == "XOF" and body.get("ok") is True
log("POST /declare 500000 -> 200 ok=true currency=XOF", ok and balance_ok,
    f"status={r.status_code} body={body}")


# --- 4) GET /agent/float/movements (declare) ---
print("\n== GET /agent/float/movements ==")
r = http("GET", "/agent/float/movements", token=agent_token)
ok = r.status_code == 200
mv_items = r.json().get("items") if ok else []
log("GET /movements -> 200", ok, f"status={r.status_code} count={len(mv_items)}")
# Find a declare movement with amount_signed=500000
declare_mv = next((m for m in mv_items if m.get("type") == "declare" and m.get("amount_signed") == 500000), None)
log("declare movement type='declare' amount_signed=500000 present", declare_mv is not None,
    f"sample={declare_mv}" if declare_mv else f"latest_3={mv_items[:3]}")
if declare_mv:
    log("balance_after on declare matches", declare_mv.get("balance_after") == expected_balance_after_first_declare,
        f"balance_after={declare_mv.get('balance_after')} expected={expected_balance_after_first_declare}")


# --- 5) Second declare 200000 -> 700000 ---
print("\n== Declare another 200000 XOF ==")
r = http("POST", "/agent/float/declare", token=agent_token,
         json_body={"amount": 200000, "currency": "XOF"})
ok = r.status_code == 200
body = r.json() if ok else {}
expected_balance_after_second_declare = expected_balance_after_first_declare + 200000
log(f"POST /declare 200000 -> balance {expected_balance_after_second_declare}",
    ok and body.get("balance") == expected_balance_after_second_declare,
    f"status={r.status_code} body={body}")


# --- 6) POST /settle 150000 -> -150000 ---
print("\n== Settle 150000 XOF ==")
r = http("POST", "/agent/float/settle", token=agent_token,
         json_body={"amount": 150000, "currency": "XOF"})
ok = r.status_code == 200
body = r.json() if ok else {}
expected_balance_after_settle = expected_balance_after_second_declare - 150000
log(f"POST /settle 150000 -> balance {expected_balance_after_settle}",
    ok and body.get("balance") == expected_balance_after_settle,
    f"status={r.status_code} body={body}")

# Verify movement
r2 = http("GET", "/agent/float/movements", token=agent_token)
mv_items2 = r2.json().get("items") if r2.status_code == 200 else []
settlement_mv = next((m for m in mv_items2 if m.get("type") == "settlement" and m.get("amount_signed") == -150000), None)
log("settlement movement type='settlement' amount_signed=-150000 present",
    settlement_mv is not None, f"sample={settlement_mv}")


# --- 7) POST /settle 10000000 -> 400 Float insuffisant ---
print("\n== Settle 10M XOF (insufficient) ==")
r = http("POST", "/agent/float/settle", token=agent_token,
         json_body={"amount": 10000000, "currency": "XOF"})
ok = r.status_code == 400
detail = ""
try:
    detail = r.json().get("detail", "")
except Exception:
    detail = r.text
log("POST /settle 10M -> 400", ok, f"status={r.status_code} detail={detail!r}")
log("error mentions 'Float insuffisant'", "Float insuffisant" in (detail or ""), f"detail={detail!r}")


# --- 8) Security: client token -> 403 ---
print("\n== Security: client -> 403 ==")
client_token = None
rc = http("POST", "/auth/login", json_body={"identifier": "client@sendbid.app", "password": "Client@123!"})
if rc.status_code == 200:
    client_token = rc.json().get("access_token")
    log("client login", True)
else:
    log("client login", False, f"status={rc.status_code}")
if client_token:
    r = http("GET", "/agent/float", token=client_token)
    ok = r.status_code == 403
    detail = ""
    try: detail = r.json().get("detail", "")
    except: detail = r.text
    log("client GET /agent/float -> 403 'Réservé aux agents PAYBID'",
        ok and "Réservé aux agents PAYBID" in (detail or ""),
        f"status={r.status_code} detail={detail!r}")


# --- 9) Best effort: float insufficient on complete -> 400 ---
print("\n== Complete transfer with insufficient float (best-effort) ==")
# Hard to easily trigger an assignment to our test agent. We'll skip if unable.
# Quick scan: as agent, see if there's any assigned transfer
r = http("GET", "/agent/transfers", token=agent_token)
if r.status_code == 200:
    ts = r.json() if isinstance(r.json(), list) else r.json().get("items", []) or r.json().get("transfers", [])
    print(f"Agent has {len(ts) if isinstance(ts, list) else 'unknown'} assigned transfers")
    # We don't push too far; just log
    log("agent has assigned transfers", isinstance(ts, list) and len(ts) > 0,
        f"count={len(ts) if isinstance(ts, list) else 'N/A'} (not testing complete in this run)")
else:
    log("GET /agent/transfers", r.status_code == 200, f"status={r.status_code}")


# --- 10) Regression: POST /agent/signup with all new fields ---
print("\n== Regression /agent/signup (new fields) ==")
sig2 = {
    "full_name": "Regression Agent", "email": f"reg-agent-{uuid.uuid4().hex[:8]}@paybid.app",
    "phone": f"+22170{uuid.uuid4().int % 10000000:07d}",
    "city": "Dakar", "country": "SN", "password": "AgentTest123!",
    # agent_type omitted -> default "own", float_currency omitted -> default "XOF",
}
r = http("POST", "/agent/signup", json_body=sig2)
log("POST /agent/signup with omitted optional fields -> 200", r.status_code == 200,
    f"status={r.status_code} body={r.text[:200]}")


# --- 11) Sanity: descending bid validation still works ---
print("\n== Regression: descending bidding ==")
# Use client to create transfer, agent to bid
if client_token:
    # Create a transfer
    rd = http("POST", "/transfers/draft", token=client_token, json_body={
        "destination_country": "SN",
        "destination_currency": "XOF",
        "send_amount": 50,
        "receive_amount": 32797,
        "fx_rate": 655.957,
        "fee_percent": 5.0,
        "delivery_mode": "cash",
        "purpose": "family_support",
        "source_of_funds": "salary",
        "vip_delivery": False,
        "delivery_details": {"city": "Dakar", "address": "Plateau", "phone": "+221770000000"},
        "beneficiary": {"full_name": "Test Bene", "phone": "+221770000000",
                        "country": "SN", "city": "Dakar", "currency": "XOF", "relation": "family"},
    })
    if rd.status_code == 200:
        draft_id = rd.json().get("id") or rd.json().get("transfer_id") or rd.json().get("draft_id")
        # Some impls return the draft as the body keyed under "id"
        rc2 = http("POST", "/transfers/confirm", token=client_token,
                   json_body={"draft_id": draft_id, "pin": "123456"})
        if rc2.status_code == 200:
            transfer_id = rc2.json().get("id") or draft_id
            corr = http("GET", "/corridors/SN", token=agent_token)
            fee_max = corr.json().get("fee_percent_max", 5.0) if corr.status_code == 200 else 5.0
            # First bid at fee_max
            rb1 = http("POST", f"/agent/auctions/{transfer_id}/bid", token=agent_token,
                       json_body={"transfer_id": transfer_id, "bid_fee_percent": fee_max, "eta_minutes": 30})
            log(f"first manual bid {fee_max}% -> 200", rb1.status_code == 200,
                f"status={rb1.status_code} body={rb1.text[:200]}")
            # Second bid at same fee_max: should 400 descending
            rb2 = http("POST", f"/agent/auctions/{transfer_id}/bid", token=agent_token,
                       json_body={"transfer_id": transfer_id, "bid_fee_percent": fee_max, "eta_minutes": 30})
            ok = rb2.status_code == 400
            detail2 = ""
            try: detail2 = rb2.json().get("detail", "")
            except: detail2 = rb2.text
            log("re-bid at same fee -> 400 descending", ok and "descendante" in (detail2 or "").lower() or "Enchère" in (detail2 or ""),
                f"status={rb2.status_code} detail={detail2!r}")
        else:
            log("confirm transfer", False, f"status={rc2.status_code} body={rc2.text[:200]}")
    else:
        log("create draft transfer", False, f"status={rd.status_code} body={rd.text[:200]}")


# --- Summary ---
print("\n" + "=" * 60)
passed = sum(1 for _, ok, _ in results if ok)
total = len(results)
print(f"\nRESULT: {passed}/{total} PASS")
fails = [(n, d) for n, ok, d in results if not ok]
if fails:
    print("\nFailures:")
    for n, d in fails:
        print(f"  ❌ {n}\n     {d}")
sys.exit(0 if passed == total else 1)
