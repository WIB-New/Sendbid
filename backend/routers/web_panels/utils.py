"""Web panels — shared utilities (split from web_panels.py)."""
import datetime as _dt
import logging
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import Request, HTTPException
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates

from core.db import db, now_utc, iso, clean_doc
from core.security import verify_password, create_access_token, decode_token
from core.config import IS_PROD

# templates est défini dans __init__.py et ré-importé ici. On ne le ré-instancie pas.
from . import router, templates


COOKIE_PREFIX = "sb_web_session_"

ALLOWED_ROLES_BY_PANEL = {
    "admin": {"admin", "super_admin"},
    "superadmin": {"super_admin"},
    "partner": {"partner_admin", "super_admin"},
    "agent": {"agent", "super_agent"},
    "superagent": {"super_agent"},
}

ROLE_COLORS = {
    "admin": ("#1E3A8A", "#0F1F4E"),       # bleu marine profond
    "agent": ("#FFA500", "#CC7A00"),       # orange paybid
    "superagent": ("#7C3AED", "#5B21B6"),  # violet \u00e9lectrique
    "partner": ("#047857", "#064E3B"),     # vert pin
    "superadmin": ("#C9A227", "#8B6914"),  # moutarde dor\u00e9e
}

ROLE_DISPLAY = {
    "admin": "Administrateur",
    "superadmin": "Super-Administrateur",
    "partner": "Partenaire",
    "agent": "Agent",
    "superagent": "Super-Agent",
}


def _safe_date(value, length: int = 10) -> str:
    """Jinja2 filter: rend une date (str ISO ou datetime ou None) en cha\u00eene tronqu\u00e9e."""
    if value is None or value == "":
        return ""
    if isinstance(value, _dt.datetime):
        return value.isoformat()[:length]
    if isinstance(value, str):
        return value[:length]
    return str(value)[:length]


def _current_year() -> int:
    return _dt.datetime.utcnow().year


def _url_prefix(request: Request) -> str:
    """
    Retourne le prefix d'URL a utiliser pour les liens internes :
    - Sur sendbid.app / admin.sendbid.app / panel.sendbid.app -> '' (URLs propres : /pricing, /admin, ...)
    - Sur api.sendbid.app / api/web/... -> '/api/web' (URLs internes API)
    """
    # Check request path first - if we're under /api/web, use that as prefix
    raw_path = request.url.path or ""
    if raw_path.startswith("/api/web"):
        return "/api/web"
    host = (request.headers.get("host") or "").lower()
    # Public marketing site + admin/panel subdomains : URLs propres
    if host in ("sendbid.app", "www.sendbid.app") or host.startswith("panel.") or host.startswith("admin."):
        return ""
    return "/api/web"


def _u(request: Request, path: str) -> str:
    """Helper : pr\u00e9fixe `path` (commen\u00e7ant par '/') avec le bon pr\u00e9fixe."""
    return _url_prefix(request) + path


def _marketing_ctx(request: Request, active: str = "", extra: Optional[dict] = None) -> dict:
    ctx = {
        "request": request,
        "active": active,
        "current_year": _current_year(),
        "url_prefix": _url_prefix(request),
        "is_prod": IS_PROD,
    }
    if extra:
        ctx.update(extra)
    return ctx


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
    prefix = _url_prefix(request)
    role_path = extra.get("sidebar_role_path") or role
    base_url = (prefix + "/" + role_path).replace("//", "/")
    ctx = {
        "request": request,
        "role": role,
        "role_display": ROLE_DISPLAY[role],
        "panel_title": f"Panel {ROLE_DISPLAY[role]}",
        "role_color": color,
        "role_color_dark": color_dark,
        "user": user,
        "current_year": _current_year(),
        "url_prefix": prefix,
        "base_url": base_url,
        "is_prod": IS_PROD,
    }
    ctx.update(extra)
    return ctx


