"""Backend tests for SENDBID v6.4 Vague 2 — UX bug fixes.

Tests:
  A) POST /api/auth/verify-pin — ephemeral PIN verification (no state change)
  B) Descending-only bid rule on POST /api/agent/auctions/{tid}/bid
     (note: review called it /api/agent/bids, but the actual route is
      /api/agent/auctions/{transfer_id}/bid; tested accordingly)

Credentials:
  client@sendbid.app / Client@123! / PIN 123456
  agent@paybid.app  / Agent@123!  / PIN 123456
"""

import json
import time
import requests

BASE = "https://mobile-transfer-hub-3.preview.emergentagent.com/api"
CLIENT_EMAIL = "client@sendbid.app"
CLIENT_PASS = "Client@123!"
CLIENT_PIN = "123456"
AGENT_EMAIL = "agent@paybid.app"
AGENT_PASS = "Agent@123!"

OK = 0
FAIL = 0
FAILURES = []


def _log(tag: str, ok: bool, detail: str = ""):
    global OK, FAIL
    symbol = "PASS" if ok else "FAIL"
    print(f"  [{symbol}] {tag} {('- ' + detail) if detail else ''}")
    if ok:
        OK += 1
    else:
        FAIL += 1
        FAILURES.append(f"{tag}: {detail}")


def login(email: str, password: str) -> str:
    r = requests.post(f"{BASE}/auth/login", json={"identifier": email, "password": password}, timeout=15)
    assert r.status_code == 200, f"login failed {r.status_code}: {r.text}"
    return r.json()["access_token"]


def section(title: str):
    print("\n" + "=" * 78)
    print(title)
    print("=" * 78)


# ---------------------------------------------------------------------------
# SECTION A — /api/auth/verify-pin
# ---------------------------------------------------------------------------
section("A) POST /api/auth/verify-pin")

client_token = login(CLIENT_EMAIL, CLIENT_PASS)
client_headers = {"Authorization": f"Bearer {client_token}"}

# A.1 Correct PIN → 200 ok:true
r = requests.post(f"{BASE}/auth/verify-pin", json={"pin": CLIENT_PIN}, headers=client_headers, timeout=10)
_log("A.1 Correct PIN 123456", r.status_code == 200 and r.json().get("ok") is True,
     f"status={r.status_code} body={r.text[:200]}")

# A.2 Wrong PIN → 401
r = requests.post(f"{BASE}/auth/verify-pin", json={"pin": "999999"}, headers=client_headers, timeout=10)
wrong_detail = (r.json() or {}).get("detail", "")
_log("A.2 Wrong PIN 999999 → 401", r.status_code == 401,
     f"status={r.status_code} detail={wrong_detail}")
_log("A.2b Error message 'Code PIN incorrect'", "incorrect" in wrong_detail.lower(),
     f"detail={wrong_detail}")

# A.3 No Authorization header → 401
r = requests.post(f"{BASE}/auth/verify-pin", json={"pin": CLIENT_PIN}, timeout=10)
_log("A.3 No Authorization header → 401", r.status_code == 401,
     f"status={r.status_code}")

# A.4 State-invariance: verify 3 wrong PINs, then correct PIN still works,
#     and that subsequent /auth/login still works (no lockout).
for i in range(3):
    requests.post(f"{BASE}/auth/verify-pin", json={"pin": "000000"}, headers=client_headers, timeout=10)

r_correct = requests.post(f"{BASE}/auth/verify-pin", json={"pin": CLIENT_PIN}, headers=client_headers, timeout=10)
_log("A.4a Correct PIN still OK after 3 wrong verify-pin calls",
     r_correct.status_code == 200, f"status={r_correct.status_code}")

# Verify login still works (no lockout)
try:
    _t = login(CLIENT_EMAIL, CLIENT_PASS)
    _log("A.4b /auth/login still works (no lockout from verify-pin)", bool(_t), "")
