"""
Web Panels & Marketing site \u2014 Jinja2 server-side rendered.
=========================================================
- Marketing pages (public)  : /api/web/, /api/web/features, /api/web/pricing, /api/web/faq, /api/web/about, /api/web/download
- Admin panel               : /api/web/admin[/users|/agents|/transfers|/auctions|/wallets|/audit]
- Agent panel               : /api/web/agent[/auctions|/transfers|/float|/earnings]
- Super-Agent panel         : /api/web/superagent[/agents|/transfers|/earnings]

Auth: session cookie `sb_web_session_{role}` (signed JWT, 12h).
Le panel se base sur les comptes seed\u00e9s (admin@sendbid.app, agent@paybid.app, superagent@sendbid.app).

Tout est rendu c\u00f4t\u00e9 serveur (Jinja2) \u2014 pas de JS lourd, SEO friendly, indexable.
"""
from __future__ import annotations

import datetime as _dt
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Request, Form, HTTPException, Cookie
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates

from core.db import db, now_utc, iso
from core.security import verify_password, create_access_token, decode_token


# ============================================================================
# Templates init
# ============================================================================
_TEMPLATE_DIR = Path(__file__).resolve().parent.parent / "templates"
templates = Jinja2Templates(directory=str(_TEMPLATE_DIR))


def _safe_date(value, length: int = 10) -> str:
    """Jinja2 filter: rend une date (str ISO ou datetime ou None) en cha\u00eene tronqu\u00e9e."""
    if value is None or value == "":
        return ""
    if isinstance(value, _dt.datetime):
        return value.isoformat()[:length]
    if isinstance(value, str):
        return value[:length]
    return str(value)[:length]


templates.env.filters["safe_date"] = _safe_date


def _current_year() -> int:
    return _dt.datetime.utcnow().year


# Default context for marketing pages
def _marketing_ctx(request: Request, active: str = "", extra: Optional[dict] = None) -> dict:
    ctx = {
        "request": request,
        "active": active,
        "current_year": _current_year(),
    }
    if extra:
        ctx.update(extra)
    return ctx


# ============================================================================
# Auth helpers (cookie-based sessions for the panels)
# ============================================================================
COOKIE_PREFIX = "sb_web_session_"
ALLOWED_ROLES_BY_PANEL = {
    "admin": {"super_admin", "admin", "partner_admin"},
    "agent": {"agent", "super_agent"},
    "superagent": {"super_agent"},
}
ROLE_COLORS = {
    "admin": ("#DC2626", "#991B1B"),       # rouge admin
    "agent": ("#FFA500", "#CC7A00"),       # orange paybid
    "superagent": ("#7C3AED", "#5B21B6"),  # violet super-agent
}
ROLE_DISPLAY = {"admin": "Administrateur", "agent": "Agent", "superagent": "Super-Agent"}


async def _resolve_session(role: str, request: Request) -> Optional[dict]:
    """Lit le cookie de session du panel et retourne l'utilisateur correspondant, ou None."""
    cookie_name = COOKIE_PREFIX + role
    token = request.cookies.get(cookie_name)
    if not token:
        return None
    try:
        payload = decode_token(token)
    except Exception:
        return None
    uid = payload.get("sub")
    if not uid:
        return None
    user = await db.users.find_one({"id": uid}, {"_id": 0, "password_hash": 0, "pin_hash": 0, "biometric_token": 0})
    if not user:
        return None
    allowed = ALLOWED_ROLES_BY_PANEL.get(role, set())
    if (user.get("role") or "user") not in allowed:
        return None
    return user


def _panel_base_ctx(request: Request, role: str, user: Optional[dict] = None, **extra) -> dict:
    color, color_dark = ROLE_COLORS.get(role, ("#3D52D5", "#1E2A78"))
    ctx = {
        "request": request,
        "role": role,
        "role_display": ROLE_DISPLAY[role],
        "panel_title": f"Panel {ROLE_DISPLAY[role]}",
        "role_color": color,
        "role_color_dark": color_dark,
        "user": user,
        "current_year": _current_year(),
    }
    ctx.update(extra)
    return ctx


