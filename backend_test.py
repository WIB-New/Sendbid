"""SENDBID — Backend tests for PayPal Sandbox + Cash QR PIN requirement (P0/P1/P2/P3 batch).

Endpoints under test:
  1. POST /api/wallet/recharge-qr     (PIN now mandatory)
  2. POST /api/paypal/order
  3. POST /api/paypal/capture          (errors before approval only)
  4. GET  /api/paypal/return
  5. GET  /api/paypal/cancel
  6. POST /api/wallet/withdraw         (PIN regression check)

Auth: client@sendbid.app / Client@123! / PIN 123456
Base: EXPO_PUBLIC_BACKEND_URL from /app/frontend/.env, suffixed with /api
"""
import os
import re
import sys
import json
from typing import Dict

import requests
from pymongo import MongoClient

# --- Config ---
FRONTEND_ENV = "/app/frontend/.env"
BACKEND_URL = None
with open(FRONTEND_ENV) as f:
    for line in f:
        if line.startswith("EXPO_PUBLIC_BACKEND_URL"):
            BACKEND_URL = line.strip().split("=", 1)[1].strip().strip('"').strip("'")
            break
assert BACKEND_URL, "EXPO_PUBLIC_BACKEND_URL not found"
API = f"{BACKEND_URL}/api"
print(f"[CFG] API base = {API}")

# Load backend env for Mongo + PayPal creds verification
BACKEND_ENV = "/app/backend/.env"
env_vars = {}
with open(BACKEND_ENV) as f:
    for line in f:
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        env_vars[k.strip()] = v.strip().strip('"').strip("'")

MONGO_URL = env_vars.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = env_vars.get("DB_NAME", "sendbid")
PAYPAL_CLIENT_ID = env_vars.get("PAYPAL_CLIENT_ID", "")
PAYPAL_SECRET = env_vars.get("PAYPAL_SECRET", "")

mongo = MongoClient(MONGO_URL)
db = mongo[DB_NAME]

EMAIL = "client@sendbid.app"
PWD = "Client@123!"
PIN = "123456"

results = []  # list of (name, ok, detail)


def record(name: str, ok: bool, detail: str = ""):
    status = "PASS" if ok else "FAIL"
    print(f"[{status}] {name} :: {detail}")
    results.append((name, ok, detail))


def login() -> str:
    r = requests.post(f"{API}/auth/login", json={"identifier": EMAIL, "password": PWD}, timeout=20)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


def auth(token: str) -> Dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def jdetail(r):
    try:
        return r.json().get("detail", "")
    except Exception:
        return r.text


# =========================================================
# 1) POST /api/wallet/recharge-qr — PIN obligatoire
# =========================================================
def test_recharge_qr(token: str):
    print("\n=== 1) /wallet/recharge-qr (PIN mandatory) ===")

    # Case A: no pin
    r = requests.post(f"{API}/wallet/recharge-qr", json={"amount": 50}, headers=auth(token), timeout=20)
    d = jdetail(r)
    record(
        "1A) recharge-qr without pin -> 400",
        r.status_code == 400 and "PIN" in str(d) and "6 chiffres" in str(d),
        f"status={r.status_code} detail={d!r}",
    )

    # Case B: pin too short
    r = requests.post(f"{API}/wallet/recharge-qr", json={"amount": 50, "pin": "123"}, headers=auth(token), timeout=20)
    d = jdetail(r)
    record(
        "1B) recharge-qr with pin='123' -> 400",
        r.status_code == 400,
        f"status={r.status_code} detail={d!r}",
    )

    # Case C: wrong pin
    r = requests.post(f"{API}/wallet/recharge-qr", json={"amount": 50, "pin": "999999"}, headers=auth(token), timeout=20)
    d = jdetail(r)
    record(
        "1C) recharge-qr with pin='999999' -> 401",
        r.status_code == 401 and "incorrect" in str(d).lower(),
        f"status={r.status_code} detail={d!r}",
    )

    # Case D: success
    r = requests.post(f"{API}/wallet/recharge-qr", json={"amount": 50, "pin": PIN}, headers=auth(token), timeout=20)
    body = {}
    try:
        body = r.json()
    except Exception:
        pass
    keys_ok = all(k in body for k in ("qr_token", "expires_at", "amount", "deposit_id"))
    record(
        "1D) recharge-qr with valid pin -> 200 + required keys",
        r.status_code == 200 and keys_ok and body.get("amount") == 50,
        f"status={r.status_code} keys={list(body.keys())}",
    )

    if r.status_code == 200 and body.get("deposit_id"):
        doc = db.cash_deposits.find_one({"id": body["deposit_id"]})
        record(
            "1D.2) cash_deposits doc created with status='PENDING'",
            doc is not None and doc.get("status") == "PENDING" and doc.get("amount") == 50,
            f"doc.status={doc.get('status') if doc else 'MISSING'} doc.amount={doc.get('amount') if doc else None}",
        )


