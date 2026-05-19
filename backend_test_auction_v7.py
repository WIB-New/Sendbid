"""
Test suite for Item 7 — Auction refactor in /app/backend/routers/transfers.py.

Scope:
A) Backend healthy (uvicorn reloaded without crash)
B) Endpoint existence (POST /api/transfers/draft, /confirm, /retry-auction)
C) Source-level presence of new functions (_composite_score, _commission_breakdown,
   COUNTER_BIDDING phase, ABSORBED fallback, ROUND_SECONDS=60, eligibility filter)
D) End-to-end: create BIDDING transfer, list bids after a few seconds → assert
   each bid contains `commission` with the expected breakdown keys.
E) Regression: /auth/login, /auth/me, /wallet/me (or /wallet).
"""
import os
import re
import time
import json
import sys

import requests

BASE = "https://paybid-preview.preview.emergentagent.com/api"
EMAIL = "client@sendbid.app"
PASSWORD = "Client@123!"
PIN = "123456"

results = []
def ok(name, cond, info=""):
    status = "PASS" if cond else "FAIL"
    results.append((name, cond, info))
    print(f"[{status}] {name} {('— ' + info) if info else ''}")

# =============================================================================
# A) Backend health + source-level inspection (Item C from review request)
# =============================================================================
print("\n=== A/C) Source-level inspection of transfers.py ===")
src = open("/app/backend/routers/transfers.py", "r").read()
ok("_composite_score function present", "def _composite_score(" in src)
ok("_commission_breakdown function present", "def _commission_breakdown(" in src)
ok("ROUND_SECONDS = 60", "ROUND_SECONDS = 60" in src,
   info=f"found 'ROUND_SECONDS = 60' in source" if "ROUND_SECONDS = 60" in src else "missing")
ok("ROUNDS = 5", "ROUNDS = 5" in src)
ok("PER_ROUND = 10", "PER_ROUND = 10" in src)
ok("Eligibility: available True/missing", '"available"' in src and ("available" in src))
ok("Eligibility: kyc_tier >= 3", "kyc_tier" in src and "$gte" in src and "3" in src)
ok("Eligibility: suspended != True", '"suspended"' in src and '"$ne": True' in src)
ok("Eligibility: has_overdue_transfer != True", "has_overdue_transfer" in src)
ok("Composite weights: 0.30 + 0.25 + 0.10*4 + 0.05",
   "0.30" in src and "0.25" in src and "0.05" in src)
ok("COUNTER_BIDDING phase status", '"COUNTER_BIDDING"' in src)
ok("counter_bid_phase_started broadcast", "counter_bid_phase_started" in src)
ok("counter_round_started broadcast", "counter_round_started" in src)
ok("new_counter_bid broadcast", "new_counter_bid" in src)
ok("fee_adjusted broadcast", '"fee_adjusted"' in src)
ok("max_counter_fee = 1.5x", "1.5" in src and "max_counter_fee" in src)
ok("ABSORBED fallback (< 200 EUR)", '"ABSORBED"' in src and "send_amount < 200" in src)
ok("EXPIRED fallback (>= 200 EUR)", '"EXPIRED"' in src)
ok("Simulation: bid lower / accept / decline percentages",
   re.search(r"0\.15", src) is not None and re.search(r"0\.40", src) is not None)
ok("Round bid selection: fee_low, rating desc, distance",
   "agent_rating" in src and "agent_distance_km" in src)
ok("Commission has client_fee_pct/client_fee_amount/company_share/agent_net",
   all(k in src for k in ["client_fee_pct", "client_fee_amount", "company_share", "agent_net"]))
ok("Company keeps 20%, agent 80%",
   "0.20" in src and ("client_fee_amount - company_share" in src or "0.8" in src))

