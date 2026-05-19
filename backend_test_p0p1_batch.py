#!/usr/bin/env python3
"""
Backend test — P0/P1 batch (fork forked job):
1) POST /api/wallet/withdraw — PIN now MANDATORY
2) POST /api/auth/register — new fields (country, city, accept_terms) + enriched anti-reuse
"""
import os
import sys
import time
import uuid
import requests
from pymongo import MongoClient

BACKEND_URL = "https://paybid-preview.preview.emergentagent.com"
API = f"{BACKEND_URL}/api"

CLIENT_EMAIL = "client@sendbid.app"
CLIENT_PASSWORD = "Client@123!"
CLIENT_PIN = "123456"

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "sendbid")
mongo = MongoClient(MONGO_URL)
db = mongo[DB_NAME]

results = []  # list of (label, ok, detail)


def step(label, ok, detail=""):
    icon = "✅" if ok else "❌"
    print(f"{icon} {label} — {detail}")
    results.append((label, ok, detail))


def login(email, password):
    r = requests.post(f"{API}/auth/login", json={"identifier": email, "password": password}, timeout=15)
    if r.status_code != 200:
        return None, r
    body = r.json()
    return body.get("access_token") or body.get("token"), r


def auth_headers(tok):
    return {"Authorization": f"Bearer {tok}"}


# ================================
# PART 1 — /api/wallet/withdraw
# ================================
print("\n========== PART 1: /api/wallet/withdraw (PIN OBLIGATOIRE) ==========")
tok, r = login(CLIENT_EMAIL, CLIENT_PASSWORD)
if not tok:
    print(f"❌ Cannot login as client: {r.status_code} {r.text}")
    sys.exit(1)
print(f"✅ Logged in as {CLIENT_EMAIL}, token len={len(tok)}")

H = auth_headers(tok)

# fetch initial wallet
r_wal0 = requests.get(f"{API}/wallet", headers=H, timeout=15)
wal0 = r_wal0.json() if r_wal0.status_code == 200 else {}
bal0 = float(wal0.get("balance", 0) or 0)
print(f"   initial wallet balance = {bal0} EUR")

iban_payload = {"iban": "FR7612345678901234567890123", "holder": "Demo User"}

# Case 1: POST sans pin → 400
r1 = requests.post(f"{API}/wallet/withdraw", headers=H, json={
    "amount": 10, "method": "bank", "details": iban_payload
}, timeout=15)
ok1 = r1.status_code == 400 and "PIN" in (r1.json().get("detail", "") if r1.headers.get("content-type", "").startswith("application/json") else "")
step("Case 1 — POST sans pin → 400 'Code PIN à 6 chiffres requis'",
     ok1, f"status={r1.status_code} body={r1.text[:200]}")

# Case 2: POST avec pin="" → 400
r2 = requests.post(f"{API}/wallet/withdraw", headers=H, json={
    "amount": 10, "method": "bank", "details": iban_payload, "pin": ""
}, timeout=15)
ok2 = r2.status_code == 400
step("Case 2 — POST avec pin='' → 400",
     ok2, f"status={r2.status_code} body={r2.text[:200]}")

# Case 3: POST avec pin="123" trop court → 400
r3 = requests.post(f"{API}/wallet/withdraw", headers=H, json={
    "amount": 10, "method": "bank", "details": iban_payload, "pin": "123"
}, timeout=15)
ok3 = r3.status_code == 400
step("Case 3 — POST avec pin='123' (trop court) → 400",
     ok3, f"status={r3.status_code} body={r3.text[:200]}")

# Case 4: POST avec pin="999999" wrong PIN → 401 'Code PIN incorrect'
r4 = requests.post(f"{API}/wallet/withdraw", headers=H, json={
    "amount": 10, "method": "bank", "details": iban_payload, "pin": "999999"
}, timeout=15)
ok4 = r4.status_code == 401 and ("PIN" in r4.text or "incorrect" in r4.text.lower())
step("Case 4 — POST avec pin='999999' → 401 'Code PIN incorrect'",
     ok4, f"status={r4.status_code} body={r4.text[:200]}")

# Case 5: POST avec pin="123456" → 200 OK avec tx_id et payout_id
r5 = requests.post(f"{API}/wallet/withdraw", headers=H, json={
    "amount": 10, "method": "bank", "details": iban_payload, "pin": CLIENT_PIN
}, timeout=20)
ok5_status = r5.status_code == 200
body5 = r5.json() if ok5_status else {}
tx_id = body5.get("tx_id")
payout_id = body5.get("payout_id")
ok5_keys = bool(tx_id) and bool(payout_id) and body5.get("ok") is True
step("Case 5 — POST avec bon PIN + amount=10 + method=bank + IBAN → 200 OK + tx_id + payout_id",
     ok5_status and ok5_keys,
     f"status={r5.status_code} tx_id={tx_id} payout_id={payout_id} eta_days={body5.get('eta_days')} fee={body5.get('fee')}")