# =========================================================
# 2) POST /api/paypal/order
# =========================================================
def test_paypal_order(token: str):
    print("\n=== 2) /paypal/order ===")

    # Auth required
    r = requests.post(f"{API}/paypal/order", json={"amount": 50}, timeout=20)
    record(
        "2.AUTH) /paypal/order without Bearer -> 401/403",
        r.status_code in (401, 403),
        f"status={r.status_code}",
    )

    # Case A: amount=0
    r = requests.post(f"{API}/paypal/order", json={"amount": 0}, headers=auth(token), timeout=20)
    d = jdetail(r)
    record(
        "2A) /paypal/order amount=0 -> 400 Montant invalide",
        r.status_code == 400 and "invalide" in str(d).lower(),
        f"status={r.status_code} detail={d!r}",
    )

    # Case A2: amount negative
    r = requests.post(f"{API}/paypal/order", json={"amount": -10}, headers=auth(token), timeout=20)
    d = jdetail(r)
    record(
        "2A2) /paypal/order amount=-10 -> 400",
        r.status_code == 400,
        f"status={r.status_code} detail={d!r}",
    )

    # Case B: amount too big
    r = requests.post(f"{API}/paypal/order", json={"amount": 10000}, headers=auth(token), timeout=20)
    d = jdetail(r)
    record(
        "2B) /paypal/order amount=10000 -> 400 Montant maximum: 5000 EUR",
        r.status_code == 400 and "5000" in str(d),
        f"status={r.status_code} detail={d!r}",
    )

    # Case C: amount=50 success
    r = requests.post(f"{API}/paypal/order", json={"amount": 50}, headers=auth(token), timeout=45)
    try:
        body = r.json()
    except Exception:
        body = {}
    ok_status = r.status_code == 200
    record(
        "2C) /paypal/order amount=50 -> 200",
        ok_status,
        f"status={r.status_code} body={json.dumps(body)[:300]}",
    )
    if not ok_status:
        return None

    keys = set(body.keys())
    expected = {"order_id", "approve_url", "amount", "fee", "total"}
    record(
        "2C.1) response has all expected keys",
        expected.issubset(keys),
        f"keys={sorted(keys)}",
    )
    record(
        "2C.2) fee == 0.25 (0.5% of 50)",
        abs(body.get("fee", -1) - 0.25) < 0.01,
        f"fee={body.get('fee')}",
    )
    record(
        "2C.3) total == 50.25",
        abs(body.get("total", -1) - 50.25) < 0.01,
        f"total={body.get('total')}",
    )
    approve_url = body.get("approve_url", "") or ""
    record(
        "2C.4) approve_url starts with sandbox.paypal.com/checkoutnow",
        approve_url.startswith("https://www.sandbox.paypal.com/checkoutnow"),
        f"approve_url={approve_url[:120]}",
    )
    order_id = body.get("order_id", "") or ""
    record(
        "2C.5) order_id alphanumeric and reasonable length (~17 chars)",
        bool(re.match(r"^[A-Z0-9]{10,30}$", order_id)),
        f"order_id={order_id} len={len(order_id)}",
    )

    # Verify Mongo paypal_orders has CREATED doc
    doc = db.paypal_orders.find_one({"id": order_id})
    record(
        "2C.6) paypal_orders doc persisted with status='CREATED'",
        doc is not None and doc.get("status") == "CREATED" and doc.get("amount") == 50,
        f"doc.status={doc.get('status') if doc else 'MISSING'} doc.total={doc.get('total') if doc else None}",
    )

    return order_id


def test_paypal_creds_oauth():
    print("\n=== 2.bis) PayPal OAuth token (creds loaded from .env) ===")
    record(
        "2.ENV) PAYPAL_CLIENT_ID and PAYPAL_SECRET present in .env",
        bool(PAYPAL_CLIENT_ID) and bool(PAYPAL_SECRET),
        f"client_id_len={len(PAYPAL_CLIENT_ID)} secret_len={len(PAYPAL_SECRET)}",
    )
    try:
        r = requests.post(
            "https://api-m.sandbox.paypal.com/v1/oauth2/token",
            auth=(PAYPAL_CLIENT_ID, PAYPAL_SECRET),
            data={"grant_type": "client_credentials"},
            headers={"Accept": "application/json"},
            timeout=20,
        )
        ok = r.status_code == 200 and "access_token" in r.json()
        record(
            "2.ENV.2) Sandbox OAuth token retrievable from PayPal",
            ok,
            f"status={r.status_code}",
        )
    except Exception as e:
        record("2.ENV.2) Sandbox OAuth token retrievable from PayPal", False, f"exc={e}")