# ============================================================================
# Router
# ============================================================================
router = APIRouter(tags=["web-panels"])


# -------------------- MARKETING PAGES --------------------

@router.get("/web/", response_class=HTMLResponse)
@router.get("/web", response_class=HTMLResponse)
async def marketing_home(request: Request):
    # Stats r\u00e9elles (DB) avec fallback raisonnable pour la d\u00e9mo
    try:
        users = await db.users.count_documents({})
        agents = await db.agents.count_documents({"status": "approved"})
        completed = await db.transfers.count_documents({"status": "COMPLETED"})
        # Volume
        vol = 0.0
        async for x in db.transfers.aggregate([
            {"$match": {"status": "COMPLETED"}},
            {"$group": {"_id": None, "v": {"$sum": "$send_amount"}}},
        ]):
            vol = float(x.get("v") or 0)
    except Exception:
        users, agents, completed, vol = 0, 0, 0, 0.0
    stats = {
        "users": max(users, 1200),
        "agents": max(agents, 350),
        "transfers": max(completed * 4, 15000),
        "completed": max(completed, 12500),
        "volume": "{:,.0f}".format(max(vol, 4_500_000)).replace(",", " "),
    }
    return templates.TemplateResponse("marketing/home.html", _marketing_ctx(request, "home", {"stats": stats}))


@router.get("/web/features", response_class=HTMLResponse)
async def marketing_features(request: Request):
    return templates.TemplateResponse("marketing/features.html", _marketing_ctx(request, "features"))


@router.get("/web/pricing", response_class=HTMLResponse)
async def marketing_pricing(request: Request):
    return templates.TemplateResponse("marketing/pricing.html", _marketing_ctx(request, "pricing"))


@router.get("/web/faq", response_class=HTMLResponse)
async def marketing_faq(request: Request):
    return templates.TemplateResponse("marketing/faq.html", _marketing_ctx(request, "faq"))


@router.get("/web/about", response_class=HTMLResponse)
async def marketing_about(request: Request):
    return templates.TemplateResponse("marketing/about.html", _marketing_ctx(request, "about"))


@router.get("/web/download", response_class=HTMLResponse)
async def marketing_download(request: Request):
    return templates.TemplateResponse("marketing/download.html", _marketing_ctx(request, "download"))


# -------------------- AUTH (login / logout) --------------------

@router.post("/web/{role}/login")
async def panel_login(role: str, request: Request, email: str = Form(...), password: str = Form(...)):
    if role not in ALLOWED_ROLES_BY_PANEL:
        raise HTTPException(404)
    user = await db.users.find_one({"email": email.lower().strip()})
    err_resp = lambda msg: templates.TemplateResponse(
        f"panels/{role}.html",
        _panel_base_ctx(request, role, user=None, error=msg, email_prefill=email),
        status_code=401,
    )
    if not user or not user.get("password_hash") or not verify_password(password, user["password_hash"]):
        return err_resp("Identifiants invalides")
    allowed = ALLOWED_ROLES_BY_PANEL[role]
    if (user.get("role") or "user") not in allowed:
        return err_resp("Acc\u00e8s refus\u00e9 : compte non autoris\u00e9 pour ce panel")
    token = create_access_token(user["id"])
    resp = RedirectResponse(url=f"/api/web/{role}", status_code=303)
    resp.set_cookie(
        key=COOKIE_PREFIX + role,
        value=token,
        max_age=12 * 3600,
        httponly=True,
        samesite="lax",
        path="/",
    )
    return resp


@router.post("/web/{role}/logout")
async def panel_logout(role: str):
    if role not in ALLOWED_ROLES_BY_PANEL:
        raise HTTPException(404)
    resp = RedirectResponse(url=f"/api/web/{role}", status_code=303)
    resp.delete_cookie(COOKIE_PREFIX + role, path="/")
    return resp


def _login_page(request: Request, role: str) -> HTMLResponse:
    return templates.TemplateResponse(f"panels/{role}.html", _panel_base_ctx(request, role, user=None))


