"""Focused re-test for Stripe status endpoint fix."""
import json
import requests

ENV_PATH = "/app/frontend/.env"
BACKEND = None
for line in open(ENV_PATH):
    if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
        BACKEND = line.split("=", 1)[1].strip().strip('"')
        break
assert BACKEND, "EXPO_PUBLIC_BACKEND_URL missing"
API = BACKEND.rstrip("/") + "/api"

DEMO = {"identifier": "client@sendbid.app", "password": "Client@123!"}

results = []
def record(label, ok, detail=""):
    results.append((label, ok, detail))
    print(f"[{'PASS' if ok else 'FAIL'}] {label} :: {detail}")

# Login
r = requests.post(f"{API}/auth/login", json=DEMO, timeout=15)
assert r.status_code == 200, r.text
token = r.json()["access_token"]
H = {"Authorization": f"Bearer {token}"}
print(f"Logged in. user={r.json().get('user',{}).get('email')}")

# 1. Packages regression
r = requests.get(f"{API}/payments/packages", headers=H, timeout=15)
ok = r.status_code == 200
data = r.json() if ok else {}
pkgs = data.get("packages") or []
record("GET /payments/packages",
       ok and len(pkgs) == 4,
       f"status={r.status_code} pkgs={len(pkgs)} ids={[p.get('id') for p in pkgs]}")

# 2. Bad amount regression
r = requests.post(f"{API}/payments/checkout/session",
                  json={"amount": 1, "origin_url": "https://example.com"},
                  headers=H, timeout=20)
record("POST /payments/checkout/session amount=1 → 400",
       r.status_code == 400,
       f"status={r.status_code} body={r.text[:160]}")

# 3. Create fresh session for status test
r = requests.post(f"{API}/payments/checkout/session",
                  json={"package_id": "starter", "origin_url": "https://example.com"},
                  headers=H, timeout=30)
ok_create = r.status_code == 200
session_id = None
if ok_create:
    body = r.json()
    session_id = body.get("session_id")
record("POST /payments/checkout/session starter",
       ok_create and bool(session_id),
       f"status={r.status_code} session_id={session_id} url_prefix={(r.json().get('url') or '')[:50] if ok_create else r.text[:160]}")

# 4. Status of fresh unpaid session — should be 200, NOT 500
if session_id:
    r = requests.get(f"{API}/payments/checkout/status/{session_id}", headers=H, timeout=30)
    body_text = r.text
    body_json = None
    try:
        body_json = r.json()
    except Exception:
        pass
    print("STATUS RESPONSE BODY (verbatim):")
    print(json.dumps(body_json, indent=2, default=str) if body_json else body_text)

    checks = []
    if r.status_code == 200 and body_json:
        checks.append(("status=200", True))
        checks.append(("paid is False", body_json.get("paid") is False))
        checks.append(("credited is False", body_json.get("credited") is False))
        checks.append(("amount==20.0", float(body_json.get("amount", 0)) == 20.0))
        checks.append(("currency==EUR", (body_json.get("currency") or "").upper() == "EUR"))
        checks.append(("payment_status set", bool(body_json.get("payment_status"))))
        checks.append(("fallback or stripe-shape",
                       body_json.get("fallback") is True
                       or body_json.get("status") in ("open", "complete", "expired", "pending")))
    else:
        checks.append((f"status=200 (got {r.status_code})", False))

    all_ok = all(c[1] for c in checks)
    record("GET /payments/checkout/status/{session_id} fresh session NOT 500",
           all_ok,
           "; ".join(f"{n}={'OK' if v else 'FAIL'}" for n, v in checks))

# 5. Status of unknown session id → 404
r = requests.get(f"{API}/payments/checkout/status/INVALID_DOES_NOT_EXIST", headers=H, timeout=15)
detail = ""
try:
    detail = r.json().get("detail", "")
except Exception:
    detail = r.text[:120]
record("GET /payments/checkout/status/INVALID_... → 404",
       r.status_code == 404,
       f"status={r.status_code} detail={detail}")

# 6. Webhook empty body → 400
r = requests.post(f"{API}/webhook/stripe", data="", timeout=15)
record("POST /webhook/stripe empty body → 400",
       r.status_code == 400,
       f"status={r.status_code} body={r.text[:160]}")

print("\n=== SUMMARY ===")
passed = sum(1 for _, ok, _ in results if ok)
print(f"{passed}/{len(results)} passed")
for label, ok, detail in results:
    print(f"  {'PASS' if ok else 'FAIL'} :: {label}")
