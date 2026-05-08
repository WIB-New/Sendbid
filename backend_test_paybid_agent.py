"""Test PAYBID agent backend endpoints."""
import os
import sys
import time
import json
import requests
from typing import Any

# Use public preview URL
BASE = "https://mobile-transfer-hub-3.preview.emergentagent.com/api"

AGENT_EMAIL = "agent@paybid.app"
AGENT_PASSWORD = "Agent@123!"
CLIENT_EMAIL = "client@sendbid.app"
CLIENT_PASSWORD = "Client@123!"
CLIENT_PIN = "123456"

PASS = 0
FAIL = 0
FAILS: list = []


def check(name: str, cond: bool, detail: str = "") -> bool:
    global PASS, FAIL
    if cond:
        PASS += 1
        print(f"  PASS: {name}")
        return True
    else:
        FAIL += 1
        FAILS.append(f"{name} | {detail}")
        print(f"  FAIL: {name} | {detail}")
        return False


def login(email: str, password: str) -> str:
    r = requests.post(f"{BASE}/auth/login", json={"identifier": email, "password": password}, timeout=20)
    assert r.status_code == 200, f"login {email} -> {r.status_code} {r.text}"
    return r.json()["access_token"]


def hdr(token: str) -> dict:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def main():
    print("=" * 70)
    print("PAYBID Agent backend test")
    print("=" * 70)

    print("\n[Login] agent + client")
    agent_token = login(AGENT_EMAIL, AGENT_PASSWORD)
    client_token = login(CLIENT_EMAIL, CLIENT_PASSWORD)
    check("login agent", bool(agent_token))
    check("login client", bool(client_token))

    # 1. GET /api/agent/me (agent)
    print("\n[1] GET /agent/me (agent)")
    r = requests.get(f"{BASE}/agent/me", headers=hdr(agent_token), timeout=15)
    check("agent /me 200", r.status_code == 200, f"got {r.status_code} {r.text[:200]}")
    if r.status_code == 200:
        body = r.json()
        check("body has user/agent/wallet", all(k in body for k in ("user", "agent", "wallet")), str(list(body.keys())))
        u = body.get("user") or {}
        a = body.get("agent") or {}
        w = body.get("wallet") or {}
        check("user.role==agent", u.get("role") == "agent", f"role={u.get('role')}")
        check("agent.full_name==Mamadou Sow", a.get("full_name") == "Mamadou Sow", f"full_name={a.get('full_name')}")
        check("wallet.currency==EUR", (w or {}).get("currency") == "EUR", f"wallet={w}")

    # 2. /agent/me with client token -> 403
    print("\n[2] GET /agent/me (client) -> 403")
    r = requests.get(f"{BASE}/agent/me", headers=hdr(client_token), timeout=15)
    check("client agent/me -> 403", r.status_code == 403, f"got {r.status_code} {r.text[:200]}")
    if r.status_code == 403:
        check("403 detail mentions agents PAYBID", "agent" in (r.json().get("detail", "").lower()), r.text)

    # 3. /agent/me without bearer -> 401
    print("\n[3] GET /agent/me (no bearer) -> 401")
    r = requests.get(f"{BASE}/agent/me", timeout=15)
    check("no-auth -> 401", r.status_code == 401 or r.status_code == 403, f"got {r.status_code}")

    # 4. POST /agent/availability
    print("\n[4] POST /agent/availability toggle")
    r = requests.post(f"{BASE}/agent/availability", headers=hdr(agent_token), json={"available": False}, timeout=15)
    check("availability false 200", r.status_code == 200 and r.json().get("available") is False, f"{r.status_code} {r.text}")
    r = requests.post(f"{BASE}/agent/availability", headers=hdr(agent_token), json={"available": True}, timeout=15)
    check("availability true 200", r.status_code == 200 and r.json().get("available") is True, f"{r.status_code} {r.text}")

    # 5. /agent/dashboard
    print("\n[5] GET /agent/dashboard")
    r = requests.get(f"{BASE}/agent/dashboard", headers=hdr(agent_token), timeout=15)
    check("dashboard 200", r.status_code == 200, f"{r.status_code} {r.text[:200]}")
    if r.status_code == 200:
        body = r.json()
        check("dashboard has agent", "agent" in body)
        stats = body.get("stats") or {}
        required_stats = ["today_completed", "week_completed", "active_count", "pending_auctions", "same_city_auctions",
                          "rating", "total_transfers", "total_earnings_eur", "week_earnings_eur"]
        check("stats keys present", all(k in stats for k in required_stats), f"missing={[k for k in required_stats if k not in stats]}")
        at = body.get("active_transfers") or []
        ap = body.get("auctions_preview") or []
        check("active_transfers <=5", isinstance(at, list) and len(at) <= 5, f"len={len(at) if isinstance(at, list) else type(at)}")
        check("auctions_preview <=5", isinstance(ap, list) and len(ap) <= 5, f"len={len(ap) if isinstance(ap, list) else type(ap)}")

    # 6. /agent/auctions
    print("\n[6] GET /agent/auctions")
    r = requests.get(f"{BASE}/agent/auctions", headers=hdr(agent_token), timeout=15)
    check("auctions 200", r.status_code == 200, f"{r.status_code}")
    auctions_all = r.json() if r.status_code == 200 else []
    check("auctions is list", isinstance(auctions_all, list))
    if auctions_all:
        sample = auctions_all[0]
        check("each auction has same_city flag", all("same_city" in a for a in auctions_all),
              f"sample keys: {list(sample.keys())[:8]}")
        check("each auction status BIDDING", all(a.get("status") == "BIDDING" for a in auctions_all),
              "non-BIDDING items found")

    # 7. /agent/auctions?only_same_city=true
    print("\n[7] GET /agent/auctions?only_same_city=true")
    r = requests.get(f"{BASE}/agent/auctions?only_same_city=true", headers=hdr(agent_token), timeout=15)
    check("auctions same_city 200", r.status_code == 200, f"{r.status_code}")
    if r.status_code == 200:
        items = r.json()
        check("filter only_same_city=true", isinstance(items, list) and all(a.get("same_city") for a in items),
              f"items={len(items)} non_same_city_count={sum(1 for a in items if not a.get('same_city'))}")

    # 8. /agent/transfers
    print("\n[8] GET /agent/transfers")
    r = requests.get(f"{BASE}/agent/transfers", headers=hdr(agent_token), timeout=15)
    check("transfers 200", r.status_code == 200, f"{r.status_code}")
    if r.status_code == 200:
        check("transfers is list", isinstance(r.json(), list))

    # 9. /agent/earnings?days=30
    print("\n[9] GET /agent/earnings?days=30")
    r = requests.get(f"{BASE}/agent/earnings?days=30", headers=hdr(agent_token), timeout=15)
    check("earnings 200", r.status_code == 200, f"{r.status_code}")
    if r.status_code == 200:
        b = r.json()
        check("earnings.period_days==30", b.get("period_days") == 30, str(b.get("period_days")))
        check("earnings has total_eur", "total_eur" in b)
        check("earnings.transactions is list", isinstance(b.get("transactions"), list))

    # 10. As CLIENT: create a fresh BIDDING transfer (cash, SN, Dakar)
    print("\n[10] CLIENT: create fresh BIDDING cash transfer to Dakar/SN")
    # FX rate
    fx = requests.get(f"{BASE}/transfers/fx-rate?from_currency=EUR&to_currency=XOF",
                      headers=hdr(client_token), timeout=15).json()
    rate = fx.get("rate", 655.957)
    send_amount = 50.0
    fee_percent = 2.0
    receive_amount = round(send_amount * rate, 2)
    draft_payload = {
        "destination_country": "SN",
        "destination_currency": "XOF",
        "send_amount": send_amount,
        "receive_amount": receive_amount,
        "fx_rate": rate,
        "fee_percent": fee_percent,
        "delivery_mode": "cash",
        "beneficiary": {
            "full_name": "Awa Diop",
            "phone": "+221770000123",
            "city": "Dakar",
            "country": "SN",
        },
        "delivery_details": {},
        "purpose": "family_support",
        "source_of_funds": "salary",
        "vip_delivery": False,
    }
    r = requests.post(f"{BASE}/transfers/draft", headers=hdr(client_token), json=draft_payload, timeout=15)
    check("draft 200", r.status_code == 200, f"{r.status_code} {r.text[:200]}")
    if r.status_code != 200:
        print("ABORT: cannot create draft")
        return summarize()
    draft_id = r.json()["id"]
    r = requests.post(f"{BASE}/transfers/confirm", headers=hdr(client_token),
                      json={"draft_id": draft_id, "pin": CLIENT_PIN}, timeout=20)
    check("confirm 200", r.status_code == 200, f"{r.status_code} {r.text[:200]}")
    if r.status_code != 200:
        print("ABORT: cannot confirm")
        return summarize()
    transfer = r.json()
    transfer_id = transfer["id"]
    print(f"  -> transfer_id={transfer_id}, status={transfer.get('status')}, fee_percent={transfer.get('fee_percent')}")
    check("transfer status BIDDING", transfer.get("status") == "BIDDING")

    # 11. As AGENT: place bid on this BIDDING transfer (immediately)
    print("\n[11] AGENT: POST /agent/auctions/{id}/bid with valid fee 1.50")
    bid_payload = {"transfer_id": transfer_id, "bid_fee_percent": 1.50, "eta_minutes": 30}
    r = requests.post(f"{BASE}/agent/auctions/{transfer_id}/bid", headers=hdr(agent_token),
                      json=bid_payload, timeout=15)
    check("place_bid 200", r.status_code == 200, f"{r.status_code} {r.text[:300]}")
    if r.status_code == 200:
        body = r.json()
        check("ok==true", body.get("ok") is True)
        bid = body.get("bid") or {}
        check("bid has id", "id" in bid)
        check("bid.agent_id matches", bid.get("agent_id") is not None)
        check("bid.agent_name==Mamadou Sow", bid.get("agent_name") == "Mamadou Sow", str(bid.get("agent_name")))
        check("bid.bid_fee_percent==1.50", bid.get("bid_fee_percent") == 1.5, str(bid.get("bid_fee_percent")))
        check("bid.same_city present (bool)", isinstance(bid.get("same_city"), bool), f"same_city={bid.get('same_city')}")

    # 13. Bid with fee outside fee bounds
    print("\n[13] Bid with fee out of range (0.1 below min)")
    # need a BIDDING transfer; create another
    r = requests.post(f"{BASE}/transfers/draft", headers=hdr(client_token), json=draft_payload, timeout=15)
    if r.status_code == 200:
        d2 = r.json()["id"]
        rc = requests.post(f"{BASE}/transfers/confirm", headers=hdr(client_token),
                           json={"draft_id": d2, "pin": CLIENT_PIN}, timeout=15)
        if rc.status_code == 200:
            t2 = rc.json()
            t2_id = t2["id"]
            fee_min = max(0.5, t2.get("fee_percent", 2.0) - 1.5)
            fee_max = t2.get("fee_percent", 2.0)
            # too low
            r = requests.post(f"{BASE}/agent/auctions/{t2_id}/bid", headers=hdr(agent_token),
                              json={"transfer_id": t2_id, "bid_fee_percent": fee_min - 0.1, "eta_minutes": 30},
                              timeout=15)
            check("bid below min -> 400", r.status_code == 400, f"{r.status_code} {r.text[:200]}")
            if r.status_code == 400:
                check("400 detail mentions hors fourchette", "hors fourchette" in r.json().get("detail", "").lower(),
                      r.text)
            # too high
            r = requests.post(f"{BASE}/agent/auctions/{t2_id}/bid", headers=hdr(agent_token),
                              json={"transfer_id": t2_id, "bid_fee_percent": fee_max + 0.5, "eta_minutes": 30},
                              timeout=15)
            check("bid above max -> 400", r.status_code == 400, f"{r.status_code} {r.text[:200]}")

            # 12. Re-bid on transfer that's no longer BIDDING (use accept-bid to fast-forward)
            # Wait briefly then list bids and accept first
            print("\n[12] Re-bid on non-BIDDING transfer -> 409")
            time.sleep(8)
            bids_r = requests.get(f"{BASE}/transfers/{t2_id}/bids", headers=hdr(client_token), timeout=15)
            bids_list = bids_r.json() if bids_r.status_code == 200 else []
            print(f"  -> bids count after 8s: {len(bids_list)}")
            if not bids_list:
                # wait more
                time.sleep(10)
                bids_list = requests.get(f"{BASE}/transfers/{t2_id}/bids", headers=hdr(client_token), timeout=15).json()
                print(f"  -> bids count after 18s: {len(bids_list)}")
            if bids_list:
                first_bid_id = bids_list[0]["id"]
                acc = requests.post(f"{BASE}/transfers/{t2_id}/accept-bid", headers=hdr(client_token),
                                    json={"transfer_id": t2_id, "bid_id": first_bid_id}, timeout=15)
                print(f"  -> accept-bid status: {acc.status_code}")
            # Now re-bid as agent
            r = requests.post(f"{BASE}/agent/auctions/{t2_id}/bid", headers=hdr(agent_token),
                              json={"transfer_id": t2_id, "bid_fee_percent": 1.5, "eta_minutes": 30}, timeout=15)
            check("re-bid on non-BIDDING -> 409", r.status_code == 409, f"{r.status_code} {r.text[:300]}")
            if r.status_code == 409:
                detail = r.json().get("detail", "").lower()
                check("409 detail mentions statut OR déjà assigné",
                      ("non disponible" in detail) or ("déjà" in detail) or ("assign" in detail),
                      r.text)

    # 14. Bid on unknown transfer_id -> 404
    print("\n[14] Bid on unknown transfer_id -> 404")
    r = requests.post(f"{BASE}/agent/auctions/UNKNOWN_TRANSFER_ID_999/bid",
                      headers=hdr(agent_token),
                      json={"transfer_id": "UNKNOWN_TRANSFER_ID_999", "bid_fee_percent": 1.5, "eta_minutes": 30},
                      timeout=15)
    check("unknown -> 404", r.status_code == 404, f"{r.status_code} {r.text[:200]}")
    if r.status_code == 404:
        check("404 detail Transfert introuvable", "introuvable" in r.json().get("detail", "").lower(), r.text)

    # === Sanity regression ===
    print("\n[15-19] Sanity regression")
    r = requests.post(f"{BASE}/auth/login", json={"identifier": CLIENT_EMAIL, "password": CLIENT_PASSWORD}, timeout=15)
    check("login client 200", r.status_code == 200)

    r = requests.get(f"{BASE}/wallet", headers=hdr(client_token), timeout=15)
    check("/wallet 200", r.status_code == 200, f"{r.status_code}")
    if r.status_code == 200:
        bal = r.json().get("balance")
        # Note: balance may differ from 1250.5 because we just spent some on transfer
        print(f"  wallet balance = {bal} EUR (initial seed 1250.5)")
        check("balance is numeric", isinstance(bal, (int, float)), str(bal))

    r = requests.get(f"{BASE}/corridors", headers=hdr(client_token), timeout=15)
    check("/corridors 200", r.status_code == 200)
    if r.status_code == 200:
        c = r.json()
        # expected count==250 per review
        if isinstance(c, dict):
            cnt = c.get("count")
            corridors = c.get("corridors", [])
        else:
            cnt = len(c)
            corridors = c
        check("corridors count==250", cnt == 250, f"count={cnt} len={len(corridors)}")

    r = requests.post(f"{BASE}/transfers/validate-code", headers=hdr(client_token),
                      json={"code": "9999999999"}, timeout=15)
    check("validate-code 9999999999 -> 404", r.status_code == 404, f"{r.status_code} {r.text[:200]}")

    r = requests.post(f"{BASE}/maps/directions", headers=hdr(client_token),
                      json={"origin": "Paris, France", "destination": "Dakar, Senegal", "mode": "drive"},
                      timeout=30)
    check("/maps/directions Paris->Dakar 200", r.status_code == 200, f"{r.status_code}")
    if r.status_code == 200:
        body = r.json()
        check("maps body has polyline", "polyline" in body and bool(body.get("polyline")), str(list(body.keys())))

    return summarize()


def summarize():
    print("\n" + "=" * 70)
    print(f"RESULTS: {PASS} pass / {FAIL} fail")
    if FAILS:
        print("\nFAILURES:")
        for f in FAILS:
            print(f"  - {f}")
    print("=" * 70)
    return FAIL == 0


if __name__ == "__main__":
    ok = main()
    sys.exit(0 if ok else 1)