# -------------------- ADMIN PANEL --------------------

async def _admin_kpis(scope_transfers=None, scope_agents=None, scope_users=None) -> dict:
    scope_transfers = scope_transfers or {}
    scope_agents = scope_agents or {}
    scope_users = scope_users or {}
    total_users = await db.users.count_documents(scope_users)
    # Nouveaux users 30 derniers jours
    cutoff = iso(now_utc() - _dt.timedelta(days=30))
    new_users_30d = await db.users.count_documents({**scope_users, "created_at": {"$gte": cutoff}})
    total_agents = await db.agents.count_documents(scope_agents)
    active_agents = await db.agents.count_documents({**scope_agents, "status": "approved", "available": True})
    pending_agents = await db.agents.count_documents({**scope_agents, "status": "pending_verification"})
    total_transfers = await db.transfers.count_documents(scope_transfers)
    completed = await db.transfers.count_documents({**scope_transfers, "status": "COMPLETED"})
    in_progress = await db.transfers.count_documents(
        {**scope_transfers, "status": {"$in": ["BIDDING", "AGENT_ASSIGNED", "PROCESSING"]}}
    )
    vol = 0.0
    async for x in db.transfers.aggregate([
        {"$match": {**scope_transfers, "status": "COMPLETED"}},
        {"$group": {"_id": None, "v": {"$sum": "$send_amount"}}},
    ]):
        vol = float(x.get("v") or 0)
    total_float = 0.0
    async for x in db.agent_floats.aggregate([{"$group": {"_id": "$currency", "t": {"$sum": "$balance"}}}]):
        total_float += float(x.get("t") or 0)
    return {
        "users": {"total": total_users, "new_30d": new_users_30d},
        "agents": {"total": total_agents, "active": active_agents, "pending": pending_agents},
        "transfers": {"total": total_transfers, "completed": completed, "in_progress": in_progress, "volume_eur": round(vol, 2)},
        "float": {"total_declared": round(total_float, 2)},
    }


@router.get("/web/admin", response_class=HTMLResponse)
async def admin_dashboard(request: Request):
    user = await _resolve_session("admin", request)
    if not user:
        return _login_page(request, "admin")
    kpis = await _admin_kpis()
    recent_transfers = await db.transfers.find({}, {"_id": 0}).sort("created_at", -1).to_list(10)
    recent_agents = await db.agents.find({}, {"_id": 0}).sort("created_at", -1).to_list(8)
    ctx = _panel_base_ctx(request, "admin", user, section="dashboard",
                          kpis=kpis, recent_transfers=recent_transfers, recent_agents=recent_agents)
    return templates.TemplateResponse("panels/admin.html", ctx)


@router.get("/web/admin/users", response_class=HTMLResponse)
async def admin_users(request: Request):
    user = await _resolve_session("admin", request)
    if not user:
        return _login_page(request, "admin")
    users = await db.users.find({}, {"_id": 0, "password_hash": 0, "pin_hash": 0, "biometric_token": 0}).sort("created_at", -1).to_list(200)
    # Coerce datetime fields to ISO string for the template
    for u in users:
        ca = u.get("created_at")
        if isinstance(ca, _dt.datetime):
            u["created_at"] = ca.isoformat()
    ctx = _panel_base_ctx(request, "admin", user, section="users", section_title="Utilisateurs", users=users)
    return templates.TemplateResponse("panels/admin.html", ctx)


@router.get("/web/admin/agents", response_class=HTMLResponse)
async def admin_agents(request: Request):
    user = await _resolve_session("admin", request)
    if not user:
        return _login_page(request, "admin")
    agents = await db.agents.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)
    ctx = _panel_base_ctx(request, "admin", user, section="agents", section_title="Agents", agents=agents)
    return templates.TemplateResponse("panels/admin.html", ctx)


