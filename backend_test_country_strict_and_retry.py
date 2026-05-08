"""
Tests for two NEW backend changes:
  1) Country-strict agent filter on auctions:
     - start_auction() filters agents by destination country (country_code or country)
     - place_bid() returns 403 if agent country != transfer destination country
  2) New endpoint POST /api/transfers/{id}/retry-auction:
     - 404 if not owner
     - 400 if status not in BIDDING/EXPIRED
     - 409 if agent_id already set
     - On success: clears bids, resets BIDDING, calls start_auction, returns {ok:true}

Plus a smoke test that transfer creation/auction still works end-to-end.

Run:  python3 /app/backend_test_country_strict_and_retry.py
"""
import os
import sys
import time
import json
import asyncio
import requests

BASE = "https://mobile-transfer-hub-3.preview.emergentagent.com/api"
CLIENT_EMAIL = "client@sendbid.app"
CLIENT_PWD = "Client@123!"
CLIENT_PIN = "123456"
AGENT_EMAIL = "agent@paybid.app"
AGENT_PWD = "Agent@123!"

results = []  # (name, ok, detail)


def rec(name, ok, detail=""):
    mark = "PASS" if ok else "FAIL"
    print(f"[{mark}] {name}{(' — ' + detail) if detail else ''}")
    results.append((name, ok, detail))


def login(email, password):
    r = requests.post(f"{BASE}/auth/login",
                      json={"identifier": email, "password": password},
                      timeout=30)
    r.raise_for_status()
    return r.json()["access_token"]


def auth(tok):
    return {"Authorization": f"Bearer {tok}"}


def create_cash_transfer(client_tok, dest_country, dest_currency, dest_city,
                         send_amount=20.0, fee_percent=2.0, fx_rate=655.957,
                         vip=False, mode="cash"):
    """Returns transfer dict on success."""
    receive_amount = round(send_amount * fx_rate, 2)
    draft_payload = {
        "destination_country": dest_country,
        "destination_currency": dest_currency,
        "send_amount": send_amount,
        "receive_amount": receive_amount,
        "fx_rate": fx_rate,
        "fee_percent": fee_percent,
        "delivery_mode": mode,
        "beneficiary": {
            "full_name": "Bénéficiaire Test",
            "phone": "+237670000001",
            "city": dest_city,
            "country": dest_country,
        },
        "delivery_details": {},
        "purpose": "support_family",
        "source_of_funds": "salary",
        "vip_delivery": vip,
    }
    r = requests.post(f"{BASE}/transfers/draft", json=draft_payload, headers=auth(client_tok), timeout=30)
    r.raise_for_status()
    draft = r.json()
    r = requests.post(f"{BASE}/transfers/confirm",
                      json={"draft_id": draft["id"], "pin": CLIENT_PIN},
                      headers=auth(client_tok), timeout=30)
    r.raise_for_status()
    return r.json()


# ------------------- DB helper for setup ----------------------
async def _db():
    from motor.motor_asyncio import AsyncIOMotorClient
    cli = AsyncIOMotorClient("mongodb://localhost:27017")
    return cli["sendbid"]


async def setup_agents_and_get_demo():
    """Ensure we have CMR agents (so an auction to CMR can collect bids).
    Also ensure the demo PAYBID agent exists. Returns dict of helpful info.
    """
    db = await _db()
    # Ensure at least 2 CMR agents exist (idempotent based on full_name)
    cmr_seeds = [
        {"full_name": "Test CMR Agent 1", "city": "Yaoundé", "country": "CMR"},
        {"full_name": "Test CMR Agent 2", "city": "Douala", "country": "CMR"},
    ]
    cmr_ids = []
    for spec in cmr_seeds:
        existing = await db.agents.find_one({"full_name": spec["full_name"]}, {"_id": 0, "id": 1})
        if existing:
            cmr_ids.append(existing["id"])
            await db.agents.update_one(
                {"id": existing["id"]},
                {"$set": {"country": spec["country"], "country_code": spec["country"], "city": spec["city"], "rating": 4.7, "available": True}},
            )
        else:
            import uuid
            aid = str(uuid.uuid4())
            await db.agents.insert_one({
                "id": aid, "full_name": spec["full_name"], "city": spec["city"],
                "country": spec["country"], "country_code": spec["country"],
                "rating": 4.7, "available": True,
                "transfers_count": 100, "lat": 3.848, "lng": 11.5021,
                "avatar_url": None, "floo_balance": 1000.0,
            })
            cmr_ids.append(aid)
    # Capture demo agent state to restore later
    demo = await db.agents.find_one({"full_name": "Mamadou Sow"}, {"_id": 0})
    return {"cmr_ids": cmr_ids, "demo_agent": demo}


