"""SENDBID Backend tests for Lot 3 (Push notifications + Didit KYC Tier 2) + sanity regression.

Run: python /app/backend_test_lot3.py
"""
from __future__ import annotations

import asyncio
import sys
import time
from typing import Any

import requests
from motor.motor_asyncio import AsyncIOMotorClient

# ---------- Config ----------
ENV_PATH = "/app/frontend/.env"
BACKEND = None
for line in open(ENV_PATH):
    if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
        BACKEND = line.split("=", 1)[1].strip().strip('"')
        break
assert BACKEND, "EXPO_PUBLIC_BACKEND_URL missing"
API = BACKEND.rstrip("/") + "/api"

MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "sendbid"

DEMO = {"identifier": "client@sendbid.app", "password": "Client@123!"}
PIN = "123456"

EXPO_FAKE = "ExponentPushToken[abc-test-12345]"
FCM_FAKE = "abcDEF123:APA91bF_thisIsNotARealFcmToken"

results: list[tuple[str, bool, str]] = []


def record(label: str, ok: bool, detail: str = "") -> None:
    results.append((label, ok, detail))
    flag = "PASS" if ok else "FAIL"
    print(f"[{flag}] {label} -- {detail}")


def login() -> str:
    r = requests.post(f"{API}/auth/login", json=DEMO, timeout=15)
    assert r.status_code == 200, f"login failed {r.status_code} {r.text}"
    return r.json()["access_token"]


def auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def short(body: Any, n: int = 220) -> str:
    s = body if isinstance(body, str) else str(body)
    return s[:n].replace("\n", " ")


async def get_db():
    client = AsyncIOMotorClient(MONGO_URL)
    return client, client[DB_NAME]