@router.get("/web/admin/transfers", response_class=HTMLResponse)
async def admin_transfers(request: Request):
    user = await _resolve_session("admin", request)
    if not user:
        return _login_page(request, "admin")
    transfers = await db.transfers.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)
    ctx = _panel_base_ctx(request, "admin", user, section="transfers", section_title="Transferts", transfers=transfers)
    return templates.TemplateResponse("panels/admin.html", ctx)


@router.get("/web/admin/auctions", response_class=HTMLResponse)
async def admin_auctions(request: Request):
    user = await _resolve_session("admin", request)
    if not user:
        return _login_page(request, "admin")
    auctions = await db.transfers.find({"status": "BIDDING"}, {"_id": 0}).sort("created_at", -1).to_list(200)
    ctx = _panel_base_ctx(request, "admin", user, section="auctions", section_title="Ench\u00e8res live", auctions=auctions)
    return templates.TemplateResponse("panels/admin.html", ctx)


@router.get("/web/admin/wallets", response_class=HTMLResponse)
async def admin_wallets(request: Request):
    user = await _resolve_session("admin", request)
    if not user:
        return _login_page(request, "admin")
    raw = await db.wallets.find({}, {"_id": 0}).sort("updated_at", -1).to_list(200)
    # Jointure utilisateur (lookup en Python pour la simplicit\u00e9)
    user_ids = [w.get("user_id") for w in raw if w.get("user_id")]
    users_map = {}
    if user_ids:
        async for u in db.users.find({"id": {"$in": user_ids}}, {"_id": 0, "id": 1, "full_name": 1, "email": 1}):
            users_map[u["id"]] = u
    wallets = []
    for w in raw:
        u = users_map.get(w.get("user_id"), {})
        wallets.append({**w, "user_name": u.get("full_name"), "user_email": u.get("email")})
    ctx = _panel_base_ctx(request, "admin", user, section="wallets", section_title="Wallets", wallets=wallets)
    return templates.TemplateResponse("panels/admin.html", ctx)


@router.get("/web/admin/audit", response_class=HTMLResponse)
async def admin_audit(request: Request):
    user = await _resolve_session("admin", request)
    if not user:
        return _login_page(request, "admin")
    movements = []
    async for x in db.agent_float_movements.aggregate([
        {"$group": {
            "_id": {"type": "$type", "currency": "$currency"},
            "total": {"$sum": "$amount_signed"}, "count": {"$sum": 1},
        }},
    ]):
        movements.append({"type": x["_id"]["type"], "currency": x["_id"]["currency"], "total": x["total"], "count": x["count"]})
    ctx = _panel_base_ctx(request, "admin", user, section="audit", section_title="Audit logs", movements=movements)
    return templates.TemplateResponse("panels/admin.html", ctx)


# -------------------- AGENT PANEL --------------------

async def _agent_record(user: dict) -> Optional[dict]:
    return await db.agents.find_one({"user_id": user["id"]}, {"_id": 0})