# =========================================================
# 3) POST /api/paypal/capture
# =========================================================
def test_paypal_capture(token, order_id_for_402):
    print("\n=== 3) /paypal/capture ===")

    # Case A: pin missing or empty
    r = requests.post(
        f"{API}/paypal/capture",
        json={"order_id": "FAKE_ORDER_ID", "pin": ""},
        headers=auth(token), timeout=20,
    )
    d = jdetail(r)
    record(
        "3A) /paypal/capture with empty pin -> 400 Code PIN à 6 chiffres requis",
        r.status_code == 400 and "PIN" in str(d) and "6 chiffres" in str(d),
        f"status={r.status_code} detail={d!r}",
    )

    # Variant: missing pin field entirely
    r = requests.post(
        f"{API}/paypal/capture",
        json={"order_id": "FAKE_ORDER_ID"},
        headers=auth(token), timeout=20,
    )
    d = jdetail(r)
    record(
        "3A.bis) /paypal/capture without pin field -> 400 or 422",
        r.status_code in (400, 422),
        f"status={r.status_code} detail={d!r}",
    )

    # Case C: invalid pin (hits PIN check before order lookup)
    r = requests.post(
        f"{API}/paypal/capture",
        json={"order_id": "DOESNOTEXIST_XYZ_999", "pin": "999999"},
        headers=auth(token), timeout=20,
    )
    d = jdetail(r)
    record(
        "3C) /paypal/capture with invalid pin -> 401",
        r.status_code == 401,
        f"status={r.status_code} detail={d!r}",
    )

    # Case B: order_id inexistant (with valid PIN)
    r = requests.post(
        f"{API}/paypal/capture",
        json={"order_id": "NONEXISTENT_ORDER_99999", "pin": PIN},
        headers=auth(token), timeout=20,
    )
    d = jdetail(r)
    record(
        "3B) /paypal/capture with unknown order_id -> 404 Commande PayPal introuvable",
        r.status_code == 404 and "introuvable" in str(d).lower(),
        f"status={r.status_code} detail={d!r}",
    )

    # Case D: order exists but NOT approved
    if order_id_for_402:
        r = requests.post(
            f"{API}/paypal/capture",
            json={"order_id": order_id_for_402, "pin": PIN},
            headers=auth(token), timeout=45,
        )
        d = jdetail(r)
        record(
            "3D) /paypal/capture on UN-approved order -> 402 paiement non finalisé",
            r.status_code == 402,
            f"status={r.status_code} detail={d!r}",
        )


# =========================================================
# 4) GET /api/paypal/return and /cancel
# =========================================================
def test_paypal_return_cancel():
    print("\n=== 4) /paypal/return & /paypal/cancel ===")

    r = requests.get(f"{API}/paypal/return?token=TESTTOKEN&PayerID=TESTPAYER", timeout=20)
    html = r.text
    record(
        "4A) GET /paypal/return -> 200 + HTML with checkmark icon",
        r.status_code == 200 and "✓" in html and "Paiement approuvé" in html,
        f"status={r.status_code} ct={r.headers.get('content-type','')}",
    )

    r = requests.get(f"{API}/paypal/cancel", timeout=20)
    html = r.text
    record(
        "4B) GET /paypal/cancel -> 200 + 'Paiement annulé'",
        r.status_code == 200 and "Paiement annulé" in html,
        f"status={r.status_code} ct={r.headers.get('content-type','')}",
    )


# =========================================================
# 5) POST /api/wallet/withdraw — regression PIN
# =========================================================
def test_wallet_withdraw(token: str):
    print("\n=== 5) /wallet/withdraw (regression) ===")
    r = requests.post(
        f"{API}/wallet/withdraw",
        json={
            "amount": 10,
            "method": "bank",
            "pin": PIN,
            "details": {"iban": "FR7630006000011234567890189", "holder": "Demo Client"},
        },
        headers=auth(token), timeout=20,
    )
    try:
        body = r.json()
    except Exception:
        body = {}
    record(
        "5D) withdraw with valid pin + IBAN/holder -> 200",
        r.status_code == 200 and body.get("ok") is True and "tx_id" in body and "payout_id" in body,
        f"status={r.status_code} body={json.dumps(body)[:200]}",
    )


# =========================================================
def main():
    print(f"[CFG] Backend URL = {BACKEND_URL}")
    token = login()
    print(f"[OK] login client@sendbid.app -> token len={len(token)}")

    test_paypal_creds_oauth()
    test_recharge_qr(token)
    order_id = test_paypal_order(token)
    test_paypal_capture(token, order_id)
    test_paypal_return_cancel()
    test_wallet_withdraw(token)

    print("\n" + "=" * 60)
    passed = sum(1 for _, ok, _ in results if ok)
    total = len(results)
    print(f"RESULTS: {passed}/{total} PASS")
    failed = [(n, d) for n, ok, d in results if not ok]
    if failed:
        print("\nFAILED:")
        for n, d in failed:
            print(f"  - {n} :: {d}")
        sys.exit(1)
    sys.exit(0)


if __name__ == "__main__":
    main()