async def patch_demo_agent_country(country):
    """Set the demo PAYBID agent country (used to test 403 cross-country bid).
    Pass None to remove the field. Targets the agent linked to agent@paybid.app."""
    db = await _db()
    user = await db.users.find_one({"email": "agent@paybid.app"}, {"_id": 0, "agent_id": 1})
    if not user or not user.get("agent_id"):
        return
    aid = user["agent_id"]
    if country is None:
        await db.agents.update_one({"id": aid}, {"$unset": {"country": "", "country_code": ""}})
    else:
        await db.agents.update_one({"id": aid},
                                   {"$set": {"country": country, "country_code": country}})


async def _get_linked_agent_id():
    db = await _db()
    user = await db.users.find_one({"email": "agent@paybid.app"}, {"_id": 0, "agent_id": 1})
    return user.get("agent_id") if user else None


async def get_bids(transfer_id):
    db = await _db()
    return await db.bids.find({"transfer_id": transfer_id}, {"_id": 0}).to_list(100)


async def get_agent_by_id(aid):
    db = await _db()
    return await db.agents.find_one({"id": aid}, {"_id": 0})


async def get_transfer_db(tid):
    db = await _db()
    return await db.transfers.find_one({"id": tid}, {"_id": 0})


async def force_set_transfer(tid, fields):
    db = await _db()
    await db.transfers.update_one({"id": tid}, {"$set": fields})


# ------------------- TESTS ----------------------

def test_country_strict_filter(client_tok, ctx):
    print("\n===== TEST 1: Country-strict filter on start_auction (CMR) =====")
    transfer = create_cash_transfer(
        client_tok, dest_country="CMR", dest_currency="XAF", dest_city="Yaoundé",
        send_amount=15.0, fee_percent=2.0, fx_rate=655.957,
    )
    tid = transfer["id"]
    rec("T1.0 cash transfer to CMR created", transfer.get("status") == "BIDDING",
        f"id={tid} status={transfer.get('status')}")
    # Wait for bids to come in (auction round 1 emits bids over 90s)
    deadline = time.time() + 60
    bids = []
    while time.time() < deadline:
        bids = asyncio.run(get_bids(tid))
        if len(bids) >= 2:
            break
        time.sleep(3)
    rec("T1.1 at least 1 bid registered for CMR transfer", len(bids) >= 1,
        f"got {len(bids)} bids in ~{int(time.time() - (deadline-60))}s")
    # Verify ALL bids come from CMR agents
    if not bids:
        rec("T1.2 all bidder agents are CMR-based (skipped — no bids)", False, "no bids to inspect")
        return tid
    all_cmr = True
    foreign_examples = []
    for b in bids:
        ag = asyncio.run(get_agent_by_id(b["agent_id"]))
        ag_country = (ag.get("country_code") or ag.get("country") or "").upper() if ag else ""
        if ag_country != "CMR":
            all_cmr = False
            foreign_examples.append((b.get("agent_name"), ag_country, ag.get("city") if ag else "?"))
    rec("T1.2 every bidder is CMR-based (country/country_code == CMR)", all_cmr,
        f"foreign bidders found: {foreign_examples}" if not all_cmr else f"verified across {len(bids)} bids")
    return tid