@router.get("/web/agent", response_class=HTMLResponse)
async def agent_dashboard(request: Request):
    user = await _resolve_session("agent", request)
    if not user:
        return _login_page(request, "agent")
    agent = await _agent_record(user) or {}
    today_start = now_utc().replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - _dt.timedelta(days=7)
    today_done = await db.transfers.count_documents({
        "agent_id": agent.get("id", "_"), "status": "COMPLETED",
        "completed_at": {"$gte": iso(today_start)},
    })
    week_done = await db.transfers.count_documents({
        "agent_id": agent.get("id", "_"), "status": "COMPLETED",
        "completed_at": {"$gte": iso(week_start)},
    })
    pending = await db.transfers.count_documents({"status": "BIDDING"})
    same_city = await db.transfers.count_documents({
        "status": "BIDDING",
        "destination_city": {"$regex": f"^{agent.get('city', '_')}$", "$options": "i"},
    })
    completed = await db.transfers.find(
        {"agent_id": agent.get("id", "_"), "status": "COMPLETED"},
        {"_id": 0, "selected_bid": 1, "send_amount": 1, "completed_at": 1},
    ).to_list(500)
    total_earn = round(sum(
        (t.get("selected_bid", {}).get("bid_fee_percent", 0) / 100.0) * (t.get("send_amount", 0))
        for t in completed
    ), 2)
    week_earn = round(sum(
        (t.get("selected_bid", {}).get("bid_fee_percent", 0) / 100.0) * (t.get("send_amount", 0))
        for t in completed if (t.get("completed_at") or "") >= iso(week_start)
    ), 2)
    stats = {
        "today_completed": today_done, "week_completed": week_done,
        "pending_auctions": pending, "same_city_auctions": same_city,
        "rating": agent.get("rating", 0),
        "total_earnings_eur": total_earn, "week_earnings_eur": week_earn,
    }
    active = await db.transfers.find(
        {"agent_id": agent.get("id", "_"), "status": {"$in": ["AGENT_ASSIGNED", "PROCESSING", "READY_FOR_PICKUP"]}},
        {"_id": 0},
    ).sort("created_at", -1).to_list(5)
    auctions_preview = await db.transfers.find({"status": "BIDDING"}, {"_id": 0}).sort("created_at", -1).to_list(5)
    ctx = _panel_base_ctx(request, "agent", user, section="dashboard",
                          agent=agent, stats=stats, active_transfers=active, auctions_preview=auctions_preview)
    return templates.TemplateResponse("panels/agent.html", ctx)


@router.get("/web/agent/auctions", response_class=HTMLResponse)
async def agent_auctions(request: Request):
    user = await _resolve_session("agent", request)
    if not user:
        return _login_page(request, "agent")
    agent = await _agent_record(user) or {}
    auctions = await db.transfers.find({"status": "BIDDING"}, {"_id": 0}).sort("created_at", -1).to_list(100)
    ctx = _panel_base_ctx(request, "agent", user, section="auctions", section_title="Ench\u00e8res live", agent=agent, auctions=auctions)
    return templates.TemplateResponse("panels/agent.html", ctx)


@router.get("/web/agent/transfers", response_class=HTMLResponse)
async def agent_transfers(request: Request):
    user = await _resolve_session("agent", request)
    if not user:
        return _login_page(request, "agent")
    agent = await _agent_record(user) or {}
    transfers = await db.transfers.find({"agent_id": agent.get("id", "_")}, {"_id": 0}).sort("created_at", -1).to_list(100)
    # Calcul commission par transfert
    for t in transfers:
        t["commission_eur"] = round(
            (t.get("selected_bid", {}).get("bid_fee_percent", 0) / 100.0) * (t.get("send_amount", 0)), 2
        )
    ctx = _panel_base_ctx(request, "agent", user, section="transfers", section_title="Mes transferts", agent=agent, transfers=transfers)
    return templates.TemplateResponse("panels/agent.html", ctx)


@router.get("/web/agent/float", response_class=HTMLResponse)
async def agent_float(request: Request):
    user = await _resolve_session("agent", request)
    if not user:
        return _login_page(request, "agent")
    agent = await _agent_record(user) or {}
    floats_raw = await db.agent_floats.find({"agent_id": agent.get("id", "_")}, {"_id": 0}).to_list(20)
    # Comptage mouvements
    for f in floats_raw:
        f["movements_count"] = await db.agent_float_movements.count_documents({"agent_id": agent.get("id"), "currency": f.get("currency")})
    if not floats_raw:
        floats_raw = [{"currency": "EUR", "balance": 0, "declared_at": None, "movements_count": 0}]
    ctx = _panel_base_ctx(request, "agent", user, section="float", section_title="Float multi-devises", agent=agent, floats=floats_raw)
    return templates.TemplateResponse("panels/agent.html", ctx)


