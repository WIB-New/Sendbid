"""Backend test — Dynamic corridors + Maps VIP-gating + sanity regression.

Run: python /app/backend_test_corridors_vip.py
Reads BACKEND from /app/frontend/.env (EXPO_PUBLIC_BACKEND_URL).
"""
from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path

import requests

# --- read base URL from frontend/.env --------------------------------------
ENV = Path("/app/frontend/.env").read_text()
BASE = None
for line in ENV.splitlines():
    if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
        BASE = line.split("=", 1)[1].strip().strip('"').rstrip("/")
        break
assert BASE, "EXPO_PUBLIC_BACKEND_URL missing"
API = f"{BASE}/api"
print(f"\n>>> Testing backend at {API}\n")

CLIENT_EMAIL = "client@sendbid.app"
CLIENT_PWD = "Client@123!"
PIN = "123456"

PASS = []
FAIL = []


def _ok(label, cond, extra=""):
    (PASS if cond else FAIL).append(label)
    mark = "OK " if cond else "FAIL"
    print(f"  [{mark}] {label} {extra}")
    return cond


def short(obj, n=400):
    s = json.dumps(obj, ensure_ascii=False) if not isinstance(obj, str) else obj
    return s[:n] + ("…" if len(s) > n else "")


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------
print("== AUTH ==")
r = requests.post(f"{API}/auth/login", json={"identifier": CLIENT_EMAIL, "password": CLIENT_PWD}, timeout=30)
_ok(f"POST /auth/login → {r.status_code}", r.status_code == 200, short(r.text, 120))
TOKEN = r.json()["access_token"]
H = {"Authorization": f"Bearer {TOKEN}"}

r = requests.get(f"{API}/auth/me", headers=H, timeout=30)
_ok(f"GET /auth/me → {r.status_code}", r.status_code == 200, short(r.json().get("profile_id"), 60))

r = requests.get(f"{API}/wallet", headers=H, timeout=30)
_ok(f"GET /wallet → {r.status_code}", r.status_code == 200, f"balance={r.json().get('balance')}")


# ---------------------------------------------------------------------------
# 1. Dynamic corridors
# ---------------------------------------------------------------------------
print("\n== 1. CORRIDORS ==")

r = requests.get(f"{API}/corridors", headers=H, timeout=30)
_ok(f"GET /corridors → {r.status_code}", r.status_code == 200)
body = r.json()
corridors = body.get("corridors", [])
_ok(f"/corridors count==8 (got {body.get('count')})", body.get("count") == 8)

required_keys = {
    "country_code", "country_name", "currency", "flag",
    "fx_rate_eur", "fx_margin_percent", "fx_fixed",
    "fee_percent_min", "fee_percent_max", "delivery_modes", "agents_count",
}
allowed_modes = {"cash", "bank", "momo"}
xof_zone = {"CI", "SN", "ML", "BF"}
for c in corridors:
    code = c.get("country_code", "?")
    missing = required_keys - set(c.keys())
    _ok(f"  corridor[{code}] has all keys", not missing, f"missing={missing}" if missing else "")
    modes = c.get("delivery_modes") or []
    _ok(f"  corridor[{code}] delivery_modes non-empty subset of {allowed_modes}",
        bool(modes) and set(modes).issubset(allowed_modes),
        f"modes={modes}")
    if code in xof_zone or code == "ML" or code == "CI" or code == "SN":
        _ok(f"  corridor[{code}] fx_fixed=true (XOF zone)", bool(c.get("fx_fixed")), f"fx_fixed={c.get('fx_fixed')}")

r = requests.get(f"{API}/corridors/CI", headers=H, timeout=30)
_ok(f"GET /corridors/CI → {r.status_code}", r.status_code == 200)
ci = r.json()
_ok("  /corridors/CI delivery_modes contains cash", "cash" in (ci.get("delivery_modes") or []),
    f"modes={ci.get('delivery_modes')}")

r = requests.get(f"{API}/corridors/ZZ", headers=H, timeout=30)
_ok(f"GET /corridors/ZZ → {r.status_code} (expect 404)", r.status_code == 404)
_ok("  /corridors/ZZ detail message",
    r.json().get("detail") == "Corridor non disponible pour ce pays",
    short(r.json(), 100))

# countries/sending — PUBLIC, no auth
r = requests.get(f"{API}/countries/sending", timeout=30)
_ok(f"GET /countries/sending PUBLIC → {r.status_code}", r.status_code == 200)
body = r.json()
_ok(f"  /countries/sending count==17 (got {body.get('count')})", body.get("count") == 17)
codes = {c["country_code"]: c for c in body.get("countries", [])}
sender_codes = ["FR", "BE", "IT", "ES", "DE", "CH", "GB", "CA", "US"]
receiver_codes = ["CI", "SN", "ML", "CM", "MA", "NG", "GH", "BF"]
for cc in sender_codes:
    e = codes.get(cc)
    _ok(f"  sending[{cc}] is_receiver==false", bool(e) and e.get("is_receiver") is False,
        f"entry={e}")
