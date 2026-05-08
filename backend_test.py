"""SENDBID backend regression — v6 (NEW endpoints + sessions + corporate KYC + regression).

Tests the following NEW or UPDATED endpoints:
  1) PUT /api/auth/me
  2) POST /api/wallet/withdraw  (incl. error cases)
  3) POST /api/payment-methods  (label optional, auto-derive)
  4) GET /api/sessions
  5) POST /api/sessions/revoke
  6) POST /api/sessions/revoke-all
  7) GET /api/kyc/corporate
  8) POST /api/kyc/corporate/level1
  9) POST /api/kyc/corporate/level2
 10) POST /api/kyc/corporate/level3

Plus regression:
  /auth/login, /auth/me, /wallet, /wallet/transactions?limit=50,
  /beneficiaries POST + GET, /payment-methods GET,
  /transfers GET, /transfers/draft, /transfers/confirm, /transfers/{id}/bids,
  /agent/auctions/{id}/bid (descending-only),
  /disputes GET + POST, /notifications, /corridors, /scheduled-transfers
"""
import os
import sys
import time
import json
import uuid
from typing import Any, Optional

import requests

BACKEND = os.environ.get(
    "EXPO_PUBLIC_BACKEND_URL",
    "https://mobile-transfer-hub-3.preview.emergentagent.com",
).rstrip("/")
API = f"{BACKEND}/api"

CLIENT_EMAIL = "client@sendbid.app"
CLIENT_PWD = "Client@123!"
AGENT_EMAIL = "agent@paybid.app"
AGENT_PWD = "Agent@123!"
PIN = "123456"

PASS, FAIL = [], []


def log(ok: bool, name: str, extra: str = ""):
    tag = "PASS" if ok else "FAIL"
    line = f"[{tag}] {name}" + (f" :: {extra}" if extra else "")
    print(line, flush=True)
    (PASS if ok else FAIL).append((name, extra))


def req(method: str, path: str, *, token: Optional[str] = None, json_body: Any = None,
        params: Optional[dict] = None, expected: Optional[int] = None, name: str = ""):
    url = f"{API}{path}"
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    try:
        r = requests.request(method, url, headers=headers, json=json_body, params=params, timeout=30)
    except Exception as e:
        log(False, name or f"{method} {path}", f"Exception: {e}")
        return None, None
    try:
        body = r.json()
    except Exception:
        body = r.text
    if expected is not None:
        ok = r.status_code == expected
        log(ok, name or f"{method} {path}", f"status={r.status_code} body={str(body)[:300]}")
    return r, body


def get_fx(token: str) -> float:
    try:
        r = requests.get(f"{API}/transfers/fx-rate",
                         params={"from_currency": "EUR", "to_currency": "XOF"},
                         headers={"Authorization": f"Bearer {token}"}, timeout=15)
        return float(r.json().get("rate", 655.957))
    except Exception:
        return 655.957


