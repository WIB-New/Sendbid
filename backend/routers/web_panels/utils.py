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
from core.security import verify_password, create_access_token

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
    Retourne le pr\u00e9fixe d'URL \u00e0 utiliser pour les liens internes :
    - Sur sendfloo.sendbid.app    -> '' (URLs propres : /pricing, /admin, ...)
    - Sur sendbid.app/api/web/... -> '/api/web' (URLs internes Emergent)

    D\u00e9tection via le header Host. Le sous-domaine d\u00e9di\u00e9 (sendfloo.*) signifie
    que nginx fait d\u00e9j\u00e0 le rewrite vers /api/web/, donc on doit produire
    des liens sans pr\u00e9fixe pour l'utilisateur.
    """
    host = (request.headers.get("host") or "").lower()
    # Sous-domaine d\u00e9di\u00e9 : URLs propres
    if host.startswith("sendfloo.") or host.startswith("panel.") or host.startswith("admin."):
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
    ctx = {
        "request": request,
        "role": role,
        "role_display": ROLE_DISPLAY[role],
        "panel_title": f"Panel {ROLE_DISPLAY[role]}",
        "role_color": color,
        "role_color_dark": color_dark,
        "user": user,
        "current_year": _current_year(),
        "url_prefix": _url_prefix(request),
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
