"""SENDBID Backend tests for Lot 2 (Google Maps + Stripe) and regression."""
import os
import sys
import time
import json
import asyncio
from typing import Optional, Tuple

import requests
from motor.motor_asyncio import AsyncIOMotorClient

# Read backend URL
ENV_PATH = "/app/frontend/.env"
BACKEND = None
for line in open(ENV_PATH):
    if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
        BACKEND = line.split("=", 1)[1].strip().strip('"')
        break
assert BACKEND, "EXPO_PUBLIC_BACKEND_URL missing"
API = BACKEND.rstrip("/") + "/api"

DEMO = {"identifier": "client@sendbid.app", "password": "Client@123!"}
PIN = "123456"

results = []  # (label, passed, detail)


def record(label, ok, detail=""):
    results.append((label, ok, detail))
    flag = "PASS" if ok else "FAIL"
    print(f"[{flag}] {label} -- {detail}")


def login() -> str:
    r = requests.post(f"{API}/auth/login", json=DEMO, timeout=15)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    data = r.json()
    return data["access_token"]


def auth(token):
    return {"Authorization": f"Bearer {token}"}


# ---------- 1. Google Maps ----------
def test_maps(token):
    # /maps/config without auth → 401/403
    r = requests.get(f"{API}/maps/config", timeout=10)
    record(
        "GET /maps/config requires auth",
        r.status_code in (401, 403),
        f"status={r.status_code}",
    )

    # /maps/config WITH auth
    r = requests.get(f"{API}/maps/config", headers=auth(token), timeout=10)
    ok = (
        r.status_code == 200
        and r.json().get("enabled") is True
        and set(r.json().get("supported_modes", []))
        == {"drive", "walk", "transit", "bike"}
    )
    record(
        "GET /maps/config (auth) returns enabled+supported_modes",
        ok,
        f"status={r.status_code} body={r.text[:200]}",
    )

    # /maps/directions Paris→Dakar drive
    body = {
        "origin": "48.8566,2.3522",
        "destination": "14.6928,-17.4467",
        "mode": "drive",
    }
    r = requests.post(
        f"{API}/maps/directions", json=body, headers=auth(token), timeout=20
    )
    if r.status_code != 200:
        record("POST /maps/directions drive", False, f"status={r.status_code} {r.text[:200]}")
        return
    j = r.json()
    ok = (
        j.get("ok") is True
        and bool(j.get("polyline"))
        and bool(j.get("distance_text"))
        and bool(j.get("duration_text"))
        and isinstance(j.get("start_location"), dict)
        and isinstance(j.get("end_location"), dict)
    )
    record(
        "POST /maps/directions drive",
        ok,
        f"distance={j.get('distance_text')} duration={j.get('duration_text')} polyline_len={len(j.get('polyline','') or '')}",
    )

    # Other modes
    for mode in ("walk", "transit", "bike"):
        body["mode"] = mode
        r = requests.post(
            f"{API}/maps/directions", json=body, headers=auth(token), timeout=20
        )
        if r.status_code != 200:
            record(f"POST /maps/directions {mode}", False, f"status={r.status_code}")
            continue
        j = r.json()
        # Some modes may yield ZERO_RESULTS for Paris→Dakar (walk, transit). Accept stub fallback.
        ok = "duration_text" in j and "distance_text" in j
        record(
            f"POST /maps/directions {mode}",
            ok,
            f"ok={j.get('ok')} stub={j.get('stub')} duration={j.get('duration_text')}",
        )