def main():
    print(f"BACKEND = {BACKEND}\n")

    # ---------------- Login (regression) ----------------
    r, body = req("POST", "/auth/login",
                  json_body={"identifier": CLIENT_EMAIL, "password": CLIENT_PWD},
                  expected=200, name="REG-1 POST /auth/login (client)")
    if not r or r.status_code != 200:
        print("[ABORT] cannot login as client.")
        sys.exit(1)
    client_token = body["access_token"]

    # Agent login
    r2, body2 = req("POST", "/auth/login",
                    json_body={"identifier": AGENT_EMAIL, "password": AGENT_PWD},
                    expected=200, name="REG-1b POST /auth/login (agent)")
    agent_token = body2["access_token"] if r2 and r2.status_code == 200 else None

    # ---------------- 1) PUT /api/auth/me ----------------
    new_phone = "+33611223344"
    r, body = req("PUT", "/auth/me", token=client_token,
                  json_body={"phone": new_phone, "address": "12 Rue de la Paix, Paris"},
                  expected=200, name="NEW-1 PUT /auth/me (phone+address)")
    if r and r.status_code == 200:
        u = body.get("user") or {}
        log(u.get("phone") == new_phone,
            "NEW-1.1 PUT /auth/me returns updated phone in body",
            f"got={u.get('phone')}")
    # Verify persistence via GET
    r, body = req("GET", "/auth/me", token=client_token, expected=200,
                  name="NEW-1.2 GET /auth/me persists phone update")
    if r and r.status_code == 200:
        log((body.get("user") or {}).get("phone") == new_phone,
            "NEW-1.3 GET /auth/me phone persisted",
            f"got={(body.get('user') or {}).get('phone')}")

    # Restore original phone (best effort)
    req("PUT", "/auth/me", token=client_token,
        json_body={"phone": "+33612345678"}, expected=200,
        name="NEW-1.4 PUT /auth/me restore phone")

    # ---------------- 2) POST /api/wallet/withdraw ----------------
    r, w = req("GET", "/wallet", token=client_token, expected=200, name="REG GET /wallet (pre-withdraw)")
    initial_balance = float(w.get("balance", 0)) if isinstance(w, dict) else 0
    print(f"[i] initial wallet balance = {initial_balance}")

    # Error: amount<=0
    req("POST", "/wallet/withdraw", token=client_token,
        json_body={"amount": 0, "method": "bank",
                   "details": {"iban": "FR7630006000011234567890189", "holder": "Demo Client",
                               "bank": "BNP Paribas", "bic": "BNPAFRPP"}},
        expected=400, name="NEW-2 POST /wallet/withdraw amount<=0 → 400")

    # Error: bad method
    req("POST", "/wallet/withdraw", token=client_token,
        json_body={"amount": 10, "method": "foo",
                   "details": {"iban": "FR7630006000011234567890189", "holder": "Demo Client"}},
        expected=400, name="NEW-2 POST /wallet/withdraw method=foo → 400")

    # Error: missing iban
    req("POST", "/wallet/withdraw", token=client_token,
        json_body={"amount": 10, "method": "bank",
                   "details": {"holder": "Demo Client"}},
        expected=400, name="NEW-2 POST /wallet/withdraw missing iban → 400")

    # Success: amount=20 (debit 21 = 20 + 1 EUR fee)
    withdraw_amount = 20.0
    fee = 1.0
    r, body = req("POST", "/wallet/withdraw", token=client_token,
                  json_body={"amount": withdraw_amount, "method": "bank",
                             "details": {"iban": "FR7630006000011234567890189",
                                         "holder": "Demo Client", "bank": "BNP Paribas",
                                         "bic": "BNPAFRPP"}},
                  expected=200, name="NEW-2 POST /wallet/withdraw success")
    if r and r.status_code == 200 and isinstance(body, dict):
        log(body.get("ok") is True, "NEW-2.1 withdraw ok=true",
            f"body={json.dumps(body)[:200]}")
        log(bool(body.get("tx_id")), "NEW-2.2 withdraw returns tx_id",
            f"tx_id={body.get('tx_id')}")
        log(bool(body.get("payout_id")), "NEW-2.3 withdraw returns payout_id",
            f"payout_id={body.get('payout_id')}")
        log(body.get("eta_days") == 3, "NEW-2.4 withdraw eta_days=3",
            f"eta_days={body.get('eta_days')}")
        log(body.get("fee") == 1.0, "NEW-2.5 withdraw fee=1.0",
            f"fee={body.get('fee')}")

        # Verify wallet debit = amount + fee
        r2, w2 = req("GET", "/wallet", token=client_token, expected=200,
                     name="NEW-2.6 GET /wallet (post-withdraw)")
        if r2 and isinstance(w2, dict):
            new_balance = float(w2.get("balance", 0))
            expected = round(initial_balance - (withdraw_amount + fee), 2)
            actual = round(new_balance, 2)
            log(abs(actual - expected) < 0.01,
                "NEW-2.7 wallet debited by amount+fee (1 EUR)",
                f"initial={initial_balance} new={new_balance} expected={expected}")

    # Error: insufficient balance
    req("POST", "/wallet/withdraw", token=client_token,
        json_body={"amount": 999999, "method": "bank",
                   "details": {"iban": "FR7630006000011234567890189",
                               "holder": "Demo Client"}},
        expected=400, name="NEW-2 POST /wallet/withdraw insufficient → 400")

    # ---------------- 3) POST /api/payment-methods (label optional) ----------------
    payload_no_label = {
        "type": "card",
        "brand": "visa",
        "last4": "4242",
        "holder": "JOHN DOE",
        "exp_month": 12,
        "exp_year": 2027,
        "save": True,
    }
    r, body = req("POST", "/payment-methods", token=client_token,
                  json_body=payload_no_label,
                  expected=200, name="UPD-3 POST /payment-methods (NO label)")
    if r and r.status_code == 200 and isinstance(body, dict):
        derived = body.get("label")
        log(derived == "Visa •••• 4242",
            "UPD-3.1 auto-derived label = 'Visa •••• 4242'",
            f"got={derived!r}")
        if body.get("id"):
            req("DELETE", f"/payment-methods/{body['id']}", token=client_token,
                expected=200, name="UPD-3.2 cleanup DELETE /payment-methods/{id}")

    # ---------------- 4) GET /api/sessions ----------------
    r, body = req("GET", "/sessions", token=client_token, expected=200,
                  name="NEW-4 GET /sessions")
    sessions_list = body if isinstance(body, list) else []
    log(len(sessions_list) >= 1, "NEW-4.1 sessions has at least 1 entry",
        f"count={len(sessions_list)}")
    has_password_kind = any(s.get("kind") == "password" for s in sessions_list)
    log(has_password_kind, "NEW-4.2 at least 1 session.kind == 'password'",
        f"kinds={[s.get('kind') for s in sessions_list[:5]]}")

    # ---------------- 5) POST /api/sessions/revoke ----------------
    if sessions_list and len(sessions_list) > 1:
        target = sessions_list[-1]
        if target.get("id"):
            req("POST", "/sessions/revoke", token=client_token,
                json_body={"session_id": target["id"]},
                expected=200, name="NEW-5 POST /sessions/revoke (oldest)")
    elif sessions_list:
        # only one — re-login to get more, then revoke the older one
        r2, b2 = req("POST", "/auth/login",
                     json_body={"identifier": CLIENT_EMAIL, "password": CLIENT_PWD},
                     expected=200, name="NEW-5.pre re-login to add session")
        new_tok = b2["access_token"] if r2 else client_token
        r3, b3 = req("GET", "/sessions", token=new_tok, expected=200,
                     name="NEW-5.pre GET /sessions after re-login")
        if isinstance(b3, list) and len(b3) >= 1:
            target = b3[-1]
            req("POST", "/sessions/revoke", token=new_tok,
                json_body={"session_id": target["id"]},
                expected=200, name="NEW-5 POST /sessions/revoke")
            client_token = new_tok

    # Re-login to be sure we have a fresh active session before revoke-all
    r, body = req("POST", "/auth/login",
                  json_body={"identifier": CLIENT_EMAIL, "password": CLIENT_PWD},
                  expected=200, name="NEW-6.pre re-login before revoke-all")
    fresh_token = body["access_token"] if r and r.status_code == 200 else client_token

    # ---------------- 6) POST /api/sessions/revoke-all ----------------
    r, body = req("POST", "/sessions/revoke-all", token=fresh_token,
                  expected=200, name="NEW-6 POST /sessions/revoke-all")
    if r and r.status_code == 200 and isinstance(body, dict):
        log(body.get("ok") is True, "NEW-6.1 revoke-all ok=true",
            f"body={json.dumps(body)}")
        log("revoked" in body and isinstance(body["revoked"], int),
            "NEW-6.2 revoke-all returns 'revoked' count",
            f"revoked={body.get('revoked')}")

    # New token
    r, body = req("POST", "/auth/login",
                  json_body={"identifier": CLIENT_EMAIL, "password": CLIENT_PWD},
                  expected=200, name="post-revoke-all re-login")
    client_token = body["access_token"] if r and r.status_code == 200 else client_token

    # ---------------- 7) GET /api/kyc/corporate ----------------
    r, body = req("GET", "/kyc/corporate", token=client_token, expected=200,
                  name="NEW-7 GET /kyc/corporate (auto-create)")
    if r and r.status_code == 200 and isinstance(body, dict):
        cur_level = body.get("level", 0)
        cur_status = body.get("status", "")
        log("level" in body and "status" in body,
            "NEW-7.1 GET /kyc/corporate has level+status",
            f"level={cur_level} status={cur_status}")
        if cur_level == 0:
            log(cur_status == "NOT_STARTED",
                "NEW-7.2 fresh row has status=NOT_STARTED",
                f"status={cur_status}")
        else:
            print(f"[i] /kyc/corporate already at level={cur_level} status={cur_status} (from prior run; not a failure)")

    # ---------------- Negative test: level2 without level1 (fresh user) ----------------
    rand = uuid.uuid4().hex[:8]
    new_email = f"corp-{rand}@sendbid.app"
    new_phone_reg = f"+3370{rand[-7:].translate(str.maketrans('abcdef', '012345'))}"
    # ensure phone is digits only
    new_phone_reg = "+33" + "".join(c if c.isdigit() else "0" for c in new_phone_reg[3:])[:9]
    r_reg, body_reg = req("POST", "/auth/register",
                          json_body={"email": new_email, "phone": new_phone_reg,
                                     "password": "Password123!", "full_name": f"Corp Test {rand}"},
                          name="NEW-9.pre register fresh user (for level2 reject path)")
    fresh_user_token = None
    if r_reg and r_reg.status_code == 200 and isinstance(body_reg, dict):
        eotp = body_reg.get("dev_email_otp")
        potp = body_reg.get("dev_phone_otp")
        u_id = body_reg.get("user_id")
        if eotp and potp and u_id:
            r_v, body_v = req("POST", "/auth/verify-otp",
                              json_body={"user_id": u_id,
                                         "email_code": eotp, "phone_code": potp},
                              expected=200, name="NEW-9.pre verify-otp fresh user")
            if r_v and r_v.status_code == 200:
                fresh_user_token = body_v["access_token"]
        else:
            print("[i] dev OTP codes not exposed (prod mode?) — skipping negative level2 test")
    if fresh_user_token:
        # POST /kyc/corporate/level2 directly without level1 → 400
        req("POST", "/kyc/corporate/level2", token=fresh_user_token,
            json_body={
                "kbis_url": "https://x/k.pdf", "statutes_url": "https://x/s.pdf",
                "ubos": [],
            },
            expected=400, name="NEW-9.2 level2 without level1 → 400")

    # ---------------- 8) POST /api/kyc/corporate/level1 ----------------
    level1_body = {
        "legal_name": "SENDBID DEMO SAS",
        "entity_type": "SAS",
        "registration_number": "RCS PARIS B 123 456 789",
        "country": "FR",
        "contact_email": "demo-corp@sendbid.app",
        "contact_phone": "+33145678900",
    }
    r, body = req("POST", "/kyc/corporate/level1", token=client_token,
                  json_body=level1_body, expected=200,
                  name="NEW-8 POST /kyc/corporate/level1")
    if r and r.status_code == 200 and isinstance(body, dict):
        log(body.get("ok") is True, "NEW-8.1 level1 ok=true",
            f"body={json.dumps(body)}")
        log(body.get("level") == 1, "NEW-8.2 level1 returns level=1",
            f"level={body.get('level')}")
        log(body.get("status") == "PENDING_REVIEW",
            "NEW-8.3 level1 status=PENDING_REVIEW",
            f"status={body.get('status')}")

    # ---------------- 9) POST /api/kyc/corporate/level2 ----------------
    level2_body = {
        "kbis_url": "https://demo.sendbid.app/kbis.pdf",
        "statutes_url": "https://demo.sendbid.app/statutes.pdf",
        "ubos": [
            {"full_name": "Jean Demo", "dob": "1980-05-12",
             "nationality": "FR", "ownership_pct": 60},
            {"full_name": "Marie Demo", "dob": "1982-08-20",
             "nationality": "FR", "ownership_pct": 40},
        ],
    }
    r, body = req("POST", "/kyc/corporate/level2", token=client_token,
                  json_body=level2_body, expected=200,
                  name="NEW-9 POST /kyc/corporate/level2")
    if r and r.status_code == 200 and isinstance(body, dict):
        log(body.get("level") == 2, "NEW-9.1 level2 returns level=2",
            f"level={body.get('level')}")

    # ---------------- 10) POST /api/kyc/corporate/level3 ----------------
    level3_body = {
        "representative_full_name": "John Demo",
        "representative_dob": "1985-03-15",
        "representative_nationality": "FR",
        "representative_role": "Président",
        "id_front_url": "https://demo.sendbid.app/id_front.jpg",
        "selfie_url": "https://demo.sendbid.app/selfie.jpg",
        "address_proof_url": "https://demo.sendbid.app/address.pdf",
    }
    r, body = req("POST", "/kyc/corporate/level3", token=client_token,
                  json_body=level3_body, expected=200,
                  name="NEW-10 POST /kyc/corporate/level3")
    if r and r.status_code == 200 and isinstance(body, dict):
        log(body.get("level") == 3, "NEW-10.1 level3 returns level=3",
            f"level={body.get('level')}")
        log(body.get("status") == "APPROVED",
            "NEW-10.2 level3 status=APPROVED (auto)",
            f"status={body.get('status')}")
    # Verify user.corporate_verified = true
    r, body = req("GET", "/auth/me", token=client_token, expected=200,
                  name="NEW-10.3 GET /auth/me after level3")
    if r and r.status_code == 200:
        u = body.get("user") or {}
        log(u.get("corporate_verified") is True,
            "NEW-10.4 user.corporate_verified == true",
            f"corporate_verified={u.get('corporate_verified')}")

    # ---------------- REGRESSION ----------------
    req("GET", "/auth/me", token=client_token, expected=200,
        name="REG GET /auth/me")
    req("GET", "/wallet", token=client_token, expected=200,
        name="REG GET /wallet")
    r, body = req("GET", "/wallet/transactions", token=client_token,
                  params={"limit": 50}, expected=200,
                  name="REG GET /wallet/transactions?limit=50")
    log(isinstance(body, list), "REG /wallet/transactions returns list",
        f"len={len(body) if isinstance(body, list) else 'N/A'}")

    # Beneficiaries
    bene_body = {
        "full_name": "Awa Diop",
        "phone": "+221770000000",
        "country": "SN",
        "city": "Dakar",
        "currency": "XOF",
        "relation": "family",
    }
    req("POST", "/beneficiaries", token=client_token, json_body=bene_body,
        expected=200, name="REG POST /beneficiaries")
    req("GET", "/beneficiaries", token=client_token, expected=200,
        name="REG GET /beneficiaries")

    # Payment methods GET
    req("GET", "/payment-methods", token=client_token, expected=200,
        name="REG GET /payment-methods")

    # Transfers
    req("GET", "/transfers", token=client_token, expected=200,
        name="REG GET /transfers")

    transfer_id = None
    fx = get_fx(client_token)
    fee_pct = 2.0
    send_amt = 50.0
    receive_amt = round(send_amt * fx, 2)
    draft_payload = {
        "destination_country": "SN",
        "destination_currency": "XOF",
        "send_amount": send_amt,
        "receive_amount": receive_amt,
        "fx_rate": fx,
        "fee_percent": fee_pct,
        "delivery_mode": "cash",
        "beneficiary": {"full_name": "Awa Diop", "country": "SN",
                        "city": "Dakar", "currency": "XOF",
                        "phone": "+221770000000"},
        "delivery_details": {"city": "Dakar", "address": "Sacré-Coeur",
                             "phone": "+221770000000"},
        "purpose": "family_support",
        "source_of_funds": "salary",
        "vip_delivery": False,
    }
    r, draft = req("POST", "/transfers/draft", token=client_token, json_body=draft_payload,
                   expected=200, name="REG POST /transfers/draft (cash SN)")
    if r and r.status_code == 200 and isinstance(draft, dict):
        draft_id = draft["id"]
        r, t = req("POST", "/transfers/confirm", token=client_token,
                   json_body={"draft_id": draft_id, "pin": PIN},
                   expected=200, name="REG POST /transfers/confirm (PIN)")
        if r and r.status_code == 200 and isinstance(t, dict):
            transfer_id = t["id"]
            log(t.get("status") == "BIDDING",
                "REG transfer status=BIDDING after confirm",
                f"status={t.get('status')}")

            time.sleep(4)
            r, bids = req("GET", f"/transfers/{transfer_id}/bids",
                          token=client_token, expected=200,
                          name="REG GET /transfers/{id}/bids")

            if agent_token:
                # Try to bid at fee_max=2.0 (but auto-bid may already exist below)
                r, bb = req("POST", f"/agent/auctions/{transfer_id}/bid", token=agent_token,
                            json_body={"transfer_id": transfer_id,
                                       "bid_fee_percent": 2.0,
                                       "eta_minutes": 30},
                            name="REG POST /agent/auctions/{id}/bid first @2.0%")
                if r and r.status_code == 200:
                    req("POST", f"/agent/auctions/{transfer_id}/bid", token=agent_token,
                        json_body={"transfer_id": transfer_id,
                                   "bid_fee_percent": 2.0,
                                   "eta_minutes": 30},
                        expected=400,
                        name="REG re-bid @2.0% (descending) → 400")
                    req("POST", f"/agent/auctions/{transfer_id}/bid", token=agent_token,
                        json_body={"transfer_id": transfer_id,
                                   "bid_fee_percent": 1.50,
                                   "eta_minutes": 30},
                        expected=200,
                        name="REG lower bid @1.50% → 200")
                else:
                    detail = ""
                    try:
                        detail = (bb or {}).get("detail", "")
                    except Exception:
                        pass
                    log(r is not None and r.status_code == 400 and "scendante" in (detail or "").lower(),
                        "REG /agent/auctions/.../bid 2.0% rejected (auto-bid lower) → 400 'descendante'",
                        f"status={r.status_code if r else 'N/A'} detail={detail}")
                    if isinstance(bids, list) and bids:
                        cur_best = min(b.get("bid_fee_percent", 99) for b in bids)
                        target = round(max(0.6, cur_best - 0.10), 2)
                        if target < cur_best:
                            req("POST", f"/agent/auctions/{transfer_id}/bid", token=agent_token,
                                json_body={"transfer_id": transfer_id,
                                           "bid_fee_percent": target,
                                           "eta_minutes": 30},
                                expected=200,
                                name=f"REG lower bid @{target}% → 200")

    # Disputes
    req("GET", "/disputes", token=client_token, expected=200, name="REG GET /disputes")
    if transfer_id:
        req("POST", "/disputes", token=client_token,
            json_body={"transfer_id": transfer_id, "reason": "delay",
                       "description": "Test dispute v6 regression"},
            expected=200, name="REG POST /disputes")

    # Notifications, corridors, scheduled-transfers
    req("GET", "/notifications", token=client_token, expected=200, name="REG GET /notifications")
    r, body = req("GET", "/corridors", token=client_token, expected=200, name="REG GET /corridors")
    if r and r.status_code == 200 and isinstance(body, dict):
        log(body.get("count", 0) >= 8, "REG /corridors count >=8",
            f"count={body.get('count')}")
    req("GET", "/scheduled-transfers", token=client_token, expected=200,
        name="REG GET /scheduled-transfers")

    # ---------------- Final summary ----------------
    print()
    print("=" * 70)
    print(f"TOTAL PASS = {len(PASS)}")
    print(f"TOTAL FAIL = {len(FAIL)}")
    if FAIL:
        print()
        print("FAILURES:")
        for n, e in FAIL:
            print(f"  - {n} :: {e}")
    print("=" * 70)
    sys.exit(0 if not FAIL else 1)


if __name__ == "__main__":
    main()
