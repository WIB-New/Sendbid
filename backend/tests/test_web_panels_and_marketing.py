"""
Backend tests for SendBID Marketing Website + Web Panels (Jinja2 SSR).
Also covers a small regression suite for core mobile APIs.

All tests use localhost:8001 per main agent's instruction.
"""
import os
import pytest
import requests

BASE_URL = "http://localhost:8001"

# ---- credentials seeded by backend (see /app/memory/test_credentials.md and seed code) ----
CLIENT_EMAIL = "client@sendbid.app"
CLIENT_PASSWORD = "Client@123!"

ADMIN_EMAIL = "admin@sendbid.app"
ADMIN_PASSWORD = "Admin@123!"

AGENT_EMAIL = "agent@paybid.app"
AGENT_PASSWORD = "Agent@123!"

SUPERAGENT_EMAIL = "superagent@sendbid.app"
# After iteration-9 fix: seed.py now uses role='super_agent' and password 'Super@123!'.
SUPERAGENT_PASSWORD = "Super@123!"


@pytest.fixture(scope="session")
def http():
    s = requests.Session()
    s.headers.update({"User-Agent": "sendfloo-tester/1.0"})
    return s


def _get(http, path, **kw):
    return http.get(f"{BASE_URL}{path}", timeout=20, **kw)


def _post(http, path, **kw):
    return http.post(f"{BASE_URL}{path}", timeout=20, **kw)


# ============================================================
# TEST 1 — Marketing pages (PUBLIC)
# ============================================================
MARKETING_CASES = [
    ("/api/web/", ["Envoyez de l'argent", "SendBID", "PayBID"]),
    ("/api/web", ["Envoyez de l'argent", "SendBID", "PayBID"]),
    ("/api/web/features", ["Fonctionnalités", "Enchère inverse"]),
    ("/api/web/pricing", ["Transparent", "SendBID Free", "PayBID Agent", "Super-Agent"]),
    ("/api/web/faq", ["Questions fréquentes"]),
    ("/api/web/about", ["Notre histoire"]),
    ("/api/web/download", ["Télécharger"]),
]


@pytest.mark.parametrize("path,must_contain", MARKETING_CASES)
def test_marketing_pages_public(http, path, must_contain):
    r = _get(http, path, allow_redirects=False)
    assert r.status_code == 200, f"{path} -> {r.status_code}: {r.text[:200]}"
    body = r.text
    missing = [t for t in must_contain if t not in body]
    assert not missing, f"{path} missing expected text: {missing}"


# ============================================================
# TEST 2 — Panel login flow
# ============================================================
PANEL_CREDS = {
    "admin": (ADMIN_EMAIL, ADMIN_PASSWORD),
    "agent": (AGENT_EMAIL, AGENT_PASSWORD),
    "superagent": (SUPERAGENT_EMAIL, SUPERAGENT_PASSWORD),
}


@pytest.mark.parametrize("role", ["admin", "agent", "superagent"])
def test_panel_login_form_unauthenticated(http, role):
    r = _get(http, f"/api/web/{role}", allow_redirects=False)
    assert r.status_code == 200, f"GET /web/{role} unauth -> {r.status_code}"
    assert "Se connecter" in r.text, "Login form missing 'Se connecter'"


@pytest.mark.parametrize("role", ["admin", "agent", "superagent"])
def test_panel_login_wrong_credentials(http, role):
    r = _post(
        http,
        f"/api/web/{role}/login",
        data={"email": PANEL_CREDS[role][0], "password": "WRONG_password!"},
        allow_redirects=False,
    )
    # Should re-render login (401) with error
    assert r.status_code == 401, f"wrong creds -> {r.status_code}"
    assert "Identifiants invalides" in r.text or "Accès refusé" in r.text or "Se connecter" in r.text


# Holds cookies across login -> dashboard for each role
@pytest.fixture(scope="session")
def role_cookies():
    return {}