# ---------- 1. Push notifications ----------
async def test_push(token: str) -> None:
    client, db = await get_db()
    try:
        # Auth gate (no token)
        r = requests.post(f"{API}/notifications/register-token",
                          json={"token": EXPO_FAKE, "platform": "android"}, timeout=10)
        record("POST /notifications/register-token without auth → 401/403",
               r.status_code in (401, 403), f"status={r.status_code}")

        r = requests.post(f"{API}/notifications/test-push", timeout=10)
        record("POST /notifications/test-push without auth → 401/403",
               r.status_code in (401, 403), f"status={r.status_code}")

        r = requests.post(f"{API}/notifications/unregister-token",
                          json={"token": EXPO_FAKE}, timeout=10)
        record("POST /notifications/unregister-token without auth → 401/403",
               r.status_code in (401, 403), f"status={r.status_code}")

        # Register Expo token
        r = requests.post(f"{API}/notifications/register-token",
                          headers=auth(token),
                          json={"token": EXPO_FAKE, "platform": "android",
                                "device_name": "Test phone"}, timeout=15)
        body = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
        ok = r.status_code == 200 and body.get("ok") is True and body.get("provider") == "expo"
        record("POST /notifications/register-token (Expo token) → 200 provider=expo",
               ok, f"status={r.status_code} body={short(body)}")

        # Idempotent re-register
        r2 = requests.post(f"{API}/notifications/register-token",
                           headers=auth(token),
                           json={"token": EXPO_FAKE, "platform": "android",
                                 "device_name": "Test phone"}, timeout=15)
        body2 = r2.json() if r2.headers.get("content-type", "").startswith("application/json") else {}
        record("Re-register same Expo token (idempotent upsert)",
               r2.status_code == 200 and body2.get("ok") is True,
               f"status={r2.status_code} body={short(body2)}")

        # Verify the token doc in DB
        # First fetch demo user id
        rme = requests.get(f"{API}/auth/me", headers=auth(token), timeout=10)
        me = rme.json() if rme.status_code == 200 else {}
        user_id = (me.get("user") or me).get("id") if isinstance(me, dict) else None
        doc = await db.push_tokens.find_one({"token": EXPO_FAKE}, {"_id": 0})
        record("DB push_tokens has Expo doc (active=True, provider=expo, user_id matches)",
               bool(doc) and doc.get("active") is True and doc.get("provider") == "expo"
               and (user_id is None or doc.get("user_id") == user_id),
               f"doc={short(doc)} user_id={user_id}")

        # Test push (Expo) → expected DeviceNotRegistered, but endpoint must succeed
        r = requests.post(f"{API}/notifications/test-push", headers=auth(token), timeout=20)
        body = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
        sent_count = body.get("sent") if isinstance(body, dict) else None
        results_list = body.get("results") if isinstance(body, dict) else None
        ok = (r.status_code == 200 and body.get("ok") is True
              and isinstance(results_list, list) and sent_count == len(results_list)
              and any((res or {}).get("provider") == "expo" for res in (results_list or [])))
        record("POST /notifications/test-push (Expo only) → 200 with results[provider=expo]",
               ok, f"status={r.status_code} sent={sent_count} results={short(results_list)}")

        # Wait for the auto-deactivation; the service deactivates on common 'notregistered' errors.
        # Expo's response carries 'DeviceNotRegistered' → service lower()s it → contains 'notregistered'.
        await asyncio.sleep(0.5)
        doc_after = await db.push_tokens.find_one({"token": EXPO_FAKE}, {"_id": 0})
        record("Expo token auto-deactivated after DeviceNotRegistered",
               bool(doc_after) and doc_after.get("active") is False,
               f"active={doc_after.get('active') if doc_after else None}")

        # Re-activate by re-registering (so test-push has both expo+fcm to send to)
        # Actually the regression for create_notification side-effect needs a real push attempt.
        # Re-register Expo token to active=True so subsequent test-push has at least 1 token to send.
        requests.post(f"{API}/notifications/register-token",
                      headers=auth(token),
                      json={"token": EXPO_FAKE, "platform": "android"}, timeout=10)

        # Register a fake FCM token
        r = requests.post(f"{API}/notifications/register-token",
                          headers=auth(token),
                          json={"token": FCM_FAKE, "platform": "android"}, timeout=15)
        body = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
        ok = (r.status_code == 200 and body.get("ok") is True and body.get("provider") == "fcm")
        record("POST /notifications/register-token (FCM-style token) → 200 provider=fcm",
               ok, f"status={r.status_code} body={short(body)}")

        # test-push again → should include both expo (failure) and fcm (failure) results without 500
        r = requests.post(f"{API}/notifications/test-push", headers=auth(token), timeout=25)
        body = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
        results_list = body.get("results") if isinstance(body, dict) else []
        providers = {(res or {}).get("provider") for res in (results_list or [])}
        fcm_results = [res for res in (results_list or []) if (res or {}).get("provider") == "fcm"]
        fcm_failed_with_detail = any(
            res.get("ok") is False and isinstance(res.get("detail"), str)
            and any(kw in res["detail"].lower() for kw in [
                "404", "requested entity", "invalidargument", "auth error", "firebase", "permission",
                "not found", "unavailable", "invalid", "messaging"])
            for res in fcm_results
        )
        ok = (r.status_code == 200 and "fcm" in providers
              and (fcm_failed_with_detail or any(res.get("ok") is False for res in fcm_results)))
        record("POST /notifications/test-push (with FCM token) → 200 + per-token result for fcm",
               ok, f"status={r.status_code} providers={providers} fcm_results={short(fcm_results)}")

        # Unregister fake FCM token
        r = requests.post(f"{API}/notifications/unregister-token",
                          headers=auth(token),
                          json={"token": FCM_FAKE, "platform": "android"}, timeout=15)
        body = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
        record("POST /notifications/unregister-token (FCM) → 200 ok=true",
               r.status_code == 200 and body.get("ok") is True,
               f"status={r.status_code} body={short(body)}")
        doc_fcm = await db.push_tokens.find_one({"token": FCM_FAKE}, {"_id": 0})
        record("DB push_tokens FCM doc active=False after unregister",
               bool(doc_fcm) and doc_fcm.get("active") is False,
               f"doc={short(doc_fcm)}")

        # Side-effect regression: trigger create_notification via a transfer flow,
        # and confirm GET /api/notifications still works (push send must NOT block).
        # Make a transfer draft + confirm to generate at least one notification.
        # Get beneficiaries first
        rb = requests.get(f"{API}/beneficiaries", headers=auth(token), timeout=10)
        bens = rb.json() if rb.status_code == 200 else []
        ben_id = bens[0]["id"] if isinstance(bens, list) and bens else None
        if not ben_id:
            # Try to create a beneficiary
            cb = requests.post(f"{API}/beneficiaries", headers=auth(token),
                               json={"full_name": "Aïssatou Diallo", "country": "SN",
                                     "phone": "+221770000000", "relation": "Famille"},
                               timeout=10)
            if cb.status_code in (200, 201):
                ben_id = cb.json().get("id")

        notif_count_before = 0
        rn0 = requests.get(f"{API}/notifications", headers=auth(token), timeout=10)
        if rn0.status_code == 200:
            notif_count_before = len(rn0.json() or [])

        if ben_id:
            draft_payload = {"beneficiary_id": ben_id, "amount": 50.0,
                             "currency": "EUR", "delivery_country": "SN",
                             "delivery_city": "Dakar"}
            rd = requests.post(f"{API}/transfers/draft", headers=auth(token),
                               json=draft_payload, timeout=15)
            draft = rd.json() if rd.status_code in (200, 201) else {}
            draft_id = draft.get("id") or draft.get("transfer_id")
            confirm_payload = {"transfer_id": draft_id, "pin": PIN} if draft_id else None
            if confirm_payload:
                rc = requests.post(f"{API}/transfers/confirm", headers=auth(token),
                                   json=confirm_payload, timeout=20)
                # We don't fail the test on confirm response; we only care about the notif side-effect
                _ = rc.text

        # Now query notifications: must have at least 1 row, not blocked by push failure
        time.sleep(0.5)
        rn = requests.get(f"{API}/notifications", headers=auth(token), timeout=10)
        notifs = rn.json() if rn.status_code == 200 else None
        ok = rn.status_code == 200 and isinstance(notifs, list)
        record("GET /notifications still works after create_notification + push (regression)",
               ok, f"status={rn.status_code} count={len(notifs) if isinstance(notifs, list) else 'NA'} (before={notif_count_before})")
    finally:
        client.close()