def create_transfer(token) -> Tuple[Optional[str], dict]:
    # Use cash mode to trigger auction
    draft_payload = {
        "destination_country": "Sénégal",
        "destination_currency": "XOF",
        "send_amount": 100.0,
        "receive_amount": 65595.0,
        "fx_rate": 655.957,
        "fee_percent": 2.0,
        "delivery_mode": "cash",
        "beneficiary": {
            "full_name": "Aminata Diop",
            "phone": "+221770000000",
        },
        "delivery_details": {"city": "Dakar"},
        "purpose": "family_support",
        "source_of_funds": "salary",
        "vip_delivery": False,
    }
    r = requests.post(
        f"{API}/transfers/draft", json=draft_payload, headers=auth(token), timeout=15
    )
    if r.status_code != 200:
        return None, {"draft_error": r.text}
    draft = r.json()

    r = requests.post(
        f"{API}/transfers/confirm",
        json={"draft_id": draft["id"], "pin": PIN},
        headers=auth(token),
        timeout=15,
    )
    if r.status_code != 200:
        return None, {"confirm_error": r.text}
    transfer = r.json()
    return transfer["id"], transfer


def test_maps_transfer_route(token):
    transfer_id, t = create_transfer(token)
    if not transfer_id:
        record("Create transfer for maps route", False, str(t))
        return
    # Poll for agent_snapshot up to ~90s
    have_agent = False
    start = time.time()
    while time.time() - start < 100:
        r = requests.get(
            f"{API}/transfers/{transfer_id}", headers=auth(token), timeout=10
        )
        if r.status_code == 200:
            tr = r.json()
            if tr.get("agent_snapshot"):
                have_agent = True
                break
        time.sleep(3)

    r = requests.get(
        f"{API}/maps/transfer/{transfer_id}/route?mode=drive",
        headers=auth(token),
        timeout=20,
    )
    if r.status_code != 200:
        record("GET /maps/transfer/{id}/route", False, f"status={r.status_code} body={r.text[:300]}")
        return
    j = r.json()
    if not have_agent:
        ok = j.get("stub") is True and j.get("stub_reason") == "no_agent_assigned"
        record(
            "GET /maps/transfer route (no agent yet) returns stub",
            ok,
            f"json={json.dumps(j)[:200]}",
        )
        return

    ok_embed = "google.com/maps/embed" in (j.get("embed_url") or "")
    ok_static = "staticmap" in (j.get("static_url") or "")
    ag = j.get("agent") or {}
    ok_coords = ag.get("lat") is not None and ag.get("lng") is not None
    record(
        "GET /maps/transfer route (agent assigned)",
        ok_embed and ok_static and ok_coords,
        f"embed_ok={ok_embed} static_ok={ok_static} agent_lat={ag.get('lat')} agent_lng={ag.get('lng')} city={ag.get('city')}",
    )