@pytest.mark.parametrize("role", ["admin", "agent", "superagent"])
def test_panel_login_success_sets_cookie(http, role, role_cookies):
    email, pwd = PANEL_CREDS[role]
    r = requests.post(
        f"{BASE_URL}/api/web/{role}/login",
        data={"email": email, "password": pwd},
        allow_redirects=False,
        timeout=20,
    )
    assert r.status_code == 303, f"login -> {r.status_code}: {r.text[:300]}"
    cookie_name = f"sb_web_session_{role}"
    set_cookie = r.headers.get("set-cookie", "")
    assert cookie_name in set_cookie, f"Set-Cookie missing {cookie_name}: {set_cookie}"
    # Capture cookie value
    val = None
    for c in r.cookies:
        if c.name == cookie_name:
            val = c.value
    assert val, f"cookie {cookie_name} not in jar"
    role_cookies[role] = {cookie_name: val}


@pytest.mark.parametrize("role", ["admin", "agent", "superagent"])
def test_panel_dashboard_with_cookie(http, role, role_cookies):
    if role not in role_cookies:
        pytest.skip(f"login for {role} did not run/succeed")
    r = requests.get(
        f"{BASE_URL}/api/web/{role}",
        cookies=role_cookies[role],
        allow_redirects=False,
        timeout=20,
    )
    assert r.status_code == 200, f"GET /web/{role} authed -> {r.status_code}"
    assert "Tableau de bord" in r.text or "tableau de bord" in r.text.lower(), \
        f"Dashboard heading missing for {role}"


# ============================================================
# TEST 3 — Admin panel sections
# ============================================================
ADMIN_SECTIONS = [
    ("/api/web/admin", ["Derniers transferts"]),
    ("/api/web/admin/users", ["Tous les utilisateurs"]),
    ("/api/web/admin/agents", ["Tous les agents"]),
    ("/api/web/admin/transfers", ["Tous les transferts"]),
    ("/api/web/admin/auctions", ["Enchères"]),  # "en cours" or "Aucune"
    ("/api/web/admin/wallets", ["Wallets"]),
    ("/api/web/admin/audit", ["Mouvements de fonds"]),
]


@pytest.mark.parametrize("path,must_contain", ADMIN_SECTIONS)
def test_admin_sections(role_cookies, path, must_contain):
    if "admin" not in role_cookies:
        pytest.skip("admin login did not succeed")
    r = requests.get(
        f"{BASE_URL}{path}", cookies=role_cookies["admin"], timeout=20, allow_redirects=False
    )
    assert r.status_code == 200, f"{path} -> {r.status_code}"
    missing = [t for t in must_contain if t not in r.text]
    assert not missing, f"{path} missing: {missing}"


# ============================================================
# TEST 4 — Agent panel sections
# ============================================================
AGENT_SECTIONS = [
    ("/api/web/agent", ["Mon espace agent", "Statut"]),  # any of these
    ("/api/web/agent/auctions", ["Enchères live"]),
    ("/api/web/agent/transfers", ["Mes transferts"]),
    ("/api/web/agent/float", ["Float multi-devises"]),
    ("/api/web/agent/earnings", ["Mes gains"]),
]


@pytest.mark.parametrize("path,any_of", AGENT_SECTIONS)
def test_agent_sections(role_cookies, path, any_of):
    if "agent" not in role_cookies:
        pytest.skip("agent login did not succeed")
    r = requests.get(
        f"{BASE_URL}{path}", cookies=role_cookies["agent"], timeout=20, allow_redirects=False
    )
    assert r.status_code == 200, f"{path} -> {r.status_code}"
    if path == "/api/web/agent":
        # dashboard accepts either marker
        assert any(t in r.text for t in any_of), f"{path} missing any of {any_of}"
    else:
        missing = [t for t in any_of if t not in r.text]
        assert not missing, f"{path} missing: {missing}"


# ============================================================
# TEST 5 — Superagent panel sections
# ============================================================
SUPER_SECTIONS = [
    ("/api/web/superagent", ["Mon réseau"]),
    ("/api/web/superagent/agents", ["Mon réseau"]),
    ("/api/web/superagent/transfers", ["Transferts du réseau"]),
    ("/api/web/superagent/earnings", ["Override commission"]),
]