# Verify wallet debited (amount + 1 EUR fee)
r_wal1 = requests.get(f"{API}/wallet", headers=H, timeout=15)
bal1 = float(r_wal1.json().get("balance", 0) or 0)
expected_bal = round(bal0 - 11.0, 2)
ok_wal = abs(bal1 - expected_bal) < 0.01
step("Case 5b — Wallet débité montant + 1 EUR de frais SEPA",
     ok_wal, f"bal_before={bal0} bal_after={bal1} expected={expected_bal}")

# Verify payout_request created in DB with PENDING + eta_days=3
if payout_id:
    payout = db.payout_requests.find_one({"id": payout_id}, {"_id": 0})
    ok_payout = bool(payout) and payout.get("status") == "PENDING" and payout.get("eta_days") == 3
    step("Case 5c — payout_request créé en DB avec status=PENDING + eta_days=3",
         ok_payout, f"payout doc found={bool(payout)} status={payout.get('status') if payout else None} eta_days={payout.get('eta_days') if payout else None}")
else:
    step("Case 5c — payout_request créé en DB", False, "no payout_id from response")


# ================================
# PART 2 — /api/auth/register
# ================================
print("\n========== PART 2: /api/auth/register (country/city/accept_terms + anti-réutilisation) ==========")

unique_suffix = uuid.uuid4().hex[:8]
new_email = f"newuser_{unique_suffix}@example.com"
new_phone = f"+33611{int(time.time()) % 1000000:06d}"

# Case 1: registration with all fields → 200 OK, country="FR"
payload1 = {
    "email": new_email,
    "phone": new_phone,
    "password": "Strong@Pass1",
    "full_name": "Jean Test Dupont",
    "country": "FR",
    "city": "Paris",
    "accept_terms": True,
}
r_reg1 = requests.post(f"{API}/auth/register", json=payload1, timeout=15)
ok_reg1 = r_reg1.status_code == 200
body_reg1 = r_reg1.json() if ok_reg1 else {}
user_id_1 = body_reg1.get("user_id")
step("Case 1 — Register w/ valid fields (country=FR, city=Paris, accept_terms=true) → 200",
     ok_reg1 and bool(user_id_1),
     f"status={r_reg1.status_code} user_id={user_id_1}")

# Verify DB: country="FR" and terms_accepted_at present
if user_id_1:
    doc = db.users.find_one({"id": user_id_1}, {"_id": 0})
    ok_country = doc and doc.get("country") == "FR"
    ok_tac = doc and doc.get("terms_accepted_at") is not None
    step("Case 1b — DB user.country=='FR'",
         ok_country, f"db.country={doc.get('country') if doc else None}")
    step("Case 1c — DB user.terms_accepted_at is ISO timestamp",
         ok_tac, f"db.terms_accepted_at={doc.get('terms_accepted_at') if doc else None}")

# Case 2: accept_terms=false → 400 'Vous devez accepter les CGU'
unique_suffix2 = uuid.uuid4().hex[:8]
payload2 = {
    "email": f"refuser_{unique_suffix2}@example.com",
    "phone": f"+33611{(int(time.time())+1) % 1000000:06d}",
    "password": "Strong@Pass1",
    "full_name": "Refus CGU",
    "country": "FR",
    "city": "Lyon",
    "accept_terms": False,
}
r_reg2 = requests.post(f"{API}/auth/register", json=payload2, timeout=15)
ok_reg2 = r_reg2.status_code == 400 and "CGU" in r_reg2.text
step("Case 2 — accept_terms=false → 400 'Vous devez accepter les CGU'",
     ok_reg2, f"status={r_reg2.status_code} body={r_reg2.text[:200]}")

# Case 3: email already used by verified account (client@sendbid.app)
unique_suffix3 = uuid.uuid4().hex[:8]
payload3 = {
    "email": CLIENT_EMAIL,  # verified account
    "phone": f"+33611{(int(time.time())+2) % 1000000:06d}",
    "password": "Strong@Pass1",
    "full_name": "Tentative Duplicate",
    "country": "FR",
    "city": "Marseille",
    "accept_terms": True,
}
r_reg3 = requests.post(f"{API}/auth/register", json=payload3, timeout=15)
ok_reg3 = r_reg3.status_code == 400 and "vérifié" in r_reg3.text
step("Case 3 — Email d'un compte vérifié → 400 'associé à un compte vérifié'",
     ok_reg3, f"status={r_reg3.status_code} body={r_reg3.text[:200]}")

# Case 4: unfinalized account cleanup
#   Step a: create a fresh account WITHOUT validating PIN or OTP
#   Step b: re-register with same email → should succeed (cleanup of old unfinalized)
unique_suffix4 = uuid.uuid4().hex[:8]
unfinalized_email = f"unfinalized_{unique_suffix4}@example.com"
unfinalized_phone = f"+33611{(int(time.time())+3) % 1000000:06d}"