# ---------- 2. Stripe ----------
def test_payments(token):
    # /payments/packages without auth
    r = requests.get(f"{API}/payments/packages", timeout=10)
    record(
        "GET /payments/packages requires auth",
        r.status_code in (401, 403),
        f"status={r.status_code}",
    )

    # with auth
    r = requests.get(f"{API}/payments/packages", headers=auth(token), timeout=10)
    if r.status_code != 200:
        record("GET /payments/packages", False, f"status={r.status_code} body={r.text[:200]}")
    else:
        j = r.json()
        pkgs = {p["id"]: p for p in j.get("packages", [])}
        wanted = {"starter": 20.0, "standard": 50.0, "premium": 100.0, "vip": 250.0}
        ok = (
            j.get("currency") == "EUR"
            and j.get("enabled") is True
            and j.get("custom") == {"min": 5, "max": 500}
            and all(k in pkgs and pkgs[k]["amount"] == v for k, v in wanted.items())
        )
        record(
            "GET /payments/packages content",
            ok,
            f"pkgs={list(pkgs.keys())} custom={j.get('custom')} enabled={j.get('enabled')}",
        )

    # Create checkout session — package starter
    body = {"package_id": "starter", "origin_url": "https://example.com"}
    r = requests.post(
        f"{API}/payments/checkout/session",
        json=body,
        headers=auth(token),
        timeout=20,
    )
    if r.status_code != 200:
        record(
            "POST /payments/checkout/session starter",
            False,
            f"status={r.status_code} body={r.text[:300]}",
        )
        starter_session_id = None
    else:
        j = r.json()
        url = j.get("url", "")
        sid = j.get("session_id", "")
        ok = url.startswith("https://checkout.stripe.com/") and sid.startswith("cs_")
        record(
            "POST /payments/checkout/session starter",
            ok,
            f"url={url[:60]}... session_id={sid[:20]}...",
        )
        starter_session_id = sid

    # Verify Mongo persistence
    if starter_session_id:
        async def check_mongo():
            client = AsyncIOMotorClient("mongodb://localhost:27017")
            db = client["sendbid"]
            tx = await db.payment_transactions.find_one({"session_id": starter_session_id}, {"_id": 0})
            client.close()
            return tx
        tx = asyncio.run(check_mongo())
        ok = (
            tx is not None
            and tx.get("status") == "open"
            and tx.get("payment_status") == "pending"
            and tx.get("credited") is False
            and tx.get("amount") == 20.0
            and tx.get("session_id") == starter_session_id
        )
        record(
            "Mongo payment_transactions doc persisted (starter)",
            ok,
            f"tx={ {k: tx.get(k) for k in ('status','payment_status','credited','amount','session_id')} if tx else None}",
        )

    # Custom amount 7.5 valid
    body = {"amount": 7.5, "origin_url": "https://example.com"}
    r = requests.post(
        f"{API}/payments/checkout/session", json=body, headers=auth(token), timeout=20
    )
    if r.status_code != 200:
        record("POST /checkout/session custom 7.5", False, f"status={r.status_code} body={r.text[:200]}")
    else:
        j = r.json()
        record("POST /checkout/session custom 7.5", "checkout.stripe.com" in j.get("url", ""), f"url_ok=true session_id={j.get('session_id','')[:14]}...")

    # Out of range custom 1000 → 400
    body = {"amount": 1000, "origin_url": "https://example.com"}
    r = requests.post(
        f"{API}/payments/checkout/session", json=body, headers=auth(token), timeout=15
    )
    ok = r.status_code == 400 and "hors limites" in r.text.lower()
    record("POST /checkout/session amount=1000 → 400", ok, f"status={r.status_code} body={r.text[:200]}")

    # No package_id and no amount → 400
    body = {"origin_url": "https://example.com"}
    r = requests.post(
        f"{API}/payments/checkout/session", json=body, headers=auth(token), timeout=15
    )
    ok = r.status_code == 400 and "aucun montant" in r.text.lower()
    record("POST /checkout/session empty → 400", ok, f"status={r.status_code} body={r.text[:200]}")

    # No auth
    r = requests.post(
        f"{API}/payments/checkout/session",
        json={"package_id": "starter", "origin_url": "https://example.com"},
        timeout=15,
    )
    record("POST /checkout/session unauth", r.status_code in (401, 403), f"status={r.status_code}")

    # Status of unpaid session
    if starter_session_id:
        r = requests.get(
            f"{API}/payments/checkout/status/{starter_session_id}",
            headers=auth(token),
            timeout=20,
        )
        if r.status_code != 200:
            record("GET /checkout/status/{id} unpaid", False, f"status={r.status_code} body={r.text[:200]}")
        else:
            j = r.json()
            ok = (
                j.get("payment_status") in ("unpaid", "pending", "open", "no_payment_required")
                and j.get("paid") is False
                and j.get("credited") is False
            )
            record(
                "GET /checkout/status/{id} unpaid",
                ok,
                f"paid={j.get('paid')} payment_status={j.get('payment_status')} credited={j.get('credited')}",
            )

    # Invalid session
    r = requests.get(
        f"{API}/payments/checkout/status/INVALID_SESSION",
        headers=auth(token),
        timeout=15,
    )
    record(
        "GET /checkout/status/INVALID → 404",
        r.status_code == 404,
        f"status={r.status_code} body={r.text[:200]}",
    )

    # Webhook bad signature
    r = requests.post(
        f"{API}/webhook/stripe",
        data=b"",
        headers={"Content-Type": "application/json"},
        timeout=15,
    )
    record(
        "POST /webhook/stripe empty body → 400",
        r.status_code == 400,
        f"status={r.status_code} body={r.text[:200]}",
    )

    r = requests.post(
        f"{API}/webhook/stripe",
        data=b'{"event":"fake"}',
        headers={"Content-Type": "application/json", "Stripe-Signature": "t=1,v1=invalid"},
        timeout=15,
    )
    record(
        "POST /webhook/stripe bad signature → 400",
        r.status_code == 400,
        f"status={r.status_code} body={r.text[:200]}",
    )


