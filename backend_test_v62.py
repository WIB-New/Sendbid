"""Backend regression v6.2 — focused tests A/B/C/D."""
import os
import sys
import time
import uuid
import json
import requests

BASE = "https://mobile-transfer-hub-3.preview.emergentagent.com/api"

results = []


def log(scenario, ok, detail=""):
    tag = "PASS" if ok else "FAIL"
    line = f"[{tag}] {scenario}: {detail}"
    print(line)
    results.append((scenario, ok, detail))


def hdr(token):
    return {"Authorization": f"Bearer {token}"}


# -------- A: corridors with all 3 modes --------
def test_A_corridors():
    # need a token (login as client)
    r = requests.post(f"{BASE}/auth/login", json={"identifier": "client@sendbid.app", "password": "Client@123!"}, timeout=20)
    if r.status_code != 200:
        log("A", False, f"login client failed: {r.status_code} {r.text[:200]}")
        return
    token = r.json().get("access_token")
    r = requests.get(f"{BASE}/corridors", headers=hdr(token), timeout=30)
    if r.status_code != 200:
        log("A", False, f"GET /corridors {r.status_code} {r.text[:200]}")
        return
    body = r.json()
    corridors = body.get("corridors", [])
    if len(corridors) < 3:
        log("A", False, f"only {len(corridors)} corridors returned")
        return
    expected = {"cash", "bank", "momo"}
    failures = []
    for c in corridors[:20]:  # check at least first 20
        modes = set(c.get("delivery_modes") or [])
        if modes != expected:
            failures.append((c.get("country_code"), sorted(modes)))
    sample = [(c.get("country_code"), c.get("delivery_modes")) for c in corridors[:5]]
    if failures:
        log("A", False, f"{len(failures)} corridors missing modes (e.g. {failures[:3]}); sample={sample}")
    else:
        log("A", True, f"All 3 modes (cash/bank/momo) present on first 20 corridors. count={body.get('count')}, sample={sample}")


# -------- B: KYC tier2 progression --------
def test_B():
    # Register a fresh user
    suffix = uuid.uuid4().hex[:10]
    email = f"reg_{suffix}@example.com"
    phone = f"+3361{suffix[:7]}"
    payload = {"email": email, "phone": phone, "password": "Strong@Pass1!", "full_name": "Test V62 User"}
    r = requests.post(f"{BASE}/auth/register", json=payload, timeout=20)
    if r.status_code != 200:
        log("B.1", False, f"register failed {r.status_code} {r.text[:200]}")
        log("B.2", False, "skipped (register failed)")
        return None, None
    rb = r.json()
    token = rb.get("token")
    user_id = rb.get("user_id") or (rb.get("user") or {}).get("id")
    if not token:
        log("B.1", False, f"no token in register response keys={list(rb.keys())}")
        log("B.2", False, "skipped")
        return None, None

    # B.1 - tier2 start without tier1
    r = requests.post(f"{BASE}/kyc/tier2/start", headers=hdr(token), timeout=20)
    if r.status_code == 403 and "Tier 1" in r.text:
        log("B.1", True, f"403 with detail mentioning Tier 1: {r.json().get('detail')}")
    else:
        log("B.1", False, f"expected 403 with Tier 1, got {r.status_code} {r.text[:200]}")

    # B.2 - submit tier1 then tier2/start
    tier1 = {
        "full_name": "Test V62 User",
        "date_of_birth": "1990-01-01",
        "nationality": "FR",
        "address": "10 rue de Paris",
        "city": "Paris",
        "country": "FR",
        "id_type": "passport",
        "id_number": "AB123456",
    }
    r = requests.post(f"{BASE}/kyc/tier1", headers=hdr(token), json=tier1, timeout=20)
    if r.status_code != 200:
        log("B.2", False, f"tier1 failed {r.status_code} {r.text[:200]}")
        return token, user_id
    r2 = requests.post(f"{BASE}/kyc/tier2/start", headers=hdr(token), timeout=30)
    if r2.status_code == 200 and "verification_url" in r2.text:
        body = r2.json()
        log("B.2", True, f"tier1=200, tier2/start=200 verification_url={body.get('verification_url')[:60]}... provider={body.get('provider')}")
    else:
        log("B.2", False, f"tier2/start after tier1 returned {r2.status_code} {r2.text[:200]}")
    return token, user_id