def test_403_foreign_bid(client_tok, agent_tok, ctx):
    print("\n===== TEST 2: 403 on cross-country bid =====")
    # Patch demo agent country to SN
    asyncio.run(patch_demo_agent_country("SN"))
    # Verify it stuck (look up linked agent via user)
    db_demo_id = asyncio.run(_get_linked_agent_id())
    db_demo = asyncio.run(get_agent_by_id(db_demo_id))
    rec("T2.0 demo agent country set to SN", db_demo.get("country") == "SN",
        f"country={db_demo.get('country')} country_code={db_demo.get('country_code')}")
    # Create a fresh CMR transfer
    transfer = create_cash_transfer(
        client_tok, dest_country="CMR", dest_currency="XAF", dest_city="Yaoundé",
        send_amount=10.0, fee_percent=2.0, fx_rate=655.957,
    )
    tid = transfer["id"]
    # Try to bid as the SN agent
    r = requests.post(
        f"{BASE}/agent/auctions/{tid}/bid",
        json={"transfer_id": tid, "bid_fee_percent": 1.5, "eta_minutes": 30},
        headers=auth(agent_tok),
        timeout=30,
    )
    rec("T2.1 cross-country bid returns 403", r.status_code == 403,
        f"status={r.status_code} body={r.text[:200]}")
    if r.status_code == 403:
        detail = ""
        try:
            detail = r.json().get("detail", "")
        except Exception:
            pass
        rec("T2.2 403 detail mentions French message",
            "Vous ne pouvez enchérir" in detail or "votre pays" in detail.lower(),
            f"detail={detail}")
    # Restore agent country to original
    orig_country = ctx["demo_agent"].get("country")
    asyncio.run(patch_demo_agent_country(orig_country))


def test_403_same_country_allowed(client_tok, agent_tok, ctx):
    """Sanity: if agent IS in target country, bid succeeds (no 403)."""
    print("\n===== TEST 2b: same-country bid is NOT blocked =====")
    asyncio.run(patch_demo_agent_country("CMR"))
    transfer = create_cash_transfer(
        client_tok, dest_country="CMR", dest_currency="XAF", dest_city="Yaoundé",
        send_amount=10.0, fee_percent=2.0, fx_rate=655.957,
    )
    tid = transfer["id"]
    r = requests.post(
        f"{BASE}/agent/auctions/{tid}/bid",
        json={"transfer_id": tid, "bid_fee_percent": 1.4, "eta_minutes": 30},
        headers=auth(agent_tok),
        timeout=30,
    )
    rec("T2b same-country bid is accepted (not 403)",
        r.status_code in (200, 400, 409),  # 200 best; 400/409 means blocked by other rules but NOT country
        f"status={r.status_code} body={r.text[:200]}")
    # Restore
    orig_country = ctx["demo_agent"].get("country")
    asyncio.run(patch_demo_agent_country(orig_country))


