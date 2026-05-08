"""Backend v6.4 tests:
A) Support chat
B) Re-verify email/phone
C) Profile patch default_currency / theme
"""
import requests
import sys

BASE = "https://mobile-transfer-hub-3.preview.emergentagent.com/api"
CLIENT = {"identifier": "client@sendbid.app", "password": "Client@123!"}

results = []

def log(name, ok, detail=""):
    status = "PASS" if ok else "FAIL"
    print(f"[{status}] {name}: {detail}")
    results.append((name, ok, detail))


def login():
    r = requests.post(f"{BASE}/auth/login", json=CLIENT, timeout=30)
    r.raise_for_status()
    j = r.json()
    return j.get("access_token") or j.get("token")


def main():
    token = login()
    H = {"Authorization": f"Bearer {token}"}

    # === A) Support chat ===
    # Ensure clean: close any open ticket first (best-effort)
    try:
        requests.post(f"{BASE}/support/chat/close", headers=H, timeout=15)
    except Exception:
        pass

    # A.1 open
    r = requests.post(f"{BASE}/support/chat/open", headers=H, timeout=15)
    body = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
    ok = r.status_code == 200 and "ticket_id" in body and body.get("status") == "open" and "created_at" in body
    log("A.1 POST /support/chat/open", ok, f"status={r.status_code} body={body}")
    ticket_id_1 = body.get("ticket_id")

    # A.1b second call returns same ticket
    r2 = requests.post(f"{BASE}/support/chat/open", headers=H, timeout=15)
    body2 = r2.json() if r2.status_code == 200 else {}
    same = body2.get("ticket_id") == ticket_id_1
    log("A.1b same ticket on second open", same and r2.status_code == 200,
        f"first={ticket_id_1} second={body2.get('ticket_id')}")

    # A.2 messages — must contain at least 1 bot welcome
    r = requests.get(f"{BASE}/support/chat/messages", headers=H, timeout=15)
    body = r.json() if r.status_code == 200 else {}
    msgs = body.get("messages", [])
    has_bot = any(m.get("sender") == "bot" for m in msgs)
    ok = r.status_code == 200 and body.get("ticket_id") == ticket_id_1 and has_bot
    log("A.2 GET /support/chat/messages (welcome bot)", ok,
        f"status={r.status_code} count={len(msgs)} has_bot={has_bot}")

    # A.3 send "bonjour"
    r = requests.post(f"{BASE}/support/chat/send", headers=H,
                      json={"message": "bonjour"}, timeout=15)
    body = r.json() if r.status_code == 200 else {}
    bot_text = (body.get("bot_reply") or {}).get("text", "")
    has_user = bool((body.get("user_message") or {}).get("text"))
    matches = ("assistant virtuel" in bot_text.lower()) or ("sendbid" in bot_text.lower())
    ok = r.status_code == 200 and has_user and matches
    log("A.3 POST /support/chat/send 'bonjour'", ok,
        f"status={r.status_code} bot_reply='{bot_text[:120]}'")

    # A.4 send KYC question
    r = requests.post(f"{BASE}/support/chat/send", headers=H,
                      json={"message": "j'ai un problème avec mon KYC"}, timeout=15)
    body = r.json() if r.status_code == 200 else {}
    bot_text = (body.get("bot_reply") or {}).get("text", "")
    matches = ("tier" in bot_text.lower()) or ("kyc" in bot_text.lower())
    ok = r.status_code == 200 and matches
    log("A.4 POST /support/chat/send 'KYC'", ok,
        f"status={r.status_code} bot_reply='{bot_text[:120]}'")

    # A.5 close
    r = requests.post(f"{BASE}/support/chat/close", headers=H, timeout=15)
    body = r.json() if r.status_code == 200 else {}
    ok = r.status_code == 200 and body.get("ok") is True
    log("A.5 POST /support/chat/close", ok, f"status={r.status_code} body={body}")

    # === B) Re-verify ===
    # B.1 phone OTP valid
    r = requests.post(f"{BASE}/auth/request-phone-otp", headers=H,
                      json={"phone": "+33612345678"}, timeout=15)
    body = r.json() if r.status_code == 200 else {}
    ok = r.status_code == 200 and body.get("ok") is True and body.get("sent_to") == "5678"
    log("B.1 phone-otp +33612345678", ok, f"status={r.status_code} body={body}")

    # B.2 empty phone
    r = requests.post(f"{BASE}/auth/request-phone-otp", headers=H,
                      json={"phone": ""}, timeout=15)
    body = r.json() if r.status_code == 400 else {}
    detail = body.get("detail", "")
    ok = r.status_code == 400 and "invalide" in detail.lower()
    log("B.2 phone-otp empty → 400 'invalide'", ok, f"status={r.status_code} body={body}")

    # B.3 email change valid
    r = requests.post(f"{BASE}/auth/request-email-change", headers=H,
                      json={"new_email": "newuser.test.v64@sendbid.app"}, timeout=15)
    body = r.json() if r.status_code == 200 else {}
    ok = r.status_code == 200 and body.get("ok") is True and body.get("sent_to") == "newuser.test.v64@sendbid.app"
    log("B.3 email-change new address", ok, f"status={r.status_code} body={body}")

    # B.4 invalid no @
    r = requests.post(f"{BASE}/auth/request-email-change", headers=H,
                      json={"new_email": "invalid_no_at"}, timeout=15)
    ok = r.status_code == 400
    log("B.4 email-change invalid → 400", ok,
        f"status={r.status_code} body={r.text[:200]}")

    # B.5 email already used (admin)
    r = requests.post(f"{BASE}/auth/request-email-change", headers=H,
                      json={"new_email": "admin@sendbid.app"}, timeout=15)
    body = r.json() if r.status_code in (400, 409) else {}
    detail = body.get("detail", "")
    ok = r.status_code == 409 and "utilisée" in detail.lower()
    log("B.5 email-change duplicate (admin@) → 409 'utilisée'", ok,
        f"status={r.status_code} body={body}")

    # === C) Profile PATCH ===
    # C.1 default_currency XOF
    r = requests.patch(f"{BASE}/profile", headers=H,
                       json={"default_currency": "XOF"}, timeout=15)
    ok_patch1 = r.status_code == 200
    log("C.1a PATCH /profile default_currency=XOF", ok_patch1,
        f"status={r.status_code}")
    r = requests.get(f"{BASE}/auth/me", headers=H, timeout=15)
    body = r.json() if r.status_code == 200 else {}
    user_obj = body.get("user", body)  # /auth/me returns {user, ...} or just user
    cur = user_obj.get("default_currency")
    ok = r.status_code == 200 and cur == "XOF"
    log("C.1b GET /auth/me default_currency==XOF", ok,
        f"status={r.status_code} default_currency={cur}")

    # C.2 theme dark
    r = requests.patch(f"{BASE}/profile", headers=H,
                       json={"theme": "dark"}, timeout=15)
    ok_patch2 = r.status_code == 200
    log("C.2a PATCH /profile theme=dark", ok_patch2, f"status={r.status_code}")
    r = requests.get(f"{BASE}/auth/me", headers=H, timeout=15)
    body = r.json() if r.status_code == 200 else {}
    user_obj = body.get("user", body)
    theme = user_obj.get("theme")
    ok = r.status_code == 200 and theme == "dark"
    log("C.2b GET /auth/me theme==dark", ok, f"status={r.status_code} theme={theme}")

    # Summary
    passes = sum(1 for _, ok, _ in results if ok)
    total = len(results)
    print(f"\n=== {passes}/{total} PASS ===")
    for n, ok, d in results:
        if not ok:
            print(f"  FAIL: {n} — {d}")
    return 0 if passes == total else 1


if __name__ == "__main__":
    sys.exit(main())