def _login_page(request: Request, role: str) -> HTMLResponse:
    # superadmin/partner réutilisent le template admin.html (mêmes UI)
    template_role = role
    if role in ("superadmin", "partner"):
        template_role = "admin"
    return templates.TemplateResponse(f"panels/{template_role}.html", _panel_base_ctx(request, role, user=None))


async def _admin_kpis(scope_transfers=None, scope_agents=None, scope_users=None) -> dict:
    scope_transfers = scope_transfers or {}
    scope_agents = scope_agents or {}
    scope_users = scope_users or {}
    now = now_utc()
    cutoff_30d = iso(now - _dt.timedelta(days=30))
    cutoff_7d = iso(now - _dt.timedelta(days=7))
    cutoff_1d = iso(now - _dt.timedelta(days=1))

    # ── Users ──
    total_users = await db.users.count_documents(scope_users)
    new_users_30d = await db.users.count_documents({**scope_users, "created_at": {"$gte": cutoff_30d}})
    new_users_7d = await db.users.count_documents({**scope_users, "created_at": {"$gte": cutoff_7d}})
    new_users_1d = await db.users.count_documents({**scope_users, "created_at": {"$gte": cutoff_1d}})
    suspended_users = await db.users.count_documents({**scope_users, "suspended": True})

    # ── Agents ──
    total_agents = await db.agents.count_documents(scope_agents)
    active_agents = await db.agents.count_documents({**scope_agents, "status": "approved", "available": True})
    pending_agents = await db.agents.count_documents({**scope_agents, "status": "pending_verification"})
    suspended_agents = await db.agents.count_documents({**scope_agents, "status": "suspended"})

    # ── Transfers ──
    total_transfers = await db.transfers.count_documents(scope_transfers)
    completed = await db.transfers.count_documents({**scope_transfers, "status": "COMPLETED"})
    in_progress = await db.transfers.count_documents(
        {**scope_transfers, "status": {"$in": ["BIDDING", "AGENT_ASSIGNED", "PROCESSING"]}}
    )
    failed = await db.transfers.count_documents({**scope_transfers, "status": {"$in": ["FAILED", "CANCELLED", "REFUNDED"]}})
    transfers_7d = await db.transfers.count_documents({**scope_transfers, "created_at": {"$gte": cutoff_7d}})
    transfers_1d = await db.transfers.count_documents({**scope_transfers, "created_at": {"$gte": cutoff_1d}})

    # Volume EUR
    vol = 0.0
    async for x in db.transfers.aggregate([
        {"$match": {**scope_transfers, "status": "COMPLETED"}},
        {"$group": {"_id": None, "v": {"$sum": "$send_amount"}}},
    ]):
        vol = float(x.get("v") or 0)
    vol_7d = 0.0
    async for x in db.transfers.aggregate([
        {"$match": {**scope_transfers, "status": "COMPLETED", "created_at": {"$gte": cutoff_7d}}},
        {"$group": {"_id": None, "v": {"$sum": "$send_amount"}}},
    ]):
        vol_7d = float(x.get("v") or 0)

    # ── Float ──
    total_float = 0.0
    async for x in db.agent_floats.aggregate([{"$group": {"_id": "$currency", "t": {"$sum": "$balance"}}}]):
        total_float += float(x.get("t") or 0)

    # ── KYC pending ──
    kyc_pending = await db.users.count_documents({"kyc_status": "pending", **scope_users})

    # ── Support tickets open ──
    open_tickets = await db.support_tickets.count_documents({"status": {"$in": ["open", "pending"]}})

    # ── Smart alerts ──
    alerts: list[dict] = []
    if pending_agents > 0:
        alerts.append({"level": "warning", "icon": "user-clock", "message": f"{pending_agents} agent(s) en attente de validation", "link": "agents"})
    if kyc_pending > 0:
        alerts.append({"level": "info", "icon": "shield-check", "message": f"{kyc_pending} KYC en attente de revue", "link": "kyc"})
    if open_tickets > 0:
        alerts.append({"level": "warning", "icon": "message-square", "message": f"{open_tickets} ticket(s) de support ouvert(s)", "link": "support"})
    if failed > 0:
        alerts.append({"level": "error", "icon": "alert-triangle", "message": f"{failed} transfert(s) échoué(s) / annulé(s)", "link": "transfers"})
    if suspended_users > 0:
        alerts.append({"level": "info", "icon": "user-x", "message": f"{suspended_users} compte(s) utilisateur(s) suspendu(s)", "link": "users"})
    if suspended_agents > 0:
        alerts.append({"level": "info", "icon": "user-x", "message": f"{suspended_agents} agent(s) suspendu(s)", "link": "agents"})

    # ── Transfer volume trend (last 7 days, daily) ──
    daily_volume: list[dict] = []
    async for x in db.transfers.aggregate([
        {"$match": {**scope_transfers, "status": "COMPLETED", "created_at": {"$gte": cutoff_7d}}},
        {"$group": {
            "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": {"$dateFromString": {"dateString": "$created_at"}}}},
            "volume": {"$sum": "$send_amount"},
            "count": {"$sum": 1},
        }},
        {"$sort": {"_id": 1}},
    ]):
        daily_volume.append({"date": x["_id"], "volume": round(float(x.get("volume") or 0), 2), "count": x.get("count", 0)})

    # ── Top corridors (last 30 days) ──
    top_corridors: list[dict] = []
    async for x in db.transfers.aggregate([
        {"$match": {**scope_transfers, "created_at": {"$gte": cutoff_30d}}},
        {"$group": {
            "_id": "$destination_country",
            "count": {"$sum": 1},
            "volume": {"$sum": "$send_amount"},
        }},
        {"$sort": {"count": -1}},
        {"$limit": 5},
    ]):
        top_corridors.append({
            "country": x["_id"] or "—",
            "count": x["count"],
            "volume": round(float(x.get("volume") or 0), 2),
        })

    # ── Recent audit logs ──
    recent_audit: list[dict] = []
    try:
        async for entry in db.audit_logs.find({}, {"_id": 0}).sort("created_at", -1).to_list(8):
            recent_audit.append(entry)
    except Exception:
        pass  # Collection may not exist yet

    return {
        "users": {
            "total": total_users, "new_30d": new_users_30d, "new_7d": new_users_7d,
            "new_1d": new_users_1d, "suspended": suspended_users,
        },
        "agents": {
            "total": total_agents, "active": active_agents, "pending": pending_agents,
            "suspended": suspended_agents,
        },
        "transfers": {
            "total": total_transfers, "completed": completed, "in_progress": in_progress,
            "failed": failed, "volume_eur": round(vol, 2), "volume_7d": round(vol_7d, 2),
            "count_7d": transfers_7d, "count_1d": transfers_1d,
        },
        "float": {"total_declared": round(total_float, 2)},
        "kyc_pending": kyc_pending,
        "open_tickets": open_tickets,
        "alerts": alerts,
        "daily_volume": daily_volume,
        "top_corridors": top_corridors,
        "recent_audit": recent_audit,
    }


async def _agent_record(user: dict) -> Optional[dict]:
    return await db.agents.find_one({"user_id": user["id"]}, {"_id": 0})


async def _super_agent_ids(super_user: dict) -> list[str]:
    """R\u00e9cup\u00e8re les IDs d'agents enfants de ce super-agent."""
    own_agent = await db.agents.find_one({"user_id": super_user["id"]}, {"_id": 0, "id": 1})
    super_agent_id = own_agent.get("id") if own_agent else super_user.get("id")
    ids = [a["id"] async for a in db.agents.find({"parent_agent_id": super_agent_id}, {"id": 1})]
    return ids

# Filter registration — placed at end so helper functions are defined
templates.env.filters["safe_date"] = _safe_date
