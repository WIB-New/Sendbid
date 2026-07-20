"""Web panels submodule (split from web_panels.py)."""
import logging
from typing import Optional

from fastapi import Request, Form
from fastapi.responses import HTMLResponse, RedirectResponse

from core.db import db, now_utc, iso, clean_doc
from core.security import verify_password, create_access_token

from . import router, templates
import datetime as _dt
from .utils import (
    _safe_date, _current_year, _url_prefix, _u, _marketing_ctx,
    _resolve_session, _panel_base_ctx, _login_page, _admin_kpis,
)


logger = logging.getLogger("sendbid.web_panels.admin")


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


@router.get("/web/admin/linked-accounts", response_class=HTMLResponse)
async def admin_linked_accounts(request: Request):
    user = await _resolve_session("admin", request)
    if not user:
        return _login_page(request, "admin")
    raw = await db.linked_accounts.find({"status": {"$ne": "deleted"}}, {"_id": 0}).sort("created_at", -1).to_list(500)
    user_ids = [a.get("user_id") for a in raw if a.get("user_id")]
    users_map = {}
    if user_ids:
        async for u in db.users.find({"id": {"$in": user_ids}}, {"_id": 0, "id": 1, "full_name": 1, "email": 1, "country": 1}):
            users_map[u["id"]] = u
    accounts = []
    for a in raw:
        u = users_map.get(a.get("user_id"), {})
        ca = a.get("created_at")
        if isinstance(ca, _dt.datetime):
            a["created_at"] = ca.isoformat()
        accounts.append({**a, "user_name": u.get("full_name"), "user_email": u.get("email"), "user_country": u.get("country")})
    ctx = _panel_base_ctx(request, "admin", user, section="linked-accounts", section_title="Comptes liés", accounts=accounts)
    return templates.TemplateResponse("panels/admin.html", ctx)


@router.post("/web/admin/linked-accounts/{account_id}/verify", response_class=HTMLResponse)
async def admin_verify_linked_account(request: Request, account_id: str, action: str = Form(...)):
    user = await _resolve_session("admin", request)
    if not user:
        return _login_page(request, "admin")
    new_status = "active" if action == "approve" else "rejected"
    await db.linked_accounts.update_one(
        {"id": account_id},
        {"$set": {"status": new_status, "verified_at": iso(now_utc()), "verified_by": "admin", "verification_note": "Action manuelle admin"}},
    )
    return RedirectResponse(url=f"{_url_prefix()}/admin/linked-accounts", status_code=303)