# -------- C: register returns token + user, /me, create-pin --------
def test_C():
    suffix = uuid.uuid4().hex[:10]
    email = f"reg2_{suffix}@example.com"
    phone = f"+3362{suffix[:7]}"
    payload = {"email": email, "phone": phone, "password": "Strong@Pass1!", "full_name": "Test C V62"}
    r = requests.post(f"{BASE}/auth/register", json=payload, timeout=20)
    if r.status_code != 200:
        log("C.1", False, f"register failed {r.status_code} {r.text[:200]}")
        log("C.2", False, "skipped")
        log("C.3", False, "skipped")
        return
    rb = r.json()
    token = rb.get("token")
    user = rb.get("user") or {}
    user_id_top = rb.get("user_id")
    if token and user.get("id") and user_id_top and user.get("id") == user_id_top and token.count(".") == 2:
        log("C.1", True, f"token present (jwt 3-parts), user.id == user_id ({user_id_top})")
    else:
        log("C.1", False, f"token={bool(token)} user.id={user.get('id')} user_id={user_id_top}")
        return

    # C.2 - GET /auth/me with token
    r = requests.get(f"{BASE}/auth/me", headers=hdr(token), timeout=15)
    if r.status_code == 200:
        body = r.json()
        u = body.get("user") or {}
        log("C.2", True, f"auth/me 200, user.email={u.get('email')}, kyc_tier={u.get('kyc_tier')}")
    else:
        log("C.2", False, f"auth/me {r.status_code} {r.text[:200]}")

    # C.3 - create-pin with strong PIN 742813
    r = requests.post(f"{BASE}/auth/create-pin", headers=hdr(token), json={"pin": "742813"}, timeout=15)
    if r.status_code == 200 and r.json().get("ok") is True:
        log("C.3", True, f"create-pin 200 {r.json()}")
    else:
        log("C.3", False, f"create-pin {r.status_code} {r.text[:200]}")


# -------- D: admin role accounts + client 403 --------
def test_D():
    accts = [
        ("superadmin@sendbid.app", "SuperAdmin@123!"),
        ("partner@sendbid.app", "Partner@123!"),
        ("superagent@sendbid.app", "SuperAgent@123!"),
    ]
    fails = []
    successes = []
    for email, pwd in accts:
        r = requests.post(f"{BASE}/auth/login", json={"identifier": email, "password": pwd}, timeout=20)
        if r.status_code != 200:
            fails.append(f"{email}: login {r.status_code} {r.text[:120]}")
            continue
        token = r.json().get("access_token")
        if not token:
            fails.append(f"{email}: no access_token")
            continue
        r2 = requests.get(f"{BASE}/admin/kpis", headers=hdr(token), timeout=20)
        if r2.status_code == 200:
            successes.append(f"{email}: kpis OK ({list(r2.json().keys())})")
        else:
            fails.append(f"{email}: /admin/kpis {r2.status_code} {r2.text[:120]}")

    # client must 403
    r = requests.post(f"{BASE}/auth/login", json={"identifier": "client@sendbid.app", "password": "Client@123!"}, timeout=20)
    if r.status_code != 200:
        fails.append(f"client login {r.status_code}")
    else:
        ctoken = r.json().get("access_token")
        r2 = requests.get(f"{BASE}/admin/kpis", headers=hdr(ctoken), timeout=20)
        if r2.status_code == 403:
            successes.append(f"client @kpis: 403 OK ({r2.json().get('detail')})")
        else:
            fails.append(f"client should be 403 on /admin/kpis, got {r2.status_code} {r2.text[:120]}")

    if not fails:
        log("D", True, " | ".join(successes))
    else:
        log("D", False, "Failures: " + " ; ".join(fails) + " | OK: " + " ; ".join(successes))


if __name__ == "__main__":
    print(f"=== Regression v6.2 against {BASE} ===\n")
    test_A_corridors()
    test_B()
    test_C()
    test_D()
    print("\n=== SUMMARY ===")
    n_pass = sum(1 for _, ok, _ in results if ok)
    n_total = len(results)
    for s, ok, d in results:
        print(f"  {'PASS' if ok else 'FAIL'} {s}")
    print(f"\n{n_pass}/{n_total} scenarios passed")
    sys.exit(0 if n_pass == n_total else 1)
