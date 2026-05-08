"""Backend test for SENDBID — POST /api/transfers/validate-code (PAYBID agent helper).

Tests:
  1) /api/transfers/validate-code (NEW endpoint)
  2) Sanity regression: /api/corridors, /api/scheduled-transfers, /api/disputes
  3) Auction constants confirmation (read-only)

Run: python /app/backend_test_validate_code.py
"""
from __future__ import annotations

import json
import os
import sys
import time
from typing import Optional

import requests

BACKEND_URL = "https://mobile-transfer-hub-3.preview.emergentagent.com"
API = BACKEND_URL.rstrip("/") + "/api"

CLIENT_EMAIL = "client@sendbid.app"
CLIENT_PASSWORD = "Client@123!"
CLIENT_PIN = "123456"

results = {"pass": 0, "fail": 0, "details": []}


def check(name: str, cond: bool, info: str = ""):
    mark = "✅" if cond else "❌"
    results["pass" if cond else "fail"] += 1
    results["details"].append((mark, name, info))
    print(f"{mark} {name}{(' — ' + info) if info else ''}")


def post(path: str, json_body=None, token: Optional[str] = None, timeout: int = 30):
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return requests.post(API + path, json=json_body, headers=headers, timeout=timeout)


def get(path: str, token: Optional[str] = None, timeout: int = 30, params=None):
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return requests.get(API + path, headers=headers, timeout=timeout, params=params)