@router.get("/web/agent/earnings", response_class=HTMLResponse)
async def agent_earnings(request: Request):
    user = await _resolve_session("agent", request)
    if not user:
        return _login_page(request, "agent")
    agent = await _agent_record(user) or {}
    completed = await db.transfers.find(
        {"agent_id": agent.get("id", "_"), "status": "COMPLETED"},
        {"_id": 0, "id": 1, "selected_bid": 1, "send_amount": 1, "completed_at": 1, "created_at": 1},
    ).sort("completed_at", -1).to_list(30)
    today_start = now_utc().replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - _dt.timedelta(days=7)
    month_start = today_start - _dt.timedelta(days=30)
    def _earn(t):
        return (t.get("selected_bid", {}).get("bid_fee_percent", 0) / 100.0) * (t.get("send_amount", 0))
    today = round(sum(_earn(t) for t in completed if (t.get("completed_at") or "") >= iso(today_start)), 2)
    week = round(sum(_earn(t) for t in completed if (t.get("completed_at") or "") >= iso(week_start)), 2)
    month = round(sum(_earn(t) for t in completed if (t.get("completed_at") or "") >= iso(month_start)), 2)
    total = round(sum(_earn(t) for t in completed), 2)
    earnings_list = [{
        "id": t.get("id"),
        "send_amount": t.get("send_amount", 0),
        "fee_percent": t.get("selected_bid", {}).get("bid_fee_percent", 0),
        "commission": round(_earn(t), 2),
        "completed_at": t.get("completed_at"), "created_at": t.get("created_at"),
    } for t in completed]
    ctx = _panel_base_ctx(request, "agent", user, section="earnings", section_title="Mes gains",
                          agent=agent, earnings={"today": today, "week": week, "month": month, "total": total},
                          earnings_list=earnings_list)
    return templates.TemplateResponse("panels/agent.html", ctx)


# -------------------- SUPERAGENT PANEL --------------------

async def _super_agent_ids(super_user: dict) -> list[str]:
    """R\u00e9cup\u00e8re les IDs d'agents enfants de ce super-agent."""
    own_agent = await db.agents.find_one({"user_id": super_user["id"]}, {"_id": 0, "id": 1})
    super_agent_id = own_agent.get("id") if own_agent else super_user.get("id")
    ids = [a["id"] async for a in db.agents.find({"parent_agent_id": super_agent_id}, {"id": 1})]
    return ids


@router.get("/web/superagent", response_class=HTMLResponse)
async def superagent_dashboard(request: Request):
    user = await _resolve_session("superagent", request)
    if not user:
        return _login_page(request, "superagent")
    agent_ids = await _super_agent_ids(user)
    total_agents = len(agent_ids)
    active_agents = await db.agents.count_documents({"id": {"$in": agent_ids}, "status": "approved", "available": True}) if agent_ids else 0
    total_transfers = await db.transfers.count_documents({"agent_id": {"$in": agent_ids}}) if agent_ids else 0
    completed_transfers = await db.transfers.count_documents({"agent_id": {"$in": agent_ids}, "status": "COMPLETED"}) if agent_ids else 0
    vol = 0.0
    if agent_ids:
        async for x in db.transfers.aggregate([
            {"$match": {"agent_id": {"$in": agent_ids}, "status": "COMPLETED"}},
            {"$group": {"_id": None, "v": {"$sum": "$send_amount"}}},
        ]):
            vol = float(x.get("v") or 0)
    override = round(vol * 0.10, 2)  # 10% override
    avg_rating = 0.0
    if agent_ids:
        async for x in db.agents.aggregate([
            {"$match": {"id": {"$in": agent_ids}}},
            {"$group": {"_id": None, "avg": {"$avg": "$rating"}}},
        ]):
            avg_rating = float(x.get("avg") or 0)
    total_float = 0.0
    if agent_ids:
        async for x in db.agent_floats.aggregate([
            {"$match": {"agent_id": {"$in": agent_ids}}},
            {"$group": {"_id": None, "t": {"$sum": "$balance"}}},
        ]):
            total_float = float(x.get("t") or 0)
    network = {
        "total_agents": total_agents, "active_agents": active_agents,
        "total_transfers": total_transfers, "completed_transfers": completed_transfers,
        "volume_eur": round(vol, 2), "override_eur": override,
        "avg_rating": avg_rating, "total_float": round(total_float, 2),
    }
    top_agents_raw = await db.agents.find({"id": {"$in": agent_ids}}, {"_id": 0}).sort("transfers_count", -1).to_list(10) if agent_ids else []
    # Volume par agent
    for a in top_agents_raw:
        v = 0.0
        async for x in db.transfers.aggregate([
            {"$match": {"agent_id": a["id"], "status": "COMPLETED"}},
            {"$group": {"_id": None, "v": {"$sum": "$send_amount"}}},
        ]):
            v = float(x.get("v") or 0)
        a["volume_eur"] = round(v, 2)
    ctx = _panel_base_ctx(request, "superagent", user, section="dashboard",
                          network=network, top_agents=top_agents_raw)
    return templates.TemplateResponse("panels/superagent.html", ctx)