@pytest.mark.parametrize("path,must_contain", SUPER_SECTIONS)
def test_superagent_sections(role_cookies, path, must_contain):
    if "superagent" not in role_cookies:
        pytest.skip("superagent login did not succeed")
    r = requests.get(
        f"{BASE_URL}{path}", cookies=role_cookies["superagent"], timeout=20, allow_redirects=False
    )
    assert r.status_code == 200, f"{path} -> {r.status_code}"
    missing = [t for t in must_contain if t not in r.text]
    assert not missing, f"{path} missing: {missing}"


# ============================================================
# TEST 6 — Logout
# ============================================================
@pytest.mark.parametrize("role", ["admin", "agent", "superagent"])
def test_panel_logout(role, role_cookies):
    if role not in role_cookies:
        pytest.skip(f"{role} login did not succeed")
    r = requests.post(
        f"{BASE_URL}/api/web/{role}/logout",
        cookies=role_cookies[role],
        allow_redirects=False,
        timeout=20,
    )
    assert r.status_code == 303, f"logout -> {r.status_code}"
    set_cookie = r.headers.get("set-cookie", "")
    cookie_name = f"sb_web_session_{role}"
    # Cookie should be cleared: empty value and/or expires in the past
    assert cookie_name in set_cookie, f"logout did not touch {cookie_name}: {set_cookie}"
    # FastAPI delete_cookie sends max-age=0 / expires past
    assert ('Max-Age=0' in set_cookie) or ('max-age=0' in set_cookie) or ('expires=' in set_cookie.lower())


# ============================================================
# TEST 7 — PUT /api/auth/me with theme field
# ============================================================
@pytest.fixture(scope="session")
def client_token():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"identifier": CLIENT_EMAIL, "password": CLIENT_PASSWORD},
        timeout=20,
    )
    assert r.status_code == 200, f"client login -> {r.status_code}: {r.text[:300]}"
    return r.json().get("access_token")


def test_put_auth_me_theme_dark(client_token):
    assert client_token, "no client token"
    r = requests.put(
        f"{BASE_URL}/api/auth/me",
        json={"theme": "dark"},
        headers={"Authorization": f"Bearer {client_token}"},
        timeout=20,
    )
    assert r.status_code == 200, f"PUT /auth/me -> {r.status_code}: {r.text[:300]}"
    data = r.json()
    # Returned user should be present
    assert isinstance(data, dict), "response not a dict"
    assert data.get("email") or data.get("id") or data.get("user"), \
        f"response missing user fields: {list(data.keys())}"


# ============================================================
# TEST 8 — Regression: core auth + corridors + wallet tx
# ============================================================
def test_regression_client_login(client_token):
    assert client_token and len(client_token) > 10


def test_regression_get_auth_me(client_token):
    r = requests.get(
        f"{BASE_URL}/api/auth/me",
        headers={"Authorization": f"Bearer {client_token}"},
        timeout=20,
    )
    assert r.status_code == 200
    data = r.json()
    # Response shape: {"user": {...}, "wallet": {...}}
    user = data.get("user", data)
    assert user.get("email") == CLIENT_EMAIL, f"unexpected: {list(data.keys())}"


def test_regression_corridors():
    r = requests.get(f"{BASE_URL}/api/corridors", timeout=20)
    assert r.status_code == 200
    data = r.json()
    corridors = data.get("corridors") if isinstance(data, dict) else data
    assert isinstance(corridors, list) and len(corridors) > 0, "no corridors returned"
    assert any("country_code" in c for c in corridors[:3]), "corridor entries malformed"


def test_regression_wallet_transactions(client_token):
    r = requests.get(
        f"{BASE_URL}/api/wallet/transactions",
        headers={"Authorization": f"Bearer {client_token}"},
        timeout=20,
    )
    assert r.status_code == 200, f"{r.status_code}: {r.text[:200]}"