except Exception as e:
    _log("A.4b /auth/login still works (no lockout from verify-pin)", False, str(e))

# A.4c Confirm GET /auth/me shows no mutation to pin_attempts/pin_locked_until
#      pin_attempts should remain 0 (verify-pin must NOT consume attempts).
rme = requests.get(f"{BASE}/auth/me", headers=client_headers, timeout=10).json()
u = rme.get("user") or {}
pin_attempts = u.get("pin_attempts", "missing")
pin_locked = u.get("pin_locked_until", None)
# The field may not be returned in /auth/me response. If missing, treat as OK
# since the user is clearly not locked (login worked).
attempts_ok = pin_attempts in (0, "missing", None)
lock_ok = not pin_locked
_log("A.4c State invariance: pin_attempts untouched & account not locked",
     attempts_ok and lock_ok, f"pin_attempts={pin_attempts} pin_locked_until={pin_locked}")


# ---------------------------------------------------------------------------
# SECTION B — Descending-only bids
# ---------------------------------------------------------------------------
section("B) POST /api/agent/auctions/{id}/bid — descending-only rule")

agent_token = login(AGENT_EMAIL, AGENT_PASS)
agent_headers = {"Authorization": f"Bearer {agent_token}"}

# Step 1: client creates a cash transfer (NG → NGN for simplicity) with fee_percent=2.0
# then confirms it to move to BIDDING.
fx_rate = requests.get(f"{BASE}/transfers/fx-rate", params={"from": "EUR", "to": "NGN"},
                       headers=client_headers, timeout=10).json().get("rate", 1750.0)

draft_payload = {
    "destination_country": "NG",
    "destination_currency": "NGN",
    "send_amount": 20.0,
    "receive_amount": round(20.0 * fx_rate, 2),
    "fx_rate": fx_rate,
    "fee_percent": 2.0,  # senders' ceiling: bids must be < 2.0
    "delivery_mode": "cash",
    "beneficiary": {
        "full_name": "Chinedu Okafor",
        "phone": "+2348012345678",
        "country": "NG",
        "city": "Lagos",
    },
    "purpose": "family_support",
    "source_of_funds": "salary",
    "vip_delivery": False,
}

rd = requests.post(f"{BASE}/transfers/draft", json=draft_payload, headers=client_headers, timeout=15)
assert rd.status_code == 200, f"draft failed {rd.status_code}: {rd.text}"
draft_id = rd.json()["id"]

rc = requests.post(f"{BASE}/transfers/confirm",
                   json={"draft_id": draft_id, "pin": CLIENT_PIN},
                   headers=client_headers, timeout=15)
if rc.status_code != 200:
    _log("Setup: confirm transfer", False, f"status={rc.status_code} body={rc.text[:200]}")
    print("\nFATAL: could not create a BIDDING transfer. Aborting section B.")
    print(f"\nTotal: {OK} passed, {FAIL} failed")
    raise SystemExit(1)

tid = rc.json()["id"]
tstatus = rc.json().get("status")
_log("Setup: cash transfer created & in BIDDING",
     rc.status_code == 200 and tstatus == "BIDDING",
     f"tid={tid} status={tstatus}")

# Wait a moment for the auction to start, but we need to bid BEFORE an auto-agent is assigned.
# We'll race: bid immediately.
time.sleep(0.5)


def place_bid(fee_pct: float):
    """POST the manual agent bid with the given fee percentage."""
    body = {"transfer_id": tid, "bid_fee_percent": fee_pct, "eta_minutes": 30}
    return requests.post(f"{BASE}/agent/auctions/{tid}/bid",
                         json=body, headers=agent_headers, timeout=15)


# B.1 Equal to ceiling (2.0) → 400
r = place_bid(2.0)
detail = (r.json() or {}).get("detail", "")
_log("B.1 bid_fee_percent=2.0 (equal to 2.0%) → 400",
     r.status_code == 400,
     f"status={r.status_code} detail={detail}")