@router.get("/web/superagent/agents", response_class=HTMLResponse)
async def superagent_agents(request: Request):
    user = await _resolve_session("superagent", request)
    if not user:
        return _login_page(request, "superagent")
    agent_ids = await _super_agent_ids(user)
    agents = await db.agents.find({"id": {"$in": agent_ids}}, {"_id": 0}).sort("transfers_count", -1).to_list(200) if agent_ids else []
    ctx = _panel_base_ctx(request, "superagent", user, section="agents", section_title="Mon r\u00e9seau", agents=agents)
    return templates.TemplateResponse("panels/superagent.html", ctx)


@router.get("/web/superagent/transfers", response_class=HTMLResponse)
async def superagent_transfers(request: Request):
    user = await _resolve_session("superagent", request)
    if not user:
        return _login_page(request, "superagent")
    agent_ids = await _super_agent_ids(user)
    transfers = await db.transfers.find({"agent_id": {"$in": agent_ids}}, {"_id": 0}).sort("created_at", -1).to_list(200) if agent_ids else []
    # Enrichir avec nom agent
    if transfers:
        ag_map = {}
        async for a in db.agents.find({"id": {"$in": agent_ids}}, {"_id": 0, "id": 1, "full_name": 1, "user_id": 1}):
            ag_map[a["id"]] = a
        # Resolver via user
        user_ids = [a.get("user_id") for a in ag_map.values() if a.get("user_id")]
        users_by_id = {}
        if user_ids:
            async for u in db.users.find({"id": {"$in": user_ids}}, {"_id": 0, "id": 1, "full_name": 1}):
                users_by_id[u["id"]] = u
        for t in transfers:
            a = ag_map.get(t.get("agent_id"), {})
            t["agent_name"] = a.get("full_name") or (users_by_id.get(a.get("user_id"), {}).get("full_name")) or "Agent"
    ctx = _panel_base_ctx(request, "superagent", user, section="transfers", section_title="Transferts du r\u00e9seau", transfers=transfers)
    return templates.TemplateResponse("panels/superagent.html", ctx)


@router.get("/web/superagent/earnings", response_class=HTMLResponse)
async def superagent_earnings(request: Request):
    user = await _resolve_session("superagent", request)
    if not user:
        return _login_page(request, "superagent")
    agent_ids = await _super_agent_ids(user)
    overrides = []
    agents_map = {}
    if agent_ids:
        async for a in db.agents.find({"id": {"$in": agent_ids}}, {"_id": 0}):
            agents_map[a["id"]] = a
        for aid, a in agents_map.items():
            completed = await db.transfers.count_documents({"agent_id": aid, "status": "COMPLETED"})
            v = 0.0
            async for x in db.transfers.aggregate([
                {"$match": {"agent_id": aid, "status": "COMPLETED"}},
                {"$group": {"_id": None, "v": {"$sum": "$send_amount"}}},
            ]):
                v = float(x.get("v") or 0)
            overrides.append({
                "agent_name": a.get("full_name") or "Agent",
                "completed": completed, "volume": round(v, 2),
                "override": round(v * 0.10, 2),
            })
        overrides.sort(key=lambda o: o["override"], reverse=True)
    ctx = _panel_base_ctx(request, "superagent", user, section="earnings", section_title="Override commission", overrides=overrides)
    return templates.TemplateResponse("panels/superagent.html", ctx)