# ---------- 2. Didit KYC Tier 2 ----------
async def test_kyc(token: str) -> dict:
    client, db = await get_db()
    out = {"session_id": None, "verification_url": None, "provider": None}
    try:
        # Auth gate
        r = requests.post(f"{API}/kyc/tier2/start", timeout=15)
        record("POST /kyc/tier2/start without auth → 401/403",
               r.status_code in (401, 403), f"status={r.status_code}")

        r = requests.get(f"{API}/kyc/tier2/status/anything", timeout=15)
        record("GET /kyc/tier2/status without auth → 401/403",
               r.status_code in (401, 403), f"status={r.status_code}")

        # Start a real Didit session
        r = requests.post(f"{API}/kyc/tier2/start", headers=auth(token), timeout=30)
        body = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
        session_id = body.get("session_id") if isinstance(body, dict) else None
        verification_url = body.get("verification_url") if isinstance(body, dict) else None
        provider = body.get("provider") if isinstance(body, dict) else None
        out.update({"session_id": session_id, "verification_url": verification_url, "provider": provider})

        ok = (r.status_code == 200
              and provider == "didit"
              and bool(session_id) and len(str(session_id)) >= 16
              and isinstance(verification_url, str)
              and verification_url.startswith("https://verify.didit.me/session/"))
        record("POST /kyc/tier2/start → 200 provider=didit + verify.didit.me URL",
               ok, f"status={r.status_code} provider={provider} session_id={session_id} url={verification_url}")

        # Status string presence
        record("Start response includes 'status' (Didit status label)",
               isinstance(body.get("status"), str) and body.get("status"),
               f"status_label={body.get('status')}")

        # DB doc kyc_sessions
        rme = requests.get(f"{API}/auth/me", headers=auth(token), timeout=10)
        me = rme.json() if rme.status_code == 200 else {}
        user_id = (me.get("user") or me).get("id") if isinstance(me, dict) else None
        if session_id:
            doc = await db.kyc_sessions.find_one({"id": session_id}, {"_id": 0})
            ok = (doc is not None and doc.get("provider") == "didit"
                  and doc.get("status") == "pending"
                  and (user_id is None or doc.get("user_id") == user_id))
            record("DB kyc_sessions doc inserted (provider=didit, status=pending, user_id ok)",
                   ok, f"doc={short(doc)}")

        # Status of fresh session (real call to Didit)
        if session_id:
            r = requests.get(f"{API}/kyc/tier2/status/{session_id}",
                             headers=auth(token), timeout=30)
            body = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
            ok = (r.status_code == 200
                  and isinstance(body.get("status"), str)
                  and body.get("approved") is False
                  and body.get("promoted") is False)
            record("GET /kyc/tier2/status/{fresh} → 200 status set, approved=false, promoted=false",
                   ok, f"status={r.status_code} body={short(body)}")

        # Invalid session id
        r = requests.get(f"{API}/kyc/tier2/status/INVALID_FAKE_SESSION_ID",
                         headers=auth(token), timeout=15)
        body = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
        record("GET /kyc/tier2/status/INVALID → 404 'Session introuvable'",
               r.status_code == 404 and "introuvable" in (body.get("detail") or "").lower(),
               f"status={r.status_code} body={short(body)}")

        # Webhook empty body / non-JSON
        r = requests.post(f"{API}/kyc/tier2/webhook", data="", timeout=10)
        body = r.json() if r.headers.get("content-type", "").startswith("application/json") else r.text
        record("POST /kyc/tier2/webhook empty body → 400 'Payload invalide'",
               r.status_code == 400 and ("invalide" in str(body).lower() or "payload" in str(body).lower()),
               f"status={r.status_code} body={short(body)}")

        # Webhook JSON without session_id
        r = requests.post(f"{API}/kyc/tier2/webhook", json={"foo": "bar"}, timeout=10)
        body = r.json() if r.headers.get("content-type", "").startswith("application/json") else r.text
        record("POST /kyc/tier2/webhook {foo:bar} → 400 'session_id manquant'",
               r.status_code == 400 and "session_id" in str(body).lower(),
               f"status={r.status_code} body={short(body)}")

        # Webhook unknown session_id
        r = requests.post(f"{API}/kyc/tier2/webhook",
                          json={"session_id": "unknown-fake-12345", "status": "Approved"},
                          timeout=10)
        body = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
        record("POST /kyc/tier2/webhook unknown session → 200 ignored=true",
               r.status_code == 200 and body.get("ok") is True and body.get("ignored") is True,
               f"status={r.status_code} body={short(body)}")

        # Webhook with a real session_id and Approved → must promote user to tier 2
        if session_id:
            r = requests.post(f"{API}/kyc/tier2/webhook",
                              json={"session_id": session_id, "status": "Approved"},
                              timeout=15)
            body = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
            ok = (r.status_code == 200 and body.get("ok") is True
                  and body.get("session_id") == session_id
                  and (body.get("status") or "").lower() == "approved")
            record("POST /kyc/tier2/webhook with real session+Approved → 200 ok",
                   ok, f"status={r.status_code} body={short(body)}")

            # Verify user promoted
            time.sleep(0.5)
            rme = requests.get(f"{API}/auth/me", headers=auth(token), timeout=10)
            me = rme.json() if rme.status_code == 200 else {}
            user = me.get("user") or me if isinstance(me, dict) else {}
            kyc_tier = user.get("kyc_tier")
            kyc_status = user.get("kyc_status")
            record("After webhook: GET /auth/me → user.kyc_tier == 2 + kyc_status verified",
                   kyc_tier == 2 and kyc_status == "verified",
                   f"kyc_tier={kyc_tier} kyc_status={kyc_status}")
    finally:
        client.close()
    return out