for cc in receiver_codes:
    e = codes.get(cc)
    _ok(f"  sending[{cc}] is_receiver==true", bool(e) and e.get("is_receiver") is True,
        f"entry={e}")

# fx-rate
r = requests.get(f"{API}/transfers/fx-rate", headers=H, params={"from_currency": "EUR", "to_currency": "XOF"}, timeout=30)
_ok(f"GET /fx-rate EUR→XOF → {r.status_code}", r.status_code == 200)
b = r.json()
_ok("  fx-rate XOF rate==655.957", b.get("rate") == 655.957, short(b, 200))
_ok("  fx-rate XOF fixed=true", b.get("fixed") is True)
_ok("  fx-rate XOF country in XOF zone", b.get("country") in xof_zone, f"country={b.get('country')}")

r = requests.get(f"{API}/transfers/fx-rate", headers=H, params={"from_currency": "EUR", "to_currency": "NGN"}, timeout=30)
_ok(f"GET /fx-rate EUR→NGN → {r.status_code}", r.status_code == 200)
b = r.json()
_ok("  fx-rate NGN rate==1750.0", b.get("rate") == 1750.0, short(b, 200))
_ok("  fx-rate NGN fixed=false", b.get("fixed") is False)
_ok("  fx-rate NGN country=='NG'", b.get("country") == "NG")

r = requests.get(f"{API}/transfers/fx-rate", headers=H, params={"from_currency": "EUR", "to_currency": "XYZ"}, timeout=30)
_ok(f"GET /fx-rate EUR→XYZ fallback → {r.status_code}", r.status_code == 200)
b = r.json()
_ok("  fx-rate XYZ fallback rate==1.0", b.get("rate") == 1.0)
_ok("  fx-rate XYZ fallback fixed=false", b.get("fixed") is False)

# legacy /api/countries
r = requests.get(f"{API}/countries", headers=H, timeout=30)
_ok(f"GET /countries (legacy) → {r.status_code}", r.status_code == 200)
arr = r.json()
_ok(f"  legacy /countries len==8 (got {len(arr)})", len(arr) == 8)
all_in_recv = all(item.get("code") in receiver_codes for item in arr)
_ok("  legacy /countries entries are all receivers", all_in_recv,
    f"codes={[i.get('code') for i in arr]}")


# ---------------------------------------------------------------------------
# 2. Maps VIP gating
# ---------------------------------------------------------------------------
print("\n== 2. MAPS VIP GATING ==")

# Get or create a beneficiary
r = requests.get(f"{API}/beneficiaries", headers=H, timeout=30)
bens = r.json() if r.status_code == 200 else []
ben = next((b for b in bens if b.get("country") == "CI"), None)
if not ben:
    r = requests.post(f"{API}/beneficiaries", headers=H, json={
        "full_name": "Aïcha Koné", "phone": "+2250500000000",
        "country": "CI", "currency": "XOF", "relation": "family",
    }, timeout=30)
    _ok(f"POST /beneficiaries (CI) → {r.status_code}", r.status_code == 200)
    ben = r.json()
print(f"  using beneficiary id={ben.get('id')}")

base_payload = {
    "destination_country": "CI",
    "destination_currency": "XOF",
    "send_amount": 100,
    "receive_amount": 65595,
    "fx_rate": 655.957,
    "fee_percent": 2,
    "delivery_mode": "cash",
    "purpose": "family_support",
    "source_of_funds": "salary",
    "beneficiary": {
        "id": ben["id"], "full_name": ben.get("full_name", "Test Ben"),
        "country": "CI", "currency": "XOF",
        "relation": "family", "phone": ben.get("phone", "+2250500000000"),
    },
}


def create_transfer(vip: bool) -> str | None:
    payload = {**base_payload, "vip_delivery": vip}
    r = requests.post(f"{API}/transfers/draft", headers=H, json=payload, timeout=30)
    if not _ok(f"POST /transfers/draft (vip={vip}) → {r.status_code}",
               r.status_code == 200, short(r.text, 200)):
        return None
    draft_id = r.json()["id"]
    r = requests.post(f"{API}/transfers/confirm", headers=H,
                      json={"draft_id": draft_id, "pin": PIN}, timeout=30)
    if not _ok(f"POST /transfers/confirm (vip={vip}) → {r.status_code}",
               r.status_code == 200, short(r.text, 200)):
        return None
    return r.json()["id"]


