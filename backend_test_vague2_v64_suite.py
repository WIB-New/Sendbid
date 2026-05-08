"""
Backend test — SENDBID Vague 2 v6.4 (suite)
Tests:
  A) Contacts API (/api/contacts) — GET, POST, DELETE, POST /{id}/report
  B) Payment Methods extended (provider/phone/email)

Login: client@sendbid.app / Client@123!  (no PIN endpoint — login returns Bearer directly).
"""
import os
import sys
import json
import uuid
import requests

BASE = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://mobile-transfer-hub-3.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api"

EMAIL = "client@sendbid.app"
PASSWORD = "Client@123!"

passes = 0
fails = []


def check(label, cond, extra=""):
    global passes
    if cond:
        passes += 1
        print(f"  ✅ {label}")
    else:
        fails.append(f"{label} :: {extra}")
        print(f"  ❌ {label}  {extra}")


def login() -> str:
    r = requests.post(f"{API}/auth/login", json={"identifier": EMAIL, "password": PASSWORD}, timeout=20)
    if r.status_code != 200:
        print(f"FATAL: login failed {r.status_code} {r.text}")
        sys.exit(1)
    body = r.json()
    print(f"[auth] login OK; user role={body.get('user',{}).get('role')} email={body.get('user',{}).get('email')}")
    return body["access_token"]


