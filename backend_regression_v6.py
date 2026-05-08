"""Backend regression test for SENDBID v6 frontend changes.

Tests all 19 endpoints from the review request.
"""
import os
import sys
import json
import time
import requests

BASE = os.environ.get("BACKEND_URL", "https://mobile-transfer-hub-3.preview.emergentagent.com") + "/api"
CLIENT_EMAIL = "client@sendbid.app"
CLIENT_PWD = "Client@123!"
CLIENT_PIN = "123456"
AGENT_EMAIL = "agent@paybid.app"
AGENT_PWD = "Agent@123!"

PASS = []
FAIL = []
INFO = []


def hdr(token=None):
    h = {"Content-Type": "application/json"}
    if token:
        h["Authorization"] = f"Bearer {token}"
    return h


def log_pass(name, extra=""):
    print(f"✅ {name} {extra}")
    PASS.append(name)


def log_fail(name, status, body):
    print(f"❌ {name} → HTTP {status}")
    print(f"   body: {str(body)[:500]}")
    FAIL.append({"name": name, "status": status, "body": str(body)[:500]})


def safe_json(r):
    try:
        return r.json()
    except Exception:
        return r.text


def main():
    print(f"\n=== SENDBID Backend Regression v6 ===\nBase: {BASE}\n")

    # 1. POST /auth/login
    r = requests.post(f"{BASE}/auth/login",
                      json={"identifier": CLIENT_EMAIL, "password": CLIENT_PWD},
                      headers=hdr(), timeout=30)
    if r.status_code != 200 or "access_token" not in r.json():
        log_fail("1) POST /auth/login (client)", r.status_code, safe_json(r))
        return
    client_token = r.json()["access_token"]
    user = r.json()["user"]
    user_id = user["id"]
    log_pass("1) POST /auth/login (client)", f"-> token=...{client_token[-10:]} user={user['email']}")

    # 2. GET /auth/me
    r = requests.get(f"{BASE}/auth/me", headers=hdr(client_token), timeout=30)
    if r.status_code != 200 or "user" not in r.json():
        log_fail("2) GET /auth/me", r.status_code, safe_json(r))
    else:
        log_pass("2) GET /auth/me", f"-> user.id={r.json()['user']['id']}")

    # 3. PUT /auth/me (used by new /personal-info page)
    r = requests.put(f"{BASE}/auth/me",
                     json={"phone": user.get("phone", "+33612345678"),
                           "address": {"street": "10 rue de Paris", "city": "Paris",
                                       "zip": "75001", "country": "FR"}},
                     headers=hdr(client_token), timeout=30)
    if r.status_code != 200:
        log_fail("3) PUT /auth/me (update profile)", r.status_code, safe_json(r))
    else:
        log_pass("3) PUT /auth/me", f"-> {r.status_code}")

    # 4. GET /wallet
    r = requests.get(f"{BASE}/wallet", headers=hdr(client_token), timeout=30)
    if r.status_code != 200 or "balance" not in r.json():
        log_fail("4) GET /wallet", r.status_code, safe_json(r))
    else:
        log_pass("4) GET /wallet", f"-> balance={r.json().get('balance')} {r.json().get('currency')}")

    # 5. GET /wallet/transactions?limit=50
    r = requests.get(f"{BASE}/wallet/transactions?limit=50", headers=hdr(client_token), timeout=30)
    if r.status_code != 200 or not isinstance(r.json(), list):
        log_fail("5) GET /wallet/transactions?limit=50", r.status_code, safe_json(r))
    else:
        log_pass("5) GET /wallet/transactions?limit=50", f"-> {len(r.json())} tx")

    # 6. POST /wallet/withdraw with method=bank
    r = requests.post(f"{BASE}/wallet/withdraw",
                      json={"method": "bank",
                            "amount": 50.0,
                            "details": {"iban": "FR7630006000011234567890189",
                                        "holder": "John Doe",
                                        "bank": "BNP Paribas",
                                        "bic": "BNPAFRPP"}},
                      headers=hdr(client_token), timeout=30)
    if r.status_code != 200:
        log_fail("6) POST /wallet/withdraw (bank)", r.status_code, safe_json(r))
    else:
        log_pass("6) POST /wallet/withdraw (bank)", f"-> {safe_json(r)}")

    # 7. POST /beneficiaries with extended payload
    r = requests.post(f"{BASE}/beneficiaries",
                      json={"full_name": "Awa Diop",
                            "first_name": "Awa",
                            "last_name": "Diop",
                            "email": "awa.diop@example.com",
                            "phone": "+221701234567",
                            "country": "SN",
                            "city": "Dakar",
                            "address": "10 Avenue Bourguiba",
                            "po_box": "BP 1234",
                            "currency": "XOF",
                            "relation": "Famille"},
                      headers=hdr(client_token), timeout=30)
    if r.status_code != 200:
        log_fail("7) POST /beneficiaries (new payload shape)", r.status_code, safe_json(r))
    else:
        ben_id = r.json().get("id")
        log_pass("7) POST /beneficiaries", f"-> id={ben_id}")

    # 8. GET /beneficiaries
    r = requests.get(f"{BASE}/beneficiaries", headers=hdr(client_token), timeout=30)
    if r.status_code != 200 or not isinstance(r.json(), list):
        log_fail("8) GET /beneficiaries", r.status_code, safe_json(r))
    else:
        log_pass("8) GET /beneficiaries", f"-> {len(r.json())} entries")

    # 9. POST /payment-methods with new payload
    r = requests.post(f"{BASE}/payment-methods",
                      json={"type": "card",
                            "label": "Visa **4242",
                            "brand": "visa",
                            "last4": "4242",
                            "holder": "John Doe",
                            "exp_month": 12,
                            "exp_year": 2030,
                            "save": True},
                      headers=hdr(client_token), timeout=30)
    if r.status_code != 200:
        log_fail("9) POST /payment-methods (new payload)", r.status_code, safe_json(r))
    else:
        log_pass("9) POST /payment-methods", f"-> id={r.json().get('id')}")

    # 10. GET /payment-methods
    r = requests.get(f"{BASE}/payment-methods", headers=hdr(client_token), timeout=30)
    if r.status_code != 200 or not isinstance(r.json(), list):
        log_fail("10) GET /payment-methods", r.status_code, safe_json(r))
    else:
        log_pass("10) GET /payment-methods", f"-> {len(r.json())} entries")

    # 11. GET /transfers (ALL transfers)
    r = requests.get(f"{BASE}/transfers", headers=hdr(client_token), timeout=30)
    if r.status_code != 200 or not isinstance(r.json(), list):
        log_fail("11) GET /transfers (list)", r.status_code, safe_json(r))
    else:
        log_pass("11) GET /transfers", f"-> {len(r.json())} transfers")

    # 12. POST /transfers/draft with new fields
    fx_r = requests.get(f"{BASE}/transfers/fx-rate?from=EUR&to=XOF",
                       headers=hdr(client_token), timeout=30)
    fx_rate_val = fx_r.json().get("rate", 655.957) if fx_r.status_code == 200 else 655.957

    send_amt = 30.0
    receive_amt = round(send_amt * fx_rate_val, 0)
    draft_payload = {
        "destination_country": "SN",
        "destination_currency": "XOF",
        "send_amount": send_amt,
        "receive_amount": receive_amt,
        "fx_rate": fx_rate_val,
        "fee_percent": 2.0,
        "delivery_mode": "cash",
        "beneficiary": {
            "full_name": "Awa Diop",
            "phone": "+221701234567",
            "country": "SN",
            "city": "Dakar",
        },
        "delivery_details": {
            "city": "Dakar",
            "address": "Plateau, Avenue Senghor",
            "phone": "+221701234567",
        },
        "purpose": "family",
        "source_of_funds": "salary",
        "vip_express": True,  # NEW field per review
        "vip_delivery": True,
    }
    r = requests.post(f"{BASE}/transfers/draft", json=draft_payload,
                      headers=hdr(client_token), timeout=30)
    if r.status_code != 200:
        log_fail("12) POST /transfers/draft (with new fields)", r.status_code, safe_json(r))
        draft_id = None
    else:
        draft_id = r.json().get("id")
        log_pass("12) POST /transfers/draft", f"-> draft_id={draft_id} total={r.json().get('total_amount')}")

    # 13. POST /transfers/confirm
    transfer_id = None
    if draft_id:
        r = requests.post(f"{BASE}/transfers/confirm",
                          json={"draft_id": draft_id, "pin": CLIENT_PIN},
                          headers=hdr(client_token), timeout=30)
        if r.status_code != 200:
            log_fail("13) POST /transfers/confirm", r.status_code, safe_json(r))
        else:
            transfer_id = r.json().get("id")
            log_pass("13) POST /transfers/confirm",
                     f"-> id={transfer_id} status={r.json().get('status')}")
    else:
        log_fail("13) POST /transfers/confirm (skipped - no draft)", "skipped", "")

    # 14. GET /transfers/{id}/bids — descending order
    if transfer_id:
        # Wait briefly for at least one bid
        time.sleep(8)
        r = requests.get(f"{BASE}/transfers/{transfer_id}/bids",
                         headers=hdr(client_token), timeout=30)
        if r.status_code != 200:
            log_fail("14) GET /transfers/{id}/bids", r.status_code, safe_json(r))
        else:
            bids = r.json()
            fees = [b.get("bid_fee_percent") for b in bids]
            ascending = all(fees[i] <= fees[i+1] for i in range(len(fees)-1)) if len(fees) > 1 else True
            log_pass("14) GET /transfers/{id}/bids",
                     f"-> {len(bids)} bids, fees={fees}, ascending(=lowest first)={ascending}")
    else:
        log_fail("14) GET /transfers/{id}/bids (skipped - no transfer)", "skipped", "")

    # 15. POST /agent/auctions/{id}/bid — descending only
    # Login as agent
    r = requests.post(f"{BASE}/auth/login",
                      json={"identifier": AGENT_EMAIL, "password": AGENT_PWD},
                      headers=hdr(), timeout=30)
    if r.status_code != 200:
        log_fail("15a) Agent login", r.status_code, safe_json(r))
    else:
        agent_token = r.json()["access_token"]
        log_pass("15a) Agent login", f"-> {AGENT_EMAIL}")

        # Create a fresh transfer for bid testing
        r2 = requests.post(f"{BASE}/transfers/draft", json=draft_payload,
                           headers=hdr(client_token), timeout=30)
        if r2.status_code == 200:
            new_draft_id = r2.json().get("id")
            r3 = requests.post(f"{BASE}/transfers/confirm",
                               json={"draft_id": new_draft_id, "pin": CLIENT_PIN},
                               headers=hdr(client_token), timeout=30)
            if r3.status_code == 200:
                test_transfer_id = r3.json().get("id")
                # First bid at fee_max=2.0
                r4 = requests.post(f"{BASE}/agent/auctions/{test_transfer_id}/bid",
                                   json={"transfer_id": test_transfer_id,
                                         "bid_fee_percent": 2.0,
                                         "eta_minutes": 30},
                                   headers=hdr(agent_token), timeout=30)
                if r4.status_code == 200:
                    log_pass("15b) POST /agent/auctions/{id}/bid (1st bid 2.0%)",
                             f"-> {r4.json().get('bid', {}).get('bid_fee_percent')}")
                else:
                    log_fail("15b) POST /agent/auctions/{id}/bid (1st)",
                             r4.status_code, safe_json(r4))

                # Second bid same/higher → must be 400 (descending)
                r5 = requests.post(f"{BASE}/agent/auctions/{test_transfer_id}/bid",
                                   json={"transfer_id": test_transfer_id,
                                         "bid_fee_percent": 2.0,
                                         "eta_minutes": 30},
                                   headers=hdr(agent_token), timeout=30)
                if r5.status_code == 400 and "descend" in (safe_json(r5).get("detail", "").lower() if isinstance(safe_json(r5), dict) else ""):
                    log_pass("15c) Re-bid same fee blocked",
                             f"-> 400 {safe_json(r5).get('detail')[:60]}")
                else:
                    log_fail("15c) Re-bid descending guard",
                             r5.status_code, safe_json(r5))

                # Lower bid → must succeed
                r6 = requests.post(f"{BASE}/agent/auctions/{test_transfer_id}/bid",
                                   json={"transfer_id": test_transfer_id,
                                         "bid_fee_percent": 1.5,
                                         "eta_minutes": 30},
                                   headers=hdr(agent_token), timeout=30)
                if r6.status_code == 200:
                    log_pass("15d) Lower bid 1.5% accepted",
                             f"-> {r6.json().get('bid', {}).get('bid_fee_percent')}")
                else:
                    log_fail("15d) Lower bid", r6.status_code, safe_json(r6))
            else:
                log_fail("15) Create transfer for bid test", r3.status_code, safe_json(r3))
        else:
            log_fail("15) Create transfer for bid test (draft)", r2.status_code, safe_json(r2))

    # 16. GET /disputes and POST /disputes
    r = requests.get(f"{BASE}/disputes", headers=hdr(client_token), timeout=30)
    if r.status_code != 200 or not isinstance(r.json(), list):
        log_fail("16a) GET /disputes", r.status_code, safe_json(r))
    else:
        log_pass("16a) GET /disputes", f"-> {len(r.json())} entries")

    if transfer_id:
        r = requests.post(f"{BASE}/disputes",
                          json={"transfer_id": transfer_id,
                                "reason": "delay",
                                "description": "Beneficiary not received funds"},
                          headers=hdr(client_token), timeout=30)
        if r.status_code != 200:
            log_fail("16b) POST /disputes", r.status_code, safe_json(r))
        else:
            log_pass("16b) POST /disputes", f"-> id={r.json().get('id')}")

    # 17. GET /notifications
    r = requests.get(f"{BASE}/notifications", headers=hdr(client_token), timeout=30)
    if r.status_code != 200 or not isinstance(r.json(), list):
        log_fail("17) GET /notifications", r.status_code, safe_json(r))
    else:
        log_pass("17) GET /notifications", f"-> {len(r.json())} entries")

    # 18. GET /corridors
    r = requests.get(f"{BASE}/corridors", headers=hdr(client_token), timeout=30)
    if r.status_code != 200 or "corridors" not in r.json():
        log_fail("18) GET /corridors", r.status_code, safe_json(r))
    else:
        log_pass("18) GET /corridors", f"-> count={r.json().get('count')}")

    # 19. GET /scheduled-transfers
    r = requests.get(f"{BASE}/scheduled-transfers", headers=hdr(client_token), timeout=30)
    if r.status_code != 200 or not isinstance(r.json(), list):
        log_fail("19) GET /scheduled-transfers", r.status_code, safe_json(r))
    else:
        log_pass("19) GET /scheduled-transfers", f"-> {len(r.json())} entries")

    print(f"\n=== SUMMARY ===\nPASS: {len(PASS)}\nFAIL: {len(FAIL)}\n")
    if FAIL:
        print("FAILURES:")
        for f in FAIL:
            print(f"  - {f['name']} HTTP {f['status']}: {f['body'][:200]}")


if __name__ == "__main__":
    main()