def test_retry_auction(client_tok):
    print("\n===== TEST 3: POST /transfers/{id}/retry-auction =====")
    # 3a) 404 if not owner — create a transfer as another user; here we use a fake id
    r = requests.post(f"{BASE}/transfers/UNKNOWN_TRANSFER_99999/retry-auction",
                      headers=auth(client_tok), timeout=30)
    rec("T3a unknown transfer → 404", r.status_code == 404,
        f"status={r.status_code} body={r.text[:120]}")

    # 3b) 400 if status not BIDDING/EXPIRED — create a BANK transfer (status=PROCESSING)
    bank_t = create_cash_transfer(
        client_tok, dest_country="SN", dest_currency="XOF", dest_city="Dakar",
        send_amount=12.0, fee_percent=2.0, fx_rate=655.957, mode="bank",
    )
    bank_tid = bank_t["id"]
    rec("T3b.0 bank transfer created (status=PROCESSING)",
        bank_t.get("status") == "PROCESSING",
        f"status={bank_t.get('status')}")
    r = requests.post(f"{BASE}/transfers/{bank_tid}/retry-auction",
                      headers=auth(client_tok), timeout=30)
    rec("T3b retry on PROCESSING transfer → 400",
        r.status_code == 400,
        f"status={r.status_code} body={r.text[:200]}")

    # 3c) 409 if agent_id already set — create cash transfer, force-set agent_id while keeping BIDDING
    cash_t = create_cash_transfer(
        client_tok, dest_country="CMR", dest_currency="XAF", dest_city="Yaoundé",
        send_amount=11.0, fee_percent=2.0, fx_rate=655.957,
    )
    cash_tid = cash_t["id"]
    asyncio.run(force_set_transfer(cash_tid, {"agent_id": "fake-agent-id-409", "status": "BIDDING"}))
    r = requests.post(f"{BASE}/transfers/{cash_tid}/retry-auction",
                      headers=auth(client_tok), timeout=30)
    rec("T3c retry when agent_id is set (status=BIDDING) → 409",
        r.status_code == 409,
        f"status={r.status_code} body={r.text[:200]}")
    # Cleanup: clear the fake agent_id so the next steps work
    asyncio.run(force_set_transfer(cash_tid, {"agent_id": None, "status": "BIDDING"}))

    # 3d) Success path — BIDDING transfer, no agent yet → resets bids, returns ok
    # First, allow some bids to accumulate
    time.sleep(8)
    pre_bids = asyncio.run(get_bids(cash_tid))
    r = requests.post(f"{BASE}/transfers/{cash_tid}/retry-auction",
                      headers=auth(client_tok), timeout=30)
    rec("T3d retry on BIDDING transfer → 200",
        r.status_code == 200,
        f"status={r.status_code} body={r.text[:200]}")
    body_ok = False
    try:
        body_ok = r.json().get("ok") is True
    except Exception:
        pass
    rec("T3d.1 response body has ok:true", body_ok, f"body={r.text[:120]}")
    # Verify bids were cleared (immediately after, before new round 1 fills)
    time.sleep(0.5)
    post_bids = asyncio.run(get_bids(cash_tid))
    rec("T3d.2 bids collection cleared (count drops to ~0 right after retry)",
        len(post_bids) <= max(1, len(pre_bids) // 4),
        f"pre={len(pre_bids)} post={len(post_bids)}")
    # Verify status reset and auction_round=0
    t_db = asyncio.run(get_transfer_db(cash_tid))
    rec("T3d.3 transfer status reset to BIDDING",
        t_db.get("status") == "BIDDING", f"status={t_db.get('status')}")
    rec("T3d.4 auction_round reset to 0 (or 1 once round_started fired)",
        t_db.get("auction_round") in (0, 1),
        f"auction_round={t_db.get('auction_round')}")

    # 3e) 404 if user does not own the transfer — agent owner check
    # Login as agent and try to retry the client's transfer → user_id mismatch → 404
    agent_tok = login(AGENT_EMAIL, AGENT_PWD)
    r = requests.post(f"{BASE}/transfers/{cash_tid}/retry-auction",
                      headers=auth(agent_tok), timeout=30)
    rec("T3e retry by non-owner (agent on client's transfer) → 404",
        r.status_code == 404,
        f"status={r.status_code} body={r.text[:120]}")


def test_smoke_creation(client_tok):
    print("\n===== TEST 4: Smoke — transfer creation still works =====")
    t = create_cash_transfer(
        client_tok, dest_country="SN", dest_currency="XOF", dest_city="Dakar",
        send_amount=20.0, fee_percent=2.0, fx_rate=655.957,
    )
    rec("T4.0 cash transfer creation OK",
        t.get("status") == "BIDDING" and t.get("withdrawal_code"),
        f"status={t.get('status')} code={t.get('withdrawal_code')}")
    # Wait briefly for at least one bid to confirm start_auction triggered
    deadline = time.time() + 90
    bids = []
    while time.time() < deadline:
        bids = asyncio.run(get_bids(t["id"]))
        if bids:
            break
        time.sleep(3)
    rec("T4.1 start_auction produces bids for SN transfer",
        len(bids) >= 1, f"bids count={len(bids)} after up to 90s")


def main():
    try:
        client_tok = login(CLIENT_EMAIL, CLIENT_PWD)
        agent_tok = login(AGENT_EMAIL, AGENT_PWD)
        rec("login as client + agent", True)
    except Exception as e:
        rec("login as client + agent", False, str(e))
        sys.exit(1)
    ctx = asyncio.run(setup_agents_and_get_demo())
    rec("setup CMR agents and capture demo agent",
        len(ctx["cmr_ids"]) >= 2 and ctx["demo_agent"] is not None,
        f"cmr_ids={ctx['cmr_ids']} demo_agent_country={ctx['demo_agent'].get('country') if ctx['demo_agent'] else None}")

    test_country_strict_filter(client_tok, ctx)
    test_403_foreign_bid(client_tok, agent_tok, ctx)
    test_403_same_country_allowed(client_tok, agent_tok, ctx)
    test_retry_auction(client_tok)
    test_smoke_creation(client_tok)

    # Final restore
    orig_country = (ctx["demo_agent"] or {}).get("country")
    asyncio.run(patch_demo_agent_country(orig_country))

    # Summary
    print("\n" + "=" * 60)
    failed = [r for r in results if not r[1]]
    passed = [r for r in results if r[1]]
    print(f"Total: {len(results)} | PASS: {len(passed)} | FAIL: {len(failed)}")
    for n, ok, d in failed:
        print(f"  FAIL: {n} — {d}")
    sys.exit(0 if not failed else 2)


if __name__ == "__main__":
    main()