# ---------- 3. Regression ----------
def test_regression(token):
    # /auth/me
    r = requests.get(f"{API}/auth/me", headers=auth(token), timeout=10)
    ok = r.status_code == 200 and r.json().get("user", {}).get("email") == "client@sendbid.app"
    record("GET /auth/me", ok, f"status={r.status_code}")

    # wallet
    r = requests.get(f"{API}/wallet", headers=auth(token), timeout=10)
    ok = r.status_code == 200 and "balance" in r.json()
    record("GET /wallet", ok, f"status={r.status_code} balance={r.json().get('balance')}")

    # recharge-qr
    r = requests.post(
        f"{API}/wallet/recharge-qr", json={"amount": 100}, headers=auth(token), timeout=10
    )
    ok = r.status_code == 200 and r.json().get("qr_token")
    record("POST /wallet/recharge-qr 100", ok, f"status={r.status_code}")

    # transfer draft+confirm (non cash to be quick)
    draft_payload = {
        "destination_country": "Côte d'Ivoire",
        "destination_currency": "XOF",
        "send_amount": 50.0,
        "receive_amount": 32797.85,
        "fx_rate": 655.957,
        "fee_percent": 2.0,
        "delivery_mode": "bank",
        "beneficiary": {"full_name": "Kouassi Yao", "phone": "+2250700000000"},
        "delivery_details": {"iban": "CI93CI0080100100110000000000"},
        "purpose": "family_support",
        "source_of_funds": "salary",
        "vip_delivery": False,
    }
    r = requests.post(f"{API}/transfers/draft", json=draft_payload, headers=auth(token), timeout=15)
    if r.status_code != 200:
        record("POST /transfers/draft", False, f"status={r.status_code} body={r.text[:300]}")
        return
    draft = r.json()
    record("POST /transfers/draft", True, f"draft_id={draft['id'][:8]}...")
    r = requests.post(
        f"{API}/transfers/confirm",
        json={"draft_id": draft["id"], "pin": PIN},
        headers=auth(token),
        timeout=15,
    )
    ok = r.status_code == 200 and r.json().get("status") in ("PROCESSING", "BIDDING")
    record(
        "POST /transfers/confirm",
        ok,
        f"status={r.status_code} transfer_status={r.json().get('status') if r.status_code==200 else r.text[:200]}",
    )


def main():
    print(f"BACKEND={BACKEND}\nAPI={API}\n")
    try:
        token = login()
    except Exception as e:
        record("Login demo client", False, str(e))
        summary()
        sys.exit(1)
    record("Login demo client", True, "token acquired")

    test_maps(token)
    test_payments(token)
    test_regression(token)
    test_maps_transfer_route(token)

    summary()


def summary():
    print("\n========= SUMMARY =========")
    passed = sum(1 for _, ok, _ in results if ok)
    total = len(results)
    print(f"Passed {passed}/{total}")
    for label, ok, detail in results:
        flag = "OK" if ok else "FAIL"
        print(f"  [{flag}] {label}")
    print()


if __name__ == "__main__":
    main()