# NON-VIP transfer
non_vip_id = create_transfer(vip=False)
if non_vip_id:
    r = requests.get(f"{API}/maps/transfer/{non_vip_id}/route",
                     headers=H, params={"mode": "drive"}, timeout=30)
    _ok(f"GET /maps/transfer/{non_vip_id[:8]}/route (non-vip) → {r.status_code}",
        r.status_code == 200)
    body = r.json()
    _ok("  non-vip ok==False", body.get("ok") is False, short(body, 250))
    _ok("  non-vip stub==True", body.get("stub") is True)
    _ok("  non-vip stub_reason=='non_vip_transfer'",
        body.get("stub_reason") == "non_vip_transfer")
    _ok("  non-vip vip_delivery==False", body.get("vip_delivery") is False)
    msg = body.get("message", "")
    _ok("  non-vip message contains 'VIP'", "VIP" in msg, f"message={msg!r}")
    _ok("  non-vip MUST NOT include embed_url",
        "embed_url" not in body, f"keys={list(body.keys())}")
    _ok("  non-vip MUST NOT include static_url",
        "static_url" not in body)

# VIP transfer
vip_id = create_transfer(vip=True)
if vip_id:
    # First poll: may be no_agent_assigned or already assigned.
    r = requests.get(f"{API}/maps/transfer/{vip_id}/route",
                     headers=H, params={"mode": "drive"}, timeout=30)
    _ok(f"GET /maps/transfer/{vip_id[:8]}/route (vip) initial → {r.status_code}",
        r.status_code == 200)
    body = r.json()
    print(f"    initial body keys: {list(body.keys())}, stub_reason={body.get('stub_reason')}")

    has_embed = "embed_url" in body
    if not has_embed:
        # Wait briefly for auction to assign agent, or force via complete-mock?
        # complete-mock sets COMPLETED, which doesn't assign an agent.
        # The auction simulator runs in background; wait up to ~50s.
        print("  waiting up to 60s for auction agent assignment…")
        deadline = time.time() + 60
        while time.time() < deadline:
            time.sleep(5)
            t = requests.get(f"{API}/transfers/{vip_id}", headers=H, timeout=30).json()
            if t.get("agent_id"):
                break
        r = requests.get(f"{API}/maps/transfer/{vip_id}/route",
                         headers=H, params={"mode": "drive"}, timeout=30)
        body = r.json()
        print(f"    after wait keys: {list(body.keys())}, stub_reason={body.get('stub_reason')}")

    if "embed_url" in body:
        _ok("  vip embed_url contains 'google.com/maps/embed'",
            "google.com/maps/embed" in (body.get("embed_url") or ""),
            short(body.get("embed_url"), 200))
        _ok("  vip has static_url", bool(body.get("static_url")),
            short(body.get("static_url"), 200))
        _ok("  vip has distance_text", bool(body.get("distance_text")),
            f"distance={body.get('distance_text')}")
        _ok("  vip has duration_text", bool(body.get("duration_text")),
            f"duration={body.get('duration_text')}")
    else:
        # acceptable per review: stub_reason == no_agent_assigned
        _ok("  vip stub_reason=='no_agent_assigned' (acceptable)",
            body.get("stub_reason") == "no_agent_assigned",
            f"stub_reason={body.get('stub_reason')}")


# ---------------------------------------------------------------------------
# 3. Sanity regression
# ---------------------------------------------------------------------------
print("\n== 3. SANITY REGRESSION ==")

r = requests.get(f"{API}/maps/config", timeout=30)
_ok(f"GET /maps/config → {r.status_code}", r.status_code == 200)
_ok("  /maps/config enabled==true", r.json().get("enabled") is True)

r = requests.get(f"{API}/payments/packages", headers=H, timeout=30)
_ok(f"GET /payments/packages → {r.status_code}", r.status_code == 200)
pkgs = r.json().get("packages") or r.json()
# server returns dict with 'packages' key; tolerate both
if isinstance(r.json(), dict) and "packages" in r.json():
    pkgs = r.json()["packages"]
_ok(f"  /payments/packages len==4 (got {len(pkgs) if isinstance(pkgs, list) else 'n/a'})",
    isinstance(pkgs, list) and len(pkgs) == 4, short(r.json(), 200))

r = requests.post(f"{API}/kyc/tier2/start", headers=H, timeout=30)
_ok(f"POST /kyc/tier2/start → {r.status_code}", r.status_code == 200)
b = r.json()
url = b.get("verification_url", "")
_ok("  /kyc/tier2/start verification_url is real Didit URL",
    url.startswith("https://verify.didit.me/session/"),
    f"url={url}")
_ok("  /kyc/tier2/start provider=='didit'", b.get("provider") == "didit")


# ---------------------------------------------------------------------------
print("\n=== SUMMARY ===")
print(f"PASS: {len(PASS)}")
print(f"FAIL: {len(FAIL)}")
if FAIL:
    print("\nFailing checks:")
    for f in FAIL:
        print(f"  - {f}")
sys.exit(0 if not FAIL else 1)