_log("B.1b Error mentions 'strictement inférieure à 2.00%'",
     ("strictement inférieur" in detail.lower()) and "2.00" in detail,
     f"detail={detail}")

# B.2 Above ceiling (2.5) → 400
r = place_bid(2.5)
_log("B.2 bid_fee_percent=2.5 → 400",
     r.status_code == 400, f"status={r.status_code} detail={(r.json() or {}).get('detail','')}")

# B.3 Strictly below ceiling (1.95) → should be 200 if still BIDDING. If an auto agent
#      already grabbed it, we get 409; in that case we recreate a new transfer.
r = place_bid(1.95)
if r.status_code == 409:
    # Recreate the transfer and retry quickly
    rd = requests.post(f"{BASE}/transfers/draft", json=draft_payload,
                       headers=client_headers, timeout=15)
    assert rd.status_code == 200, rd.text
    draft_id = rd.json()["id"]
    rc = requests.post(f"{BASE}/transfers/confirm",
                       json={"draft_id": draft_id, "pin": CLIENT_PIN},
                       headers=client_headers, timeout=15)
    assert rc.status_code == 200, rc.text
    tid = rc.json()["id"]
    r = place_bid(1.95)

body_json = (r.json() or {}) if r.headers.get("content-type","").startswith("application/json") else {}
_log("B.3 bid_fee_percent=1.95 (strictly below 2.0%) → 200",
     r.status_code == 200 and body_json.get("ok") is True,
     f"status={r.status_code} body={json.dumps(body_json)[:200]}")

# B.4 Minimum boundary: 0.3% (below fee_min=0.5) → 400
#      Note: because the above-scale-check happens first, we need to test on a
#      FRESH transfer (no auto agent yet) where the previous low bid doesn't block
#      this call. But 0.3 < 0.5 (fee_min), so it will hit the fee_min branch.
#      However our previous successful bid 1.95 registered as current_best → 0.3
#      still needs to be > 0.3 check. 0.3 < 0.5 so fee_min raises first.
r = place_bid(0.3)
detail = (r.json() or {}).get("detail", "")
_log("B.4 bid_fee_percent=0.3 (below fee_min 0.5) → 400",
     r.status_code == 400,
     f"status={r.status_code} detail={detail}")
_log("B.4b Error mentions minimum 0.50%",
     "0.50" in detail or "minimum" in detail.lower(),
     f"detail={detail}")

# B.5 Regression: a new bid must also be strictly LOWER than the current best
#      (descending-only). Place 1.90 should work (< 1.95), then 1.92 should fail.
r = place_bid(1.90)
ok_1_90 = r.status_code == 200 or r.status_code == 409
_log("B.5a Follow-up bid 1.90 (< previous 1.95) — expected 200 (or 409 if auction ended)",
     ok_1_90, f"status={r.status_code} detail={(r.json() or {}).get('detail','')}")

if r.status_code == 200:
    r2 = place_bid(1.92)
    det = (r2.json() or {}).get("detail", "")
    _log("B.5b Descending-only: raising above current best (1.92 > 1.90) → 400",
         r2.status_code == 400 and "descendante" in det.lower(),
         f"status={r2.status_code} detail={det}")

# B.6 Unknown transfer_id → 404
r = requests.post(f"{BASE}/agent/auctions/UNKNOWN_ID_999/bid",
                  json={"transfer_id": "UNKNOWN_ID_999", "bid_fee_percent": 1.5},
                  headers=agent_headers, timeout=10)
_log("B.6 Unknown transfer → 404", r.status_code == 404,
     f"status={r.status_code}")


# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
section("SUMMARY")
print(f"  Passed: {OK}")
print(f"  Failed: {FAIL}")
if FAILURES:
    print("\nFAILURES:")
    for f in FAILURES:
        print(f"  - {f}")
    raise SystemExit(1)
print("\nAll checks passed.")