def main():
    token = login()
    H = {"Authorization": f"Bearer {token}"}

    # ============================================================
    print("\n=== A) Contacts API ===")
    # ============================================================

    # A.1 GET /api/contacts → 200, list
    print("\n[A.1] GET /api/contacts")
    r = requests.get(f"{API}/contacts", headers=H, timeout=20)
    check("HTTP 200", r.status_code == 200, f"got {r.status_code} {r.text[:200]}")
    body = r.json() if r.status_code == 200 else None
    check("Response is a list", isinstance(body, list), f"got type={type(body).__name__}")
    initial_count = len(body) if isinstance(body, list) else 0
    print(f"  initial contact count = {initial_count}")

    # A.2 POST /api/contacts (full payload)
    print("\n[A.2] POST /api/contacts (full)")
    payload = {"full_name": "Mamadou Diop", "profile_id": "SB100123",
               "email": "mamadou@example.com", "phone": "+221771234567"}
    r = requests.post(f"{API}/contacts", headers=H, json=payload, timeout=20)
    check("HTTP 200", r.status_code == 200, f"got {r.status_code} {r.text[:200]}")
    c1 = r.json() if r.status_code == 200 else {}
    check("id generated", bool(c1.get("id")), f"id={c1.get('id')}")
    check("full_name persisted", c1.get("full_name") == "Mamadou Diop", f"got {c1.get('full_name')}")
    check("profile_id persisted", c1.get("profile_id") == "SB100123", f"got {c1.get('profile_id')}")
    check("email persisted", c1.get("email") == "mamadou@example.com", f"got {c1.get('email')}")
    check("phone persisted", c1.get("phone") == "+221771234567", f"got {c1.get('phone')}")
    check("created_at present", bool(c1.get("created_at")), f"got {c1.get('created_at')}")
    cid_full = c1.get("id")

    # A.3 POST /api/contacts (minimal)
    print("\n[A.3] POST /api/contacts (minimal: full_name only)")
    r = requests.post(f"{API}/contacts", headers=H, json={"full_name": "Test Min"}, timeout=20)
    check("HTTP 200", r.status_code == 200, f"got {r.status_code} {r.text[:200]}")
    c2 = r.json() if r.status_code == 200 else {}
    check("id generated", bool(c2.get("id")), f"id={c2.get('id')}")
    check("full_name persisted", c2.get("full_name") == "Test Min", f"got {c2.get('full_name')}")
    cid_min = c2.get("id")

    # A.4 POST /api/contacts/{id}/report — success
    print("\n[A.4] POST /api/contacts/{id}/report")
    r = requests.post(f"{API}/contacts/{cid_full}/report", headers=H,
                      json={"reason": "Test signalement"}, timeout=20)
    check("HTTP 200", r.status_code == 200, f"got {r.status_code} {r.text[:200]}")
    rep = r.json() if r.status_code == 200 else {}
    check("ok=true", rep.get("ok") is True, f"got {rep}")
    check("ticket_id present (uuid-like)", bool(rep.get("ticket_id")) and len(str(rep.get("ticket_id", ""))) >= 16,
          f"ticket_id={rep.get('ticket_id')}")

    # A.5 POST /api/contacts/{nonexistent}/report → 404
    print("\n[A.5] POST /api/contacts/{nonexistent}/report")
    fake_id = f"FAKE_{uuid.uuid4().hex[:12]}"
    r = requests.post(f"{API}/contacts/{fake_id}/report", headers=H, json={"reason": "x"}, timeout=20)
    check("HTTP 404", r.status_code == 404, f"got {r.status_code} {r.text[:200]}")
    if r.status_code == 404:
        try:
            detail = r.json().get("detail", "")
        except Exception:
            detail = ""
        check("detail mentions 'introuvable'", "introuvable" in detail.lower(), f"detail={detail}")

    # A.6 DELETE /api/contacts/{id} for created contact (use cid_min so cid_full survives for GET check)
    print("\n[A.6] DELETE /api/contacts/{id}")
    r = requests.delete(f"{API}/contacts/{cid_min}", headers=H, timeout=20)
    check("HTTP 200", r.status_code == 200, f"got {r.status_code} {r.text[:200]}")
    if r.status_code == 200:
        check("ok=true", r.json().get("ok") is True, f"got {r.json()}")

    # A.7 DELETE /api/contacts/{nonexistent} → 404
    print("\n[A.7] DELETE /api/contacts/{nonexistent}")
    r = requests.delete(f"{API}/contacts/{fake_id}", headers=H, timeout=20)
    check("HTTP 404", r.status_code == 404, f"got {r.status_code} {r.text[:200]}")

    # A.8 GET /api/contacts → cid_full present, cid_min absent
    print("\n[A.8] GET /api/contacts (verify post-mutations)")
    r = requests.get(f"{API}/contacts", headers=H, timeout=20)
    check("HTTP 200", r.status_code == 200, f"got {r.status_code}")
    items = r.json() if r.status_code == 200 else []
    ids = {it.get("id") for it in items if isinstance(it, dict)}
    check("created contact present (cid_full)", cid_full in ids, f"ids sample={list(ids)[:5]}")
    check("deleted contact absent (cid_min)", cid_min not in ids, f"deleted id={cid_min}")
    print(f"  contact count after ops = {len(items)} (was {initial_count})")

    # Cleanup cid_full
    requests.delete(f"{API}/contacts/{cid_full}", headers=H, timeout=20)

    # ============================================================
    print("\n=== B) Payment Methods extended ===")
    # ============================================================

    created_pm_ids = []

    # B.1 momo with provider+phone
    print("\n[B.1] POST /api/payment-methods (momo + provider + phone)")
    payload = {"type": "momo", "provider": "wave", "phone": "+221771234567", "label": "Wave"}
    r = requests.post(f"{API}/payment-methods", headers=H, json=payload, timeout=20)
    check("HTTP 200", r.status_code == 200, f"got {r.status_code} {r.text[:200]}")
    pm1 = r.json() if r.status_code == 200 else {}
    check("id generated", bool(pm1.get("id")), f"id={pm1.get('id')}")
    check("type=momo", pm1.get("type") == "momo", f"got {pm1.get('type')}")
    check("provider persisted = wave", pm1.get("provider") == "wave", f"got {pm1.get('provider')}")
    check("phone persisted = +221771234567", pm1.get("phone") == "+221771234567", f"got {pm1.get('phone')}")
    check("label persisted = Wave", pm1.get("label") == "Wave", f"got {pm1.get('label')}")
    if pm1.get("id"):
        created_pm_ids.append(pm1["id"])

    # B.2 paypal with email
    print("\n[B.2] POST /api/payment-methods (paypal + email)")
    payload = {"type": "paypal", "email": "test@example.com", "label": "PayPal"}
    r = requests.post(f"{API}/payment-methods", headers=H, json=payload, timeout=20)
    check("HTTP 200", r.status_code == 200, f"got {r.status_code} {r.text[:200]}")
    pm2 = r.json() if r.status_code == 200 else {}
    check("type=paypal", pm2.get("type") == "paypal", f"got {pm2.get('type')}")
    check("email persisted = test@example.com", pm2.get("email") == "test@example.com", f"got {pm2.get('email')}")
    check("label persisted = PayPal", pm2.get("label") == "PayPal", f"got {pm2.get('label')}")
    if pm2.get("id"):
        created_pm_ids.append(pm2["id"])

    # B.3 card auto-derived label
    print("\n[B.3] POST /api/payment-methods (card → label auto-derived)")
    payload = {"type": "card", "brand": "Visa", "last4": "4242",
               "exp_month": 12, "exp_year": 2028}
    r = requests.post(f"{API}/payment-methods", headers=H, json=payload, timeout=20)
    check("HTTP 200", r.status_code == 200, f"got {r.status_code} {r.text[:200]}")
    pm3 = r.json() if r.status_code == 200 else {}
    check("type=card", pm3.get("type") == "card", f"got {pm3.get('type')}")
    check("brand=Visa", pm3.get("brand") == "Visa", f"got {pm3.get('brand')}")
    check("last4=4242", pm3.get("last4") == "4242", f"got {pm3.get('last4')}")
    check("label auto-derived = 'Visa •••• 4242'", pm3.get("label") == "Visa •••• 4242", f"got {pm3.get('label')!r}")
    check("exp_month=12", pm3.get("exp_month") == 12, f"got {pm3.get('exp_month')}")
    check("exp_year=2028", pm3.get("exp_year") == 2028, f"got {pm3.get('exp_year')}")
    if pm3.get("id"):
        created_pm_ids.append(pm3["id"])

    # B.4 GET — verify all new fields
    print("\n[B.4] GET /api/payment-methods")
    r = requests.get(f"{API}/payment-methods", headers=H, timeout=20)
    check("HTTP 200", r.status_code == 200, f"got {r.status_code}")
    items = r.json() if r.status_code == 200 else []
    by_id = {it.get("id"): it for it in items if isinstance(it, dict)}
    if pm1.get("id") and pm1["id"] in by_id:
        d = by_id[pm1["id"]]
        check("GET: momo provider field returned", d.get("provider") == "wave", f"got {d.get('provider')}")
        check("GET: momo phone field returned", d.get("phone") == "+221771234567", f"got {d.get('phone')}")
    else:
        check("GET: momo doc retrieved", False, f"missing pm1 {pm1.get('id')}")
    if pm2.get("id") and pm2["id"] in by_id:
        d = by_id[pm2["id"]]
        check("GET: paypal email field returned", d.get("email") == "test@example.com", f"got {d.get('email')}")
    else:
        check("GET: paypal doc retrieved", False, f"missing pm2 {pm2.get('id')}")
    if pm3.get("id") and pm3["id"] in by_id:
        d = by_id[pm3["id"]]
        check("GET: card label persisted", d.get("label") == "Visa •••• 4242", f"got {d.get('label')!r}")
    else:
        check("GET: card doc retrieved", False, f"missing pm3 {pm3.get('id')}")

    # B.5 DELETE
    print("\n[B.5] DELETE /api/payment-methods/{id}")
    for pid in created_pm_ids:
        r = requests.delete(f"{API}/payment-methods/{pid}", headers=H, timeout=20)
        check(f"DELETE {pid[:8]}… → 200", r.status_code == 200, f"got {r.status_code} {r.text[:120]}")
        if r.status_code == 200:
            check("ok=true", r.json().get("ok") is True, f"got {r.json()}")

    # ============================================================
    total = passes + len(fails)
    print("\n" + "=" * 70)
    print(f"RESULT: {passes}/{total} PASS, {len(fails)} FAIL")
    if fails:
        print("\nFailed items:")
        for f in fails:
            print(f"  - {f}")
        sys.exit(1)


if __name__ == "__main__":
    main()