# ---------- 3. Sanity regression ----------
def test_sanity(token: str) -> None:
    # Demo login already done; re-test a fresh login
    r = requests.post(f"{API}/auth/login", json=DEMO, timeout=15)
    record("POST /auth/login demo (sanity)", r.status_code == 200,
           f"status={r.status_code}")

    r = requests.get(f"{API}/maps/config", headers=auth(token), timeout=15)
    body = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
    record("GET /maps/config → 200 enabled+modes",
           r.status_code == 200 and isinstance(body, dict) and body.get("enabled") is not None,
           f"status={r.status_code} body={short(body)}")

    r = requests.post(f"{API}/payments/checkout/session", headers=auth(token),
                      json={"package_id": "starter", "origin_url": "https://example.com"},
                      timeout=20)
    body = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
    ok = (r.status_code == 200 and isinstance(body, dict)
          and isinstance(body.get("url"), str)
          and "checkout.stripe.com" in body.get("url", "")
          and body.get("session_id"))
    record("POST /payments/checkout/session starter → 200 + checkout.stripe.com url",
           ok, f"status={r.status_code} body={short(body)}")


def main() -> int:
    print(f"Backend: {API}")
    token = login()
    print(f"Logged in as demo. Token len={len(token)}")
    asyncio.run(test_push(token))
    didit_out = asyncio.run(test_kyc(token))
    test_sanity(token)
    if didit_out.get("verification_url"):
        print(f"\nDIDIT verification_url returned: {didit_out['verification_url']}")
    print("\n========== SUMMARY ==========")
    passed = sum(1 for _, ok, _ in results if ok)
    failed = [(label, detail) for label, ok, detail in results if not ok]
    print(f"PASSED: {passed}/{len(results)}")
    if failed:
        print("FAILED:")
        for label, detail in failed:
            print(f"  - {label} :: {detail}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
