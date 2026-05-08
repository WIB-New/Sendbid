"""
Backend tests for SENDBID Vague 2 v6.4:
- Beneficiaries enriched (IBAN, MoMo, address, default_delivery_mode, favorite)
- Transfers extend-pickup
- Receipt PDF accepts ?token= query param
"""
import os
import sys
import json
import requests

BASE = os.environ.get("BACKEND_URL", "https://mobile-transfer-hub-3.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api"

CLIENT_EMAIL = "client@sendbid.app"
CLIENT_PASSWORD = "Client@123!"
CLIENT_PIN = "123456"

PASS = []
FAIL = []

def ok(name, msg=""):
    print(f"✅ {name}{(' — ' + msg) if msg else ''}")
    PASS.append(name)

def ko(name, msg=""):
    print(f"❌ {name}{(' — ' + msg) if msg else ''}")
    FAIL.append((name, msg))


def login() -> str:
    r = requests.post(f"{API}/auth/login", json={"identifier": CLIENT_EMAIL, "password": CLIENT_PASSWORD}, timeout=20)
    r.raise_for_status()
    j = r.json()
    return j.get("access_token") or j.get("token")


def H(token: str) -> dict:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def section(title):
    print("\n" + "=" * 80)
    print(title)
    print("=" * 80)


# ============================================================================
# A) BENEFICIARIES
# ============================================================================
def test_beneficiaries(token: str):
    section("A) Beneficiaries enriched")
    headers = H(token)

    created_ids = []

    # A.1.a Bank full payload
    bank_payload = {
        "full_name": "Jean Dupont",
        "first_name": "Jean",
        "last_name": "Dupont",
        "email": "jean@test.fr",
        "phone": "+221771234567",
        "country": "SN",
        "city": "Dakar",
        "address": "12 Rue Test",
        "po_box": "BP 1234",
        "relation": "Famille",
        "default_delivery_mode": "bank",
        "bank_name": "Société Générale",
        "iban": "SN08SG12345678901234567890",
        "bic_swift": "SGSNSNDA",
    }
    r = requests.post(f"{API}/beneficiaries", json=bank_payload, headers=headers, timeout=20)
    if r.status_code == 200:
        d = r.json()
        # Verify all fields persisted
        missing = []
        for k in ("full_name", "first_name", "last_name", "email", "phone", "country", "city", "address",
                  "po_box", "relation", "default_delivery_mode", "bank_name", "iban", "bic_swift"):
            if d.get(k) != bank_payload.get(k):
                missing.append(f"{k}={d.get(k)!r} expected {bank_payload.get(k)!r}")
        if d.get("favorite") is not False:
            missing.append(f"favorite={d.get('favorite')!r} expected False")
        if missing:
            ko("A.1.a Bank full payload", f"persistence issues: {missing}")
        else:
            ok("A.1.a Bank full payload", f"id={d.get('id')[:8]}")
            created_ids.append(("bank", d["id"]))
    else:
        ko("A.1.a Bank full payload", f"HTTP {r.status_code}: {r.text[:300]}")

    # A.1.b MoMo full payload
    momo_payload = {
        "full_name": "Aïcha Diop",
        "phone": "+221772345678",
        "country": "SN",
        "city": "Thiès",
        "default_delivery_mode": "momo",
        "momo_operator": "wave",
        "momo_phone": "+221772345678",
        "relation": "Ami",
    }
    r = requests.post(f"{API}/beneficiaries", json=momo_payload, headers=headers, timeout=20)
    if r.status_code == 200:
        d = r.json()
        if d.get("default_delivery_mode") == "momo" and d.get("momo_operator") == "wave" \
                and d.get("momo_phone") == "+221772345678" and d.get("momo_number") == "+221772345678":
            ok("A.1.b MoMo full payload", f"momo_phone & momo_number alias filled")
            created_ids.append(("momo", d["id"]))
        else:
            ko("A.1.b MoMo full payload",
               f"momo_operator={d.get('momo_operator')} momo_phone={d.get('momo_phone')} momo_number={d.get('momo_number')}")
    else:
        ko("A.1.b MoMo full payload", f"HTTP {r.status_code}: {r.text[:300]}")

    # A.1.c Minimal payload (currency optional)
    minimal_payload = {
        "full_name": "Test Min",
        "country": "SN",
        "phone": "+221773456789",
    }
    r = requests.post(f"{API}/beneficiaries", json=minimal_payload, headers=headers, timeout=20)
    if r.status_code == 200:
        d = r.json()
        ok("A.1.c Minimal payload (currency optional)", f"id={d.get('id')[:8]} currency={d.get('currency')!r}")
        created_ids.append(("min", d["id"]))
    else:
        ko("A.1.c Minimal payload", f"HTTP {r.status_code}: {r.text[:300]}")

    # A.2 toggle-favorite twice
    if created_ids:
        bid = created_ids[0][1]
        r1 = requests.post(f"{API}/beneficiaries/{bid}/toggle-favorite", headers=headers, timeout=20)
        r2 = requests.post(f"{API}/beneficiaries/{bid}/toggle-favorite", headers=headers, timeout=20)
        if r1.status_code == 200 and r2.status_code == 200:
            v1 = r1.json().get("favorite")
            v2 = r2.json().get("favorite")
            if v1 is True and v2 is False:
                ok("A.2 toggle-favorite alternates", f"true→false")
            else:
                ko("A.2 toggle-favorite alternates", f"got {v1} then {v2}")
        else:
            ko("A.2 toggle-favorite", f"r1={r1.status_code} r2={r2.status_code}")
    else:
        ko("A.2 toggle-favorite", "no beneficiary id available")

    # A.3 GET /beneficiaries — verify enriched fields returned
    r = requests.get(f"{API}/beneficiaries", headers=headers, timeout=20)
    if r.status_code == 200:
        lst = r.json()
        # find the bank one
        bank_doc = next((b for b in lst if b.get("iban") == "SN08SG12345678901234567890"), None)
        momo_doc = next((b for b in lst if b.get("momo_operator") == "wave"), None)
        if bank_doc and bank_doc.get("address") == "12 Rue Test" and bank_doc.get("bic_swift") == "SGSNSNDA":
            ok("A.3.a GET beneficiaries — bank fields persisted",
               f"iban+address+bic_swift returned")
        else:
            ko("A.3.a GET beneficiaries — bank fields", f"bank_doc keys: {list(bank_doc.keys()) if bank_doc else 'NOT FOUND'}")
        if momo_doc and momo_doc.get("momo_operator") == "wave":
            ok("A.3.b GET beneficiaries — momo fields persisted")
        else:
            ko("A.3.b GET beneficiaries — momo fields", f"momo_doc: {momo_doc}")
    else:
        ko("A.3 GET beneficiaries", f"HTTP {r.status_code}")

    # A.4 DELETE
    if created_ids:
        for label, bid in created_ids:
            r = requests.delete(f"{API}/beneficiaries/{bid}", headers=headers, timeout=20)
            if r.status_code == 200 and r.json().get("ok") is True:
                ok(f"A.4 DELETE beneficiary ({label})")
            else:
                ko(f"A.4 DELETE beneficiary ({label})", f"HTTP {r.status_code}: {r.text[:200]}")


# ============================================================================
# B) TRANSFER EXTEND-PICKUP
# ============================================================================
def find_or_create_cash_transfer(token: str) -> str:
    """Find an existing active cash transfer, or create a new one."""
    headers = H(token)
    # Look for existing cash transfer that is not COMPLETED/FAILED/CANCELLED
    r = requests.get(f"{API}/transfers?limit=50", headers=headers, timeout=20)
    if r.status_code == 200:
        for t in r.json():
            if (t.get("delivery_mode") == "cash" and
                    t.get("status") not in ("COMPLETED", "FAILED", "CANCELLED_USER", "EXPIRED")):
                print(f"   found existing cash transfer {t['id'][:8]} status={t['status']}")
                return t["id"]

    # Create one
    print("   creating fresh cash transfer (CI corridor)...")
    draft_payload = {
        "destination_country": "CI",
        "destination_currency": "XOF",
        "send_amount": 5.0,
        "receive_amount": round(5.0 * 655.957, 2),
        "fx_rate": 655.957,
        "fee_percent": 2.0,
        "delivery_mode": "cash",
        "beneficiary": {
            "full_name": "Cash Pickup Test",
            "country": "CI",
            "city": "Abidjan",
            "phone": "+22501020304",
        },
        "purpose": "family_support",
        "source_of_funds": "salary",
        "vip_delivery": False,
    }
    r = requests.post(f"{API}/transfers/draft", json=draft_payload, headers=headers, timeout=20)
    if r.status_code != 200:
        raise RuntimeError(f"draft failed: {r.status_code} {r.text[:300]}")
    draft_id = r.json()["id"]

    r = requests.post(f"{API}/transfers/confirm",
                      json={"draft_id": draft_id, "pin": CLIENT_PIN},
                      headers=headers, timeout=20)
    if r.status_code != 200:
        raise RuntimeError(f"confirm failed: {r.status_code} {r.text[:300]}")
    transfer_id = r.json()["id"]
    print(f"   created cash transfer {transfer_id[:8]}")
    return transfer_id


def find_or_create_completed_or_non_cash_transfer(token: str, want_non_cash=False, want_completed=False) -> str:
    """Find a transfer matching condition. Returns id or None."""
    headers = H(token)
    r = requests.get(f"{API}/transfers?limit=100", headers=headers, timeout=20)
    if r.status_code != 200:
        return None
    for t in r.json():
        if want_non_cash and t.get("delivery_mode") != "cash":
            return t["id"]
        if want_completed and t.get("status") in ("COMPLETED", "FAILED", "CANCELLED_USER"):
            return t["id"]
    return None


def test_extend_pickup(token: str):
    section("B) Transfer extend-pickup")
    headers = H(token)

    # Get a fresh cash transfer (one that's not yet finalized)
    try:
        cash_tid = find_or_create_cash_transfer(token)
    except Exception as e:
        ko("B prep — cash transfer", str(e))
        return

    # B.1 days=1 → 200 + fee 1.0
    r = requests.post(f"{API}/transfers/{cash_tid}/extend-pickup", json={"days": 1}, headers=headers, timeout=20)
    if r.status_code == 200:
        j = r.json()
        if j.get("ok") and j.get("fee_added") == 1.0 and j.get("extension_days") == 1:
            ok("B.1 extend-pickup days=1", f"ok=true fee=1.0 ext_days=1")
        else:
            ko("B.1 extend-pickup days=1 (response shape)", json.dumps(j))
    else:
        ko("B.1 extend-pickup days=1", f"HTTP {r.status_code}: {r.text[:300]}")

    # Verify cumulative behaviour: re-fetch transfer and confirm fields
    r2 = requests.get(f"{API}/transfers/{cash_tid}", headers=headers, timeout=20)
    if r2.status_code == 200:
        t = r2.json()
        if t.get("pickup_extension_days") == 1 and t.get("pickup_extension_fee") == 1.0 and t.get("pickup_extended_at"):
            ok("B.1.persist pickup_extension_days/fee/extended_at after days=1")
        else:
            ko("B.1.persist", f"days={t.get('pickup_extension_days')} fee={t.get('pickup_extension_fee')} at={t.get('pickup_extended_at')}")

    # B.2 days=7 → 200 + fee 3.0 (cumulative)
    r = requests.post(f"{API}/transfers/{cash_tid}/extend-pickup", json={"days": 7}, headers=headers, timeout=20)
    if r.status_code == 200:
        j = r.json()
        if j.get("ok") and j.get("fee_added") == 3.0 and j.get("extension_days") == 8:  # cumulative 1+7
            ok("B.2 extend-pickup days=7 (cumulative)", f"ext_days=8 fee_added=3.0")
        else:
            ko("B.2 extend-pickup days=7 cumulative", json.dumps(j))
    else:
        ko("B.2 extend-pickup days=7", f"HTTP {r.status_code}: {r.text[:300]}")

    # Verify cumulative fee in DB
    r2 = requests.get(f"{API}/transfers/{cash_tid}", headers=headers, timeout=20)
    if r2.status_code == 200:
        t = r2.json()
        # cumulative fee = 1.0 + 3.0 = 4.0
        if abs(float(t.get("pickup_extension_fee", 0)) - 4.0) < 0.001 and t.get("pickup_extension_days") == 8:
            ok("B.2.persist cumulative fee = 4.0, days = 8")
        else:
            ko("B.2.persist cumulative", f"days={t.get('pickup_extension_days')} fee={t.get('pickup_extension_fee')}")

    # B.3 days=3 → 400
    r = requests.post(f"{API}/transfers/{cash_tid}/extend-pickup", json={"days": 3}, headers=headers, timeout=20)
    if r.status_code == 400:
        ok("B.3 extend-pickup days=3 → 400", r.json().get("detail", ""))
    else:
        ko("B.3 extend-pickup days=3 → 400", f"HTTP {r.status_code}: {r.text[:200]}")

    # B.4 non-cash transfer → 400 (delivery_mode != cash)
    non_cash_tid = find_or_create_completed_or_non_cash_transfer(token, want_non_cash=True)
    if not non_cash_tid:
        # Create a bank transfer
        draft_payload = {
            "destination_country": "SN",
            "destination_currency": "XOF",
            "send_amount": 5.0,
            "receive_amount": round(5.0 * 655.957, 2),
            "fx_rate": 655.957,
            "fee_percent": 2.0,
            "delivery_mode": "bank",
            "beneficiary": {"full_name": "Bank Test", "country": "SN", "phone": "+221771112222"},
            "delivery_details": {"bank_name": "SG", "iban": "SN08SG12345678901234567890"},
            "purpose": "family_support",
            "source_of_funds": "salary",
        }
        r = requests.post(f"{API}/transfers/draft", json=draft_payload, headers=headers, timeout=20)
        if r.status_code == 200:
            draft_id = r.json()["id"]
            r = requests.post(f"{API}/transfers/confirm",
                              json={"draft_id": draft_id, "pin": CLIENT_PIN},
                              headers=headers, timeout=20)
            if r.status_code == 200:
                non_cash_tid = r.json()["id"]

    if non_cash_tid:
        r = requests.post(f"{API}/transfers/{non_cash_tid}/extend-pickup", json={"days": 1}, headers=headers, timeout=20)
        if r.status_code == 400:
            ok("B.4 extend-pickup non-cash → 400", r.json().get("detail", ""))
        else:
            ko("B.4 extend-pickup non-cash → 400", f"HTTP {r.status_code}: {r.text[:200]}")
    else:
        ko("B.4 extend-pickup non-cash", "couldn't get a non-cash transfer")

    # B.5 completed transfer → 400
    completed_tid = find_or_create_completed_or_non_cash_transfer(token, want_completed=True)
    if completed_tid:
        # Need the transfer to be cash too for the second branch test, but the route checks delivery_mode first.
        # If completed transfer is non-cash, the first 400 will be delivery_mode. Try to find a cash completed one.
        r0 = requests.get(f"{API}/transfers/{completed_tid}", headers=headers, timeout=20)
        if r0.status_code == 200 and r0.json().get("delivery_mode") == "cash":
            r = requests.post(f"{API}/transfers/{completed_tid}/extend-pickup", json={"days": 1}, headers=headers, timeout=20)
            if r.status_code == 400 and "finalisé" in r.json().get("detail", "").lower():
                ok("B.5 extend-pickup completed cash → 400 finalisé", r.json().get("detail", ""))
            elif r.status_code == 400:
                ok("B.5 extend-pickup completed → 400 (any reason)", r.json().get("detail", ""))
            else:
                ko("B.5 extend-pickup completed", f"HTTP {r.status_code}: {r.text[:200]}")
        else:
            print("   (no completed cash transfer available — skipping B.5 strict)")
    else:
        print("   (no completed transfer in history — skipping B.5)")


# ============================================================================
# C) RECEIPT PDF with token query param
# ============================================================================
def test_receipt_pdf(token: str):
    section("C) Receipt PDF — token query auth")
    headers = H(token)

    # Need a transfer id (any user-owned transfer works)
    r = requests.get(f"{API}/transfers?limit=5", headers=headers, timeout=20)
    if r.status_code != 200 or not r.json():
        ko("C prep — get transfer", "no transfers found")
        return
    tid = r.json()[0]["id"]

    # C.1 No auth → 401
    r = requests.get(f"{API}/transfers/{tid}/receipt-pdf", timeout=20)
    if r.status_code == 401:
        ok("C.1 No auth → 401")
    else:
        ko("C.1 No auth → 401", f"HTTP {r.status_code}: {r.text[:200]}")

    # C.2 ?token= JWT → 200 application/pdf
    r = requests.get(f"{API}/transfers/{tid}/receipt-pdf?token={token}", timeout=20)
    if r.status_code == 200 and r.headers.get("content-type", "").startswith("application/pdf"):
        ok("C.2 ?token= JWT → 200 application/pdf", f"size={len(r.content)} bytes")
    else:
        ko("C.2 ?token= JWT", f"HTTP {r.status_code} CT={r.headers.get('content-type')}")

    # C.3 Bearer header → 200 application/pdf (back-compat)
    r = requests.get(f"{API}/transfers/{tid}/receipt-pdf", headers={"Authorization": f"Bearer {token}"}, timeout=20)
    if r.status_code == 200 and r.headers.get("content-type", "").startswith("application/pdf"):
        ok("C.3 Bearer header → 200 application/pdf", f"size={len(r.content)} bytes")
    else:
        ko("C.3 Bearer header", f"HTTP {r.status_code} CT={r.headers.get('content-type')}")

    # C.4 invalid token → 401
    r = requests.get(f"{API}/transfers/{tid}/receipt-pdf?token=invalid.jwt.string", timeout=20)
    if r.status_code == 401:
        ok("C.4 Invalid token → 401")
    else:
        ko("C.4 Invalid token → 401", f"HTTP {r.status_code}")


# ============================================================================
# MAIN
# ============================================================================
def main():
    print(f"Backend: {API}")
    try:
        token = login()
        print(f"✅ Login OK (token len={len(token)})")
    except Exception as e:
        print(f"❌ Login failed: {e}")
        sys.exit(2)

    test_beneficiaries(token)
    test_extend_pickup(token)
    test_receipt_pdf(token)

    print("\n" + "=" * 80)
    print(f"RESULT: {len(PASS)} PASS / {len(FAIL)} FAIL")
    print("=" * 80)
    if FAIL:
        for n, m in FAIL:
            print(f"  ❌ {n}: {m}")
        sys.exit(1)


if __name__ == "__main__":
    main()
