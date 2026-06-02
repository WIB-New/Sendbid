"""
Web Panels — Admin / Agent / Superagent
=======================================
Sert des panels web HTML (pas mobile) accessibles via :
  - GET /web/admin       → panel administrateur
  - GET /web/agent       → panel agent
  - GET /web/superagent  → panel super-agent

Authentification : email + password (réutilise les comptes seedés).
Vérification du rôle selon le chemin demandé.
"""
from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse
import os

router = APIRouter(tags=["web-panels"])

# ============================================================================
# Template HTML générique — login + dashboard
# ============================================================================
HTML_TEMPLATE = """
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>SendFloo — Panel {ROLE_DISPLAY}</title>
<style>
  * {{ margin: 0; padding: 0; box-sizing: border-box; }}
  body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: linear-gradient(135deg, #00147E 0%, #3D52D5 100%); min-height: 100vh; color: #1a1a1a; }}
  .container {{ max-width: 1200px; margin: 0 auto; padding: 24px; }}
  .header {{ display: flex; justify-content: space-between; align-items: center; padding: 20px 0; color: white; }}
  .logo {{ font-size: 22px; font-weight: 800; letter-spacing: -0.5px; }}
  .badge {{ background: {ROLE_COLOR}; color: white; padding: 6px 14px; border-radius: 999px; font-size: 12px; font-weight: 700; text-transform: uppercase; }}
  .card {{ background: white; border-radius: 16px; padding: 32px; box-shadow: 0 10px 40px rgba(0,0,0,0.15); margin-top: 16px; }}
  .login-card {{ max-width: 420px; margin: 80px auto; }}
  h1 {{ font-size: 24px; margin-bottom: 8px; color: #0F1F4E; }}
  h2 {{ font-size: 16px; color: #6E769A; font-weight: 500; margin-bottom: 24px; }}
  label {{ display: block; font-size: 13px; font-weight: 600; color: #4A5170; margin: 16px 0 6px; }}
  input {{ width: 100%; padding: 14px 16px; border: 1.5px solid #E5E9F2; border-radius: 10px; font-size: 15px; transition: border 0.2s; }}
  input:focus {{ outline: none; border-color: #3D52D5; }}
  button {{ width: 100%; background: {ROLE_COLOR}; color: white; padding: 14px; border: none; border-radius: 10px; font-size: 15px; font-weight: 700; cursor: pointer; margin-top: 24px; transition: opacity 0.2s; }}
  button:hover {{ opacity: 0.9; }}
  button:disabled {{ opacity: 0.5; cursor: not-allowed; }}
  .error {{ background: #FEE2E2; color: #B91C1C; padding: 12px; border-radius: 8px; margin-top: 12px; font-size: 14px; }}
  .grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; margin-top: 20px; }}
  .stat {{ background: #F8FAFF; border-radius: 12px; padding: 20px; border-left: 4px solid {ROLE_COLOR}; }}
  .stat-label {{ font-size: 12px; color: #6E769A; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; }}
  .stat-value {{ font-size: 28px; font-weight: 800; color: #0F1F4E; margin-top: 6px; }}
  .nav {{ display: flex; gap: 8px; margin-top: 20px; flex-wrap: wrap; }}
  .nav-item {{ padding: 10px 18px; background: #F0F4FF; border-radius: 999px; font-size: 13px; font-weight: 600; color: #3D52D5; cursor: pointer; transition: background 0.2s; }}
  .nav-item:hover, .nav-item.active {{ background: {ROLE_COLOR}; color: white; }}
  .footer {{ text-align: center; padding: 24px 0; color: rgba(255,255,255,0.7); font-size: 12px; }}
  table {{ width: 100%; border-collapse: collapse; margin-top: 16px; }}
  th, td {{ text-align: left; padding: 12px; border-bottom: 1px solid #E5E9F2; font-size: 14px; }}
  th {{ color: #6E769A; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }}
  .pill {{ display: inline-block; padding: 4px 10px; border-radius: 999px; font-size: 11px; font-weight: 700; }}
  .pill-ok {{ background: #D1FAE5; color: #047857; }}
  .pill-warn {{ background: #FEF3C7; color: #92400E; }}
  .logout {{ background: rgba(255,255,255,0.18); border: 1px solid rgba(255,255,255,0.3); color: white; padding: 8px 16px; border-radius: 8px; font-size: 13px; cursor: pointer; }}
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <div>
      <div class="logo">🚀 SendFloo</div>
    </div>
    <div class="badge">{ROLE_DISPLAY}</div>
  </div>

  <div id="app"></div>
</div>

<script>
const ROLE = '{ROLE}';
const API_BASE = '/api';
let token = localStorage.getItem('sb_web_token_' + ROLE);
let user = null;

function render() {{
  const app = document.getElementById('app');
  if (!token) {{ renderLogin(app); }} else {{ renderDashboard(app); }}
}}

function renderLogin(app) {{
  app.innerHTML = `
    <div class="card login-card">
      <h1>Connexion {ROLE_DISPLAY}</h1>
      <h2>Accédez à votre espace de gestion SendFloo</h2>
      <form id="loginForm">
        <label>Email</label>
        <input type="email" id="email" required autocomplete="email" />
        <label>Mot de passe</label>
        <input type="password" id="password" required autocomplete="current-password" />
        <button type="submit" id="loginBtn">Se connecter</button>
        <div id="errMsg" style="display:none" class="error"></div>
      </form>
    </div>
  `;
  document.getElementById('loginForm').addEventListener('submit', async (e) => {{
    e.preventDefault();
    const btn = document.getElementById('loginBtn');
    const errBox = document.getElementById('errMsg');
    btn.disabled = true; btn.textContent = 'Connexion…'; errBox.style.display = 'none';
    try {{
      const res = await fetch(API_BASE + '/auth/login', {{
        method: 'POST', headers: {{ 'Content-Type': 'application/json' }},
        body: JSON.stringify({{ identifier: document.getElementById('email').value, password: document.getElementById('password').value }}),
      }});
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Identifiants invalides');
      // Vérification du rôle attendu
      const userRole = (data.user || {{}}).role || 'user';
      const allowed = {{ admin: ['super_admin', 'admin'], agent: ['agent', 'super_agent'], superagent: ['super_agent'] }}[ROLE];
      if (!allowed.includes(userRole)) throw new Error('Accès refusé : votre compte n\\'est pas autorisé pour ce panel.');
      token = data.access_token; user = data.user;
      localStorage.setItem('sb_web_token_' + ROLE, token);
      localStorage.setItem('sb_web_user_' + ROLE, JSON.stringify(user));
      render();
    }} catch (e) {{
      errBox.textContent = e.message || 'Erreur de connexion';
      errBox.style.display = 'block';
      btn.disabled = false; btn.textContent = 'Se connecter';
    }}
  }});
}}

async function renderDashboard(app) {{
  user = user || JSON.parse(localStorage.getItem('sb_web_user_' + ROLE) || '{{}}');
  app.innerHTML = `
    <div class="card">
      <div style="display:flex; justify-content:space-between; align-items:start; flex-wrap:wrap; gap:12px;">
        <div>
          <h1>Bienvenue, ${{user.full_name || user.email || 'Utilisateur'}}</h1>
          <h2>Rôle : ${{user.role || 'N/A'}} · Profile ID : ${{user.profile_id || 'N/A'}}</h2>
        </div>
        <button class="logout" onclick="logout()">Se déconnecter</button>
      </div>
      <div class="nav">
        <div class="nav-item active">Tableau de bord</div>
        <div class="nav-item">Utilisateurs</div>
        <div class="nav-item">Transferts</div>
        <div class="nav-item">Wallets</div>
        <div class="nav-item">Audit logs</div>
        <div class="nav-item">Paramètres</div>
      </div>
      <div class="grid" id="stats"></div>
      <div id="data" style="margin-top: 24px;"></div>
    </div>
  `;
  loadStats();
}}

async function loadStats() {{
  const headers = {{ 'Authorization': 'Bearer ' + token }};
  const stats = document.getElementById('stats');
  stats.innerHTML = '<div class="stat"><div class="stat-label">Chargement…</div></div>';
  try {{
    const endpoint = {{ admin: '/admin/kpis', agent: '/agent/dashboard', superagent: '/agent/dashboard' }}[ROLE];
    const res = await fetch(API_BASE + endpoint, {{ headers }});
    const d = await res.json();
    if (!res.ok) throw new Error(d.detail || 'Erreur');
    const items = [];
    if (ROLE === 'admin') {{
      items.push({{ label: 'Utilisateurs', value: (d.users || {{}}).total || '—' }});
      items.push({{ label: 'Transferts totaux', value: (d.transfers || {{}}).total || '—' }});
      items.push({{ label: 'Complétés', value: (d.transfers || {{}}).completed || '—' }});
      items.push({{ label: 'En cours', value: (d.transfers || {{}}).in_progress || '—' }});
      items.push({{ label: 'Volume EUR', value: ((d.transfers || {{}}).volume_eur || 0).toLocaleString('fr-FR') + ' €' }});
      items.push({{ label: 'Agents actifs', value: (d.agents || {{}}).active || '—' }});
      items.push({{ label: 'Agents en attente', value: (d.agents || {{}}).pending || '—' }});
      items.push({{ label: 'Float déclaré', value: ((d.float || {{}}).total_declared || 0).toLocaleString('fr-FR') + ' EUR' }});
    }} else {{
      const agent = d.agent || {{}};
      const stats = d.stats || {{}};
      items.push({{ label: 'Statut', value: agent.status || 'N/A' }});
      items.push({{ label: 'Transferts complétés', value: stats.completed || '—' }});
      items.push({{ label: 'Gains cumulés EUR', value: ((stats.earnings_eur || 0)).toFixed(2) + ' €' }});
      items.push({{ label: 'Note moyenne', value: (agent.rating || 0).toFixed(1) + ' ★' }});
      items.push({{ label: 'Disponibilité', value: agent.available ? '🟢 En ligne' : '🔴 Hors ligne' }});
      items.push({{ label: 'KYC tier', value: agent.kyc_tier || '—' }});
    }}
    stats.innerHTML = items.map(it => `<div class="stat"><div class="stat-label">${{it.label}}</div><div class="stat-value">${{it.value}}</div></div>`).join('');
  }} catch (e) {{
    stats.innerHTML = '<div class="stat"><div class="stat-label">Données non disponibles</div><div class="stat-value">—</div></div>';
  }}
}}

function logout() {{
  localStorage.removeItem('sb_web_token_' + ROLE);
  localStorage.removeItem('sb_web_user_' + ROLE);
  token = null; user = null;
  render();
}}

render();
</script>
</body>
</html>
"""