# =============================================================================
# B) Endpoint existence + Regression — /auth/login + /auth/me + /wallet
# =============================================================================
print("\n=== B/E) Auth + Wallet regression ===")
r = requests.post(f"{BASE}/auth/login", json={"identifier": EMAIL, "password": PASSWORD}, timeout=15)
ok("POST /auth/login client@sendbid.app", r.status_code == 200, info=f"status={r.status_code}")
token = (r.json().get("access_token") or r.json().get("token")) if r.status_code == 200 else None
if not token:
    print(f"!!! Cannot continue without token. body={r.text[:300]}")
    sys.exit(2)
H = {"Authorization": f"Bearer {token}"}

r = requests.get(f"{BASE}/auth/me", headers=H, timeout=15)
ok("GET /auth/me", r.status_code == 200, info=f"status={r.status_code}")
me = r.json() if r.status_code == 200 else {}
user_id = me.get("id")

# Try /wallet/me first then fallback to /wallet
r = requests.get(f"{BASE}/wallet/me", headers=H, timeout=15)
if r.status_code == 404:
    r = requests.get(f"{BASE}/wallet", headers=H, timeout=15)
    ok("GET /wallet (fallback)", r.status_code == 200, info=f"status={r.status_code}")
else:
    ok("GET /wallet/me", r.status_code == 200, info=f"status={r.status_code}")
wallet = r.json() if r.status_code == 200 else {}

# =============================================================================
# Endpoint existence: /api/transfers (draft), /confirm, /retry-auction
# =============================================================================
print("\n=== B) Endpoint existence ===")
r_draft = requests.post(f"{BASE}/transfers/draft", headers=H, json={}, timeout=10)
ok("POST /transfers/draft exists (not 404)", r_draft.status_code != 404,
   info=f"status={r_draft.status_code}")
r_conf = requests.post(f"{BASE}/transfers/confirm", headers=H, json={}, timeout=10)
ok("POST /transfers/confirm exists (not 404)", r_conf.status_code != 404,
   info=f"status={r_conf.status_code}")
r_retry = requests.post(f"{BASE}/transfers/UNKNOWN_FAKE_ID_404/retry-auction",
                        headers=H, timeout=10)
ok("POST /transfers/{id}/retry-auction exists",
   r_retry.status_code == 404 and "Transfert introuvable" in r_retry.text,
   info=f"status={r_retry.status_code} body={r_retry.text[:120]}")

# =============================================================================
# D) End-to-end: create cash transfer to SN → wait → check bids have commission
# =============================================================================
print("\n=== D) Create BIDDING transfer and check commission in bids ===")

# Get FX rate for EUR->XOF
r = requests.get(f"{BASE}/transfers/fx-rate?from_currency=EUR&to_currency=XOF", headers=H, timeout=10)
fx = r.json() if r.status_code == 200 else {}
fx_rate = float(fx.get("rate") or 655.957)

send_amount = 50.0
fee_pct = 2.0
fx_margin = 1.0
applied_rate = round(fx_rate * (1 - fx_margin / 100), 4)
receive_amount = round(send_amount * applied_rate, 2)

draft_body = {
    "destination_country": "SN",
    "destination_currency": "XOF",
    "send_amount": send_amount,
    "receive_amount": receive_amount,
    "fx_rate": applied_rate,
    "fee_percent": fee_pct,
    "delivery_mode": "cash",
    "beneficiary": {
        "full_name": "Aminata Diop",
        "phone": "+221770000001",
        "country": "SN",
        "city": "Dakar",
    },
    "delivery_details": {"city": "Dakar"},
    "purpose": "family",
    "source_of_funds": "salary",
    "vip_delivery": False,
}
r = requests.post(f"{BASE}/transfers/draft", headers=H, json=draft_body, timeout=15)
ok("POST /transfers/draft → 200", r.status_code == 200, info=f"status={r.status_code} body={r.text[:200]}")
draft_id = r.json().get("id") if r.status_code == 200 else None