def main() -> int:
    print(f"\n=== Testing against: {API} ===\n")

    # -------- Login --------
    print("--- Auth ---")
    r = post("/auth/login", {"identifier": CLIENT_EMAIL, "password": CLIENT_PASSWORD})
    check("POST /auth/login (client)", r.status_code == 200, f"HTTP {r.status_code}")
    if r.status_code != 200:
        print(r.text)
        return 1
    token = r.json().get("access_token") or r.json().get("token")
    check("login returns access_token", bool(token))
    if not token:
        return 1

    # -------- Sanity regression --------
    print("\n--- Sanity regression ---")
    r = get("/corridors", token=token)
    ok = r.status_code == 200
    check("GET /api/corridors → 200", ok, f"HTTP {r.status_code}")
    if ok:
        body = r.json()
        count = body.get("count")
        cor_list = body.get("corridors") or []
        check("GET /api/corridors count >= 200 (dynamic ~250)", count >= 200, f"count={count}")
        # spot-check shape on the first corridor
        if cor_list:
            sample = cor_list[0]
            need = {"country_code", "country_name", "currency", "delivery_modes", "fx_rate_eur"}
            check("corridor has required keys", need.issubset(sample.keys()), f"keys={list(sample.keys())[:8]}…")

    r = get("/scheduled-transfers", token=token)
    check("GET /api/scheduled-transfers (auth) → 200 list",
          r.status_code == 200 and isinstance(r.json(), list),
          f"HTTP {r.status_code} type={type(r.json()).__name__ if r.status_code == 200 else 'NA'}")

    r = get("/disputes", token=token)
    check("GET /api/disputes (auth) → 200 list",
          r.status_code == 200 and isinstance(r.json(), list),
          f"HTTP {r.status_code} type={type(r.json()).__name__ if r.status_code == 200 else 'NA'}")

    # -------- Auction constants regression (source-level) --------
    print("\n--- Auction constants (source inspection) ---")
    src_path = "/app/backend/routers/transfers.py"
    try:
        with open(src_path) as f:
            src = f.read()
        check("ROUNDS = 5", "ROUNDS = 5" in src)
        check("PER_ROUND = 10", "PER_ROUND = 10" in src)
        check("ROUND_SECONDS = 90", "ROUND_SECONDS = 90" in src)
        check("same_city computed per bid", '"same_city"' in src or "same_city =" in src)
    except Exception as e:
        check("read transfers.py for constants", False, str(e))

    # -------- /api/transfers/validate-code --------
    print("\n--- POST /api/transfers/validate-code ---")

    # Test 1e: no auth
    r = requests.post(API + "/transfers/validate-code", json={"code": "1234567890"}, timeout=15)
    check("validate-code no auth → 401/403", r.status_code in (401, 403), f"HTTP {r.status_code}")

    # Test 1c: too-short code
    r = post("/transfers/validate-code", {"code": "12345"}, token=token)
    check("validate-code too-short (<6) → 400", r.status_code == 400, f"HTTP {r.status_code} body={r.text[:200]}")

    # Test 1b: unknown 10-digit code
    r = post("/transfers/validate-code", {"code": "9999999999"}, token=token)
    check("validate-code unknown 10-digit → 404", r.status_code == 404, f"HTTP {r.status_code} body={r.text[:200]}")
    if r.status_code == 404:
        check("404 detail mentions 'Aucun transfert'",
              "Aucun transfert" in (r.json().get("detail") or ""),
              f"detail={r.json().get('detail')}")

    # ---- Build a transfer to test 1a + 1d ----
    # Compute fx for NG
    fx = get("/transfers/fx-rate", token=token, params={"to_currency": "NGN"}).json()
    rate = fx.get("rate", 1750.0)

    # Pick a beneficiary (any seeded one for this client)
    bens = get("/beneficiaries", token=token).json()
    if not isinstance(bens, list) or not bens:
        check("client has at least one beneficiary", False, str(bens)[:120])
        return 1
    ben = bens[0]
    # Override country/currency to NG/NGN to land on a corridor with cash mode
    ben_payload = {**ben, "country": "NG", "currency": "NGN", "city": "Lagos"}

    # Send 5 EUR cash to NG, no VIP (status will be BIDDING)
    send_amount = 5.0
    fee_pct = 2.0
    payload_draft = {
        "destination_country": "NG",
        "destination_currency": "NGN",
        "send_amount": send_amount,
        "receive_amount": round(send_amount * rate, 2),
        "fx_rate": rate,
        "fee_percent": fee_pct,
        "delivery_mode": "cash",
        "beneficiary": ben_payload,
        "purpose": "famille",
        "source_of_funds": "salaire",
        "vip_delivery": False,
    }
    r = post("/transfers/draft", payload_draft, token=token)
    check("POST /transfers/draft → 200", r.status_code == 200, f"HTTP {r.status_code} body={r.text[:200]}")
    if r.status_code != 200:
        return 1
    draft_id = r.json()["id"]

    r = post("/transfers/confirm", {"draft_id": draft_id, "pin": CLIENT_PIN}, token=token)
    check("POST /transfers/confirm → 200", r.status_code == 200, f"HTTP {r.status_code} body={r.text[:200]}")
    if r.status_code != 200:
        return 1
    transfer = r.json()
    transfer_id = transfer["id"]
    withdrawal_code = transfer["withdrawal_code"]
    print(f"   transfer_id={transfer_id} withdrawal_code={withdrawal_code} status={transfer['status']}")

    # Test 1d: wrong status — BIDDING is not in the allowed set
    r = post("/transfers/validate-code", {"code": withdrawal_code}, token=token)
    is_409 = r.status_code == 409
    check("validate-code on BIDDING status → 409", is_409, f"HTTP {r.status_code} body={r.text[:200]}")
    if is_409:
        detail = (r.json().get("detail") or "")
        check("409 detail mentions status (BIDDING)",
              "BIDDING" in detail or "statut" in detail.lower(),
              f"detail={detail}")

    # Test 1a: success path — wait for auction to assign an agent (round 1 ends at ~90s)
    print("\n--- Test 1a: success path (waiting for agent assignment) ---")
    deadline = time.time() + 130  # generous; round1 closes ~90s
    assigned = False
    last_status = None
    while time.time() < deadline:
        t = get(f"/transfers/{transfer_id}", token=token).json()
        last_status = t.get("status")
        if last_status in {"AGENT_ASSIGNED", "PROCESSING", "READY_FOR_PICKUP", "VIP_DELIVERY"}:
            assigned = True
            break
        # Heuristic: try to accept the first bid manually so we don't have to wait the full round
        bids = get(f"/transfers/{transfer_id}/bids", token=token).json()
        if isinstance(bids, list) and bids:
            best = sorted(bids, key=lambda b: (not b.get("same_city", False), b.get("bid_fee_percent", 99)))[0]
            ar = post(f"/transfers/{transfer_id}/accept-bid", {"transfer_id": transfer_id, "bid_id": best["id"]}, token=token)
            print(f"   accept-bid → HTTP {ar.status_code} bid_id={best['id'][:8]}")
            if ar.status_code == 200:
                # poll once more
                t = get(f"/transfers/{transfer_id}", token=token).json()
                last_status = t.get("status")
                if last_status in {"AGENT_ASSIGNED", "PROCESSING", "READY_FOR_PICKUP", "VIP_DELIVERY"}:
                    assigned = True
                    break
        time.sleep(4)

    check(f"transfer reached an assignable status (last_status={last_status})", assigned, f"last={last_status}")

    if assigned:
        r = post("/transfers/validate-code", {"code": withdrawal_code}, token=token)
        check("validate-code success → 200", r.status_code == 200, f"HTTP {r.status_code} body={r.text[:300]}")
        if r.status_code == 200:
            body = r.json()
            expected_keys = {
                "id", "beneficiary", "destination_country", "destination_currency",
                "receive_amount", "delivery_mode", "vip_delivery", "status",
                "agent_snapshot", "qr_expires_at",
            }
            missing = expected_keys - set(body.keys())
            check("response has all expected keys", not missing,
                  f"missing={missing} present={list(body.keys())}")
            check("response.status is in assignable set",
                  body.get("status") in {"AGENT_ASSIGNED", "PROCESSING", "READY_FOR_PICKUP", "VIP_DELIVERY"},
                  f"status={body.get('status')}")
            check("response.id matches transfer_id",
                  body.get("id") == transfer_id, f"id={body.get('id')}")
            check("response.destination_country == NG",
                  body.get("destination_country") == "NG")
            check("response.delivery_mode == cash",
                  body.get("delivery_mode") == "cash")
            check("response.agent_snapshot is non-empty dict",
                  isinstance(body.get("agent_snapshot"), dict) and bool(body.get("agent_snapshot")),
                  f"snapshot_keys={list((body.get('agent_snapshot') or {}).keys())[:6]}")

        # Also test qr_token path
        qr_token = transfer.get("qr_token")
        if qr_token:
            r = post("/transfers/validate-code", {"code": qr_token}, token=token)
            check("validate-code with qr_token → 200", r.status_code == 200, f"HTTP {r.status_code}")

    # ---- Summary ----
    print("\n=== SUMMARY ===")
    print(f"PASS: {results['pass']}    FAIL: {results['fail']}")
    if results["fail"]:
        print("\nFailures:")
        for mark, name, info in results["details"]:
            if mark == "❌":
                print(f"  - {name}: {info}")

    return 0 if results["fail"] == 0 else 2


if __name__ == "__main__":
    sys.exit(main())