payload4a = {
    "email": unfinalized_email,
    "phone": unfinalized_phone,
    "password": "Strong@Pass1",
    "full_name": "Unfinalized User",
    "country": "FR",
    "city": "Nice",
    "accept_terms": True,
}
r_reg4a = requests.post(f"{API}/auth/register", json=payload4a, timeout=15)
ok_reg4a = r_reg4a.status_code == 200
user_id_4a = r_reg4a.json().get("user_id") if ok_reg4a else None
print(f"   pre-step: created unfinalized account user_id={user_id_4a}")

# Ensure unfinalized: NO pin_hash, NO email_verified, NO phone_verified
if user_id_4a:
    db.users.update_one({"id": user_id_4a}, {"$set": {
        "pin_hash": None, "email_verified": False, "phone_verified": False
    }})

# Now re-register with same email — different phone (or same)
payload4b = {
    "email": unfinalized_email,
    "phone": unfinalized_phone,  # same phone (matches $or filter)
    "password": "Strong@Pass1",
    "full_name": "Unfinalized User Retry",
    "country": "FR",
    "city": "Nice",
    "accept_terms": True,
}
r_reg4b = requests.post(f"{API}/auth/register", json=payload4b, timeout=15)
ok_reg4b = r_reg4b.status_code == 200
user_id_4b = r_reg4b.json().get("user_id") if ok_reg4b else None
ok_diff = ok_reg4b and user_id_4b and user_id_4b != user_id_4a
step("Case 4 — Re-register avec email d'un compte NON finalisé → SUCCESS (cleanup + nouveau compte)",
     ok_diff, f"reg4a status=200 user_id_4a={user_id_4a} ; reg4b status={r_reg4b.status_code} user_id_4b={user_id_4b}")

# Verify old user is gone from DB
if user_id_4a:
    old_doc = db.users.find_one({"id": user_id_4a})
    step("Case 4b — Ancien compte non finalisé supprimé de DB",
         old_doc is None, f"old user still exists? {old_doc is not None}")

# Case 5: country in lowercase → backend forces uppercase, max 2 chars
unique_suffix5 = uuid.uuid4().hex[:8]
payload5 = {
    "email": f"lowercase_{unique_suffix5}@example.com",
    "phone": f"+33611{(int(time.time())+4) % 1000000:06d}",
    "password": "Strong@Pass1",
    "full_name": "Lowercase Country",
    "country": "fr",  # lowercase
    "city": "Toulouse",
    "accept_terms": True,
}
r_reg5 = requests.post(f"{API}/auth/register", json=payload5, timeout=15)
user_id_5 = r_reg5.json().get("user_id") if r_reg5.status_code == 200 else None
if user_id_5:
    doc5 = db.users.find_one({"id": user_id_5}, {"_id": 0})
    ok_upper = doc5 and doc5.get("country") == "FR"
    step("Case 5 — country='fr' lowercase → backend force uppercase 'FR'",
         ok_upper, f"db.country={doc5.get('country') if doc5 else None}")
else:
    step("Case 5 — registration with lowercase country", False, f"status={r_reg5.status_code} body={r_reg5.text[:200]}")

# Bonus: country longer than 2 chars → truncated to 2
unique_suffix6 = uuid.uuid4().hex[:8]
payload6 = {
    "email": f"longctry_{unique_suffix6}@example.com",
    "phone": f"+33611{(int(time.time())+5) % 1000000:06d}",
    "password": "Strong@Pass1",
    "full_name": "Long Country Code",
    "country": "france",  # too long
    "city": "Bordeaux",
    "accept_terms": True,
}
r_reg6 = requests.post(f"{API}/auth/register", json=payload6, timeout=15)
user_id_6 = r_reg6.json().get("user_id") if r_reg6.status_code == 200 else None
if user_id_6:
    doc6 = db.users.find_one({"id": user_id_6}, {"_id": 0})
    ok_trunc = doc6 and doc6.get("country") == "FR" and len(doc6.get("country")) == 2
    step("Case 5b — country='france' too long → tronqué à 'FR' (max 2 chars)",
         ok_trunc, f"db.country={doc6.get('country') if doc6 else None}")

# Cleanup: delete test accounts we created (optional, keep DB clean)
for uid in [user_id_1, user_id_4b, user_id_5, user_id_6]:
    if uid:
        db.users.delete_one({"id": uid})
        db.wallets.delete_many({"user_id": uid})
        db.otp_codes.delete_many({"user_id": uid})

# Summary
print("\n========== SUMMARY ==========")
passed = sum(1 for _, ok, _ in results if ok)
total = len(results)
print(f"{passed}/{total} checks PASSED")
print()
for label, ok, detail in results:
    icon = "✅" if ok else "❌"
    print(f"{icon} {label}")
    if not ok:
        print(f"   → {detail}")

sys.exit(0 if passed == total else 1)