ROLE_COLORS = {
    "admin": "#DC2626",       # Rouge admin
    "agent": "#FFA500",       # Orange PayBID
    "superagent": "#7C3AED",  # Violet super-agent
}
ROLE_DISPLAY = {
    "admin": "Administrateur",
    "agent": "Agent",
    "superagent": "Super-Agent",
}


def _render_panel(role: str) -> str:
    return HTML_TEMPLATE.format(
        ROLE=role,
        ROLE_DISPLAY=ROLE_DISPLAY[role],
        ROLE_COLOR=ROLE_COLORS[role],
    )


@router.get("/web/admin", response_class=HTMLResponse)
async def web_admin():
    return HTMLResponse(_render_panel("admin"))


@router.get("/web/agent", response_class=HTMLResponse)
async def web_agent():
    return HTMLResponse(_render_panel("agent"))


@router.get("/web/superagent", response_class=HTMLResponse)
async def web_superagent():
    return HTMLResponse(_render_panel("superagent"))


@router.get("/web/", response_class=HTMLResponse)
@router.get("/web", response_class=HTMLResponse)
async def web_landing():
    return HTMLResponse("""<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>SendFloo — Le transfert d'argent réinventé</title>
<style>* { margin:0; padding:0; box-sizing:border-box; } body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; background:#0A0E2E; color:white; line-height:1.6; }
.hero { background:linear-gradient(135deg,#00147E 0%,#3D52D5 100%); padding:80px 24px; text-align:center; }
h1 { font-size:48px; font-weight:800; margin-bottom:16px; letter-spacing:-1px; }
.tagline { font-size:20px; opacity:0.85; max-width:680px; margin:0 auto 32px; }
.cta-row { display:flex; gap:12px; justify-content:center; flex-wrap:wrap; }
.cta { padding:14px 28px; border-radius:999px; font-weight:700; font-size:15px; text-decoration:none; transition:transform 0.2s; display:inline-block; }
.cta:hover { transform:translateY(-2px); }
.cta-sendbid { background:white; color:#00147E; }
.cta-paybid { background:#FFA500; color:white; }
.section { max-width:1100px; margin:80px auto; padding:0 24px; }
h2 { font-size:32px; margin-bottom:16px; }
.lead { font-size:18px; opacity:0.75; margin-bottom:32px; }
.cards { display:grid; grid-template-columns:repeat(auto-fit,minmax(280px,1fr)); gap:24px; }
.card { background:#141938; padding:32px; border-radius:16px; border:1px solid #272D54; }
.card-icon { font-size:36px; margin-bottom:12px; }
.card h3 { font-size:20px; margin-bottom:8px; }
.card p { opacity:0.75; font-size:15px; }
.dual { display:grid; grid-template-columns:1fr 1fr; gap:24px; }
@media (max-width:768px) { .dual { grid-template-columns:1fr; } h1 { font-size:32px; } }
.role-card { padding:40px; border-radius:20px; }
.role-sendbid { background:linear-gradient(135deg,#00147E,#3D52D5); }
.role-paybid { background:linear-gradient(135deg,#CC7A00,#FFA500); }
.role-card h2 { font-size:36px; margin-bottom:8px; }
.role-card .role-tag { font-size:13px; text-transform:uppercase; letter-spacing:2px; opacity:0.7; margin-bottom:24px; }
ul { list-style:none; padding:0; margin-top:16px; } li { padding:8px 0; opacity:0.85; }
li::before { content:"✓ "; color:#10B981; font-weight:700; }
footer { background:#070A22; padding:40px 24px; text-align:center; opacity:0.6; font-size:13px; }
.panel-link { display:inline-block; margin:6px; padding:8px 16px; background:rgba(255,255,255,0.1); color:white; border-radius:8px; text-decoration:none; font-size:13px; }
</style></head><body>
<div class="hero">
<h1>SendFloo</h1>
<p class="tagline">Transferts d'argent internationaux en temps réel, sécurisés, avec enchère inversée — le meilleur taux est à vous.</p>
<div class="cta-row"><a href="#" class="cta cta-sendbid">📱 J'envoie de l'argent (SendBID)</a><a href="#" class="cta cta-paybid">💼 Je suis agent (PayBID)</a></div>
</div>
<div class="section">
<h2>Pourquoi SendFloo</h2><p class="lead">Une plateforme, deux apps, des milliers d'agents dans le monde.</p>
<div class="cards">
<div class="card"><div class="card-icon">⚡</div><h3>Temps réel</h3><p>Enchère inversée 30s : les agents se battent pour vos frais. Vous payez toujours le moins cher.</p></div>
<div class="card"><div class="card-icon">🔒</div><h3>Sécurisé</h3><p>KYC à 3 niveaux, biométrie, OTP. Paiements PCI-DSS via Stripe/PayPal et MoMo opérateurs.</p></div>
<div class="card"><div class="card-icon">🌍</div><h3>250+ pays</h3><p>Tous les corridors couverts, multi-devises, conversion automatique. Cash, banque, Mobile Money.</p></div>
<div class="card"><div class="card-icon">💰</div><h3>Taux justes</h3><p>Pas de frais cachés. Le taux interbancaire + une marge claire. Frais agent visibles avant de payer.</p></div>
</div>
</div>
<div class="section dual">
<div class="role-card role-sendbid">
<div class="role-tag">Client</div><h2>SendBID</h2><p>L'app pour envoyer de l'argent à vos proches partout dans le monde.</p>
<ul><li>Choix du pays bénéficiaire en 1 clic</li><li>Enchère temps réel des agents</li><li>Sélection du meilleur frais</li><li>Suivi temps réel jusqu'à la remise</li><li>QR code de retrait sécurisé</li></ul>
</div>
<div class="role-card role-paybid">
<div class="role-tag">Agent</div><h2>PayBID</h2><p>L'app pour les agents de transfert : gagnez en visibilité, optimisez vos commissions.</p>
<ul><li>Offres entrantes en temps réel</li><li>Bid en 1 clic, win en 1 sec</li><li>Float multi-devises XAF/XOF/EUR/USD</li><li>Comptabilité automatique</li><li>Programme fidélité Silver/Gold/Platinum</li></ul>
</div>
</div>
<div class="section">
<h2>Espaces de gestion</h2><p class="lead">Panels web dédiés aux opérations.</p>
<a href="/web/admin" class="panel-link">🛡️ Admin Panel</a>
<a href="/web/agent" class="panel-link">👤 Agent Panel</a>
<a href="/web/superagent" class="panel-link">⭐ Super-Agent Panel</a>
</div>
<footer>© 2026 SendFloo · sendfloo.sendbid.app · Tous droits réservés.</footer>
</body></html>""")