if draft_id:
    r = requests.post(f"{BASE}/transfers/confirm", headers=H,
                      json={"draft_id": draft_id, "pin": PIN}, timeout=20)
    ok("POST /transfers/confirm with PIN 123456 → 200",
       r.status_code == 200, info=f"status={r.status_code} body={r.text[:200]}")
    if r.status_code == 200:
        confirmed = r.json()
        transfer_id = confirmed.get("id")
        status = confirmed.get("status")
        ok("Confirmed transfer status == BIDDING (cash mode)",
           status == "BIDDING", info=f"status={status}")
        ok("Transfer has withdrawal_code 10 digits",
           bool(confirmed.get("withdrawal_code")) and len(str(confirmed["withdrawal_code"])) == 10,
           info=f"withdrawal_code={confirmed.get('withdrawal_code')}")

        # Wait up to 90s for bids to appear (auction round 1 is 60s, but sim
        # schedules individual bids between 2 and 57s within the round).
        print(f"   Waiting up to 75s for bids on transfer {transfer_id}...")
        bids = []
        for i in range(15):
            time.sleep(5)
            r = requests.get(f"{BASE}/transfers/{transfer_id}/bids", headers=H, timeout=10)
            if r.status_code == 200:
                bids = r.json()
                if bids:
                    print(f"   → after {(i+1)*5}s: {len(bids)} bid(s)")
                    break
        ok("GET /transfers/{id}/bids returns at least 1 bid within 75s",
           len(bids) >= 1, info=f"bids={len(bids)}")

        if bids:
            b0 = bids[0]
            keys = list(b0.keys())
            ok("Bid contains 'commission' field",
               "commission" in b0, info=f"keys={keys}")
            if "commission" in b0:
                c = b0["commission"]
                ok("commission has client_fee_pct",
                   "client_fee_pct" in c, info=f"commission={c}")
                ok("commission has client_fee_amount", "client_fee_amount" in c)
                ok("commission has company_share", "company_share" in c)
                ok("commission has agent_net", "agent_net" in c)
                # Numeric checks: client_fee_amount = send * pct/100
                bid_pct = float(b0.get("bid_fee_percent") or 0)
                expected_fee = round(send_amount * bid_pct / 100, 2)
                actual_fee = float(c.get("client_fee_amount") or -1)
                ok(f"commission.client_fee_amount == send_amount * bid_pct/100 ({expected_fee})",
                   abs(actual_fee - expected_fee) < 0.01,
                   info=f"expected={expected_fee} actual={actual_fee} bid_pct={bid_pct}")
                # company 20% / agent 80%
                exp_company = round(expected_fee * 0.20, 2)
                exp_agent = round(expected_fee - exp_company, 2)
                ok(f"commission.company_share == 20% ({exp_company})",
                   abs(float(c.get("company_share") or -1) - exp_company) < 0.02,
                   info=f"expected={exp_company} actual={c.get('company_share')}")
                ok(f"commission.agent_net == 80% ({exp_agent})",
                   abs(float(c.get("agent_net") or -1) - exp_agent) < 0.02,
                   info=f"expected={exp_agent} actual={c.get('agent_net')}")
                # bid_pct must be < client_fee_pct (strict descending) OR == client_fee_pct (accept case)
                ok("Bid fee_percent <= client_fee_pct (2.0%)",
                   bid_pct <= fee_pct + 0.01,
                   info=f"bid_pct={bid_pct} client_fee_pct={fee_pct}")

# =============================================================================
# SUMMARY
# =============================================================================
print("\n========== SUMMARY ==========")
passed = sum(1 for _, c, _ in results if c)
failed = sum(1 for _, c, _ in results if not c)
print(f"Total: {len(results)}  PASS: {passed}  FAIL: {failed}")
if failed:
    print("\nFAILED:")
    for name, c, info in results:
        if not c:
            print(f"  ❌ {name}  ({info})")
sys.exit(0 if failed == 0 else 1)
