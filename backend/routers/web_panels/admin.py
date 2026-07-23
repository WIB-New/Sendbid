"""Web panels submodule (split from web_panels.py)."""
import logging
from typing import Optional

from fastapi import Request, Form
from fastapi.responses import HTMLResponse, RedirectResponse

from core.db import db, now_utc, iso, clean_doc
from core.security import verify_password, create_access_token, hash_password, gen_id

from . import router, templates
import datetime as _dt
from .utils import (
    _safe_date, _current_year, _url_prefix, _u, _marketing_ctx,
    _resolve_session, _panel_base_ctx, _login_page, _admin_kpis,
)


logger = logging.getLogger("sendbid.web_panels.admin")


def _require_super_admin(admin: dict) -> bool:
    """Vérifie que l'admin connecté est un super-admin."""
    return (admin.get("role") == "super_admin")


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
async def admin_users(
    request: Request,
    page: int = 1,
    limit: int = 20,
    search: str = "",
    role_filter: str = "",
    network: str = "",
):
    user = await _resolve_session("admin", request)
    if not user:
        return _login_page(request, "admin")

    # Utilisateurs de l'application uniquement (pas le personnel admin)
    q: dict = {"role": {"$nin": ["admin", "super_admin"]}}
    if search:
        q["$or"] = [
            {"email": {"$regex": search, "$options": "i"}},
            {"full_name": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search}},
        ]
    if role_filter and role_filter not in {"admin", "super_admin"}:
        q["role"] = role_filter
    if network:
        if network == "paybid":
            q["email"] = {"$regex": r"@paybid\.app$"}
        elif network == "sendbid":
            q["email"] = {"$regex": r"@sendbid\.app$"}

    total = await db.users.count_documents(q)
    skip = max(0, (page - 1) * limit)
    users = await db.users.find(
        q,
        {"_id": 0, "password_hash": 0, "pin_hash": 0, "biometric_token": 0},
    ).sort("created_at", -1).skip(skip).to_list(limit)

    for u in users:
        ca = u.get("created_at")
        if isinstance(ca, _dt.datetime):
            u["created_at"] = ca.isoformat()

    pages = max(1, (total + limit - 1) // limit)
    ctx = _panel_base_ctx(
        request, "admin", user, section="users", section_title="Utilisateurs",
        users=users, total=total, page=page, pages=pages, limit=limit,
        search=search, role_filter=role_filter, network=network,
    )
    return templates.TemplateResponse("panels/admin.html", ctx)


@router.get("/web/admin/users/{user_id}", response_class=HTMLResponse)
async def admin_user_detail(request: Request, user_id: str, message: str = ""):
    admin = await _resolve_session("admin", request)
    if not admin:
        return _login_page(request, "admin")
    target = await db.users.find_one(
        {"id": user_id},
        {"_id": 0, "password_hash": 0, "pin_hash": 0, "biometric_token": 0},
    )
    if not target:
        return RedirectResponse(url=f"{_url_prefix()}/admin/users", status_code=303)
    ca = target.get("created_at")
    if isinstance(ca, _dt.datetime):
        target["created_at"] = ca.isoformat()
    ua = target.get("updated_at")
    if isinstance(ua, _dt.datetime):
        target["updated_at"] = ua.isoformat()
    ctx = _panel_base_ctx(
        request, "admin", admin, section="user-detail", section_title="Détail utilisateur",
        target=target, message=message,
    )
    return templates.TemplateResponse("panels/admin.html", ctx)


@router.get("/web/admin/personnel", response_class=HTMLResponse)
async def admin_personnel(
    request: Request,
    page: int = 1,
    limit: int = 20,
    search: str = "",
    role_filter: str = "",
    message: str = "",
):
    admin = await _resolve_session("admin", request)
    if not admin:
        return _login_page(request, "admin")

    q: dict = {"role": {"$in": ["admin", "super_admin"]}}
    if search:
        q["$or"] = [
            {"email": {"$regex": search, "$options": "i"}},
            {"full_name": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search}},
        ]
    if role_filter in {"admin", "super_admin"}:
        q["role"] = role_filter

    total = await db.users.count_documents(q)
    skip = max(0, (page - 1) * limit)
    staff = await db.users.find(
        q,
        {"_id": 0, "password_hash": 0, "pin_hash": 0, "biometric_token": 0},
    ).sort("created_at", -1).skip(skip).to_list(limit)

    for s in staff:
        ca = s.get("created_at")
        if isinstance(ca, _dt.datetime):
            s["created_at"] = ca.isoformat()

    pages = max(1, (total + limit - 1) // limit)
    ctx = _panel_base_ctx(
        request, "admin", admin, section="personnel", section_title="Personnel",
        staff=staff, total=total, page=page, pages=pages, limit=limit,
        search=search, role_filter=role_filter, message=message,
    )
    return templates.TemplateResponse("panels/admin.html", ctx)


@router.post("/web/admin/personnel/create", response_class=HTMLResponse)
async def admin_create_personnel(
    request: Request,
    full_name: str = Form(...),
    email: str = Form(...),
    phone: str = Form(...),
    password: str = Form(...),
    role: str = Form("admin"),
):
    admin = await _resolve_session("admin", request)
    if not admin:
        return _login_page(request, "admin")
    if not _require_super_admin(admin):
        return RedirectResponse(
            url=f"{_url_prefix()}/admin/personnel?message=Seul le super-admin peut créer du personnel",
            status_code=303,
        )
    if role not in {"admin", "super_admin"}:
        role = "admin"
    if len(password) < 6:
        return RedirectResponse(
            url=f"{_url_prefix()}/admin/personnel?message=Le mot de passe doit faire au moins 6 caractères",
            status_code=303,
        )
    if await db.users.find_one({"email": email}):
        return RedirectResponse(
            url=f"{_url_prefix()}/admin/personnel?message=Cet email est déjà utilisé",
            status_code=303,
        )
    await db.users.insert_one({
        "id": gen_id(),
        "full_name": full_name,
        "email": email,
        "phone": phone,
        "role": role,
        "password_hash": hash_password(password),
        "kyc_status": "verified",
        "kyc_tier": 2,
        "created_at": iso(now_utc()),
        "updated_at": iso(now_utc()),
    })
    return RedirectResponse(
        url=f"{_url_prefix()}/admin/personnel?message=Membre du personnel créé",
        status_code=303,
    )


@router.post("/web/admin/users/{user_id}/set-password", response_class=HTMLResponse)
async def admin_user_set_password(request: Request, user_id: str, password: str = Form(...)):
    admin = await _resolve_session("admin", request)
    if not admin:
        return _login_page(request, "admin")
    if len(password) < 6:
        return RedirectResponse(url=f"{_url_prefix()}/admin/users/{user_id}?message=Le mot de passe doit faire au moins 6 caractères", status_code=303)
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"password_hash": hash_password(password), "updated_at": iso(now_utc())}},
    )
    return RedirectResponse(url=f"{_url_prefix()}/admin/users/{user_id}?message=Mot de passe mis à jour", status_code=303)


@router.post("/web/admin/users/{user_id}/set-pin", response_class=HTMLResponse)
async def admin_user_set_pin(request: Request, user_id: str, pin: str = Form(...)):
    admin = await _resolve_session("admin", request)
    if not admin:
        return _login_page(request, "admin")
    if len(pin) != 6 or not pin.isdigit():
        return RedirectResponse(url=f"{_url_prefix()}/admin/users/{user_id}?message=Le PIN doit être 6 chiffres", status_code=303)
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"pin_hash": hash_password(pin), "pin_attempts": 0, "pin_locked_until": None, "updated_at": iso(now_utc())}},
    )
    return RedirectResponse(url=f"{_url_prefix()}/admin/users/{user_id}?message=PIN mis à jour", status_code=303)


@router.post("/web/admin/users/{user_id}/toggle-status", response_class=HTMLResponse)
async def admin_user_toggle_status(request: Request, user_id: str):
    admin = await _resolve_session("admin", request)
    if not admin:
        return _login_page(request, "admin")
    if user_id == admin.get("id"):
        return RedirectResponse(url=f"{_url_prefix()}/admin/users/{user_id}?message=Impossible de modifier votre propre compte", status_code=303)
    target = await db.users.find_one({"id": user_id}, {"_id": 0, "suspended": 1, "role": 1})
    if not target:
        return RedirectResponse(url=f"{_url_prefix()}/admin/users", status_code=303)
    if target.get("role") in {"admin", "super_admin"} and not _require_super_admin(admin):
        return RedirectResponse(
            url=f"{_url_prefix()}/admin/users/{user_id}?message=Seul le super-admin peut modifier un compte personnel",
            status_code=303,
        )
    new_status = not target.get("suspended", False)
    label = "suspendu" if new_status else "réactivé"
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"suspended": new_status, "updated_at": iso(now_utc())}},
    )
    return RedirectResponse(url=f"{_url_prefix()}/admin/users/{user_id}?message=Compte {label}", status_code=303)


@router.post("/web/admin/users/{user_id}/delete", response_class=HTMLResponse)
async def admin_user_delete(request: Request, user_id: str):
    admin = await _resolve_session("admin", request)
    if not admin:
        return _login_page(request, "admin")
    if user_id == admin.get("id"):
        return RedirectResponse(url=f"{_url_prefix()}/admin/users/{user_id}?message=Impossible de supprimer votre propre compte", status_code=303)
    target = await db.users.find_one({"id": user_id}, {"_id": 0, "role": 1})
    if target and target.get("role") in {"admin", "super_admin"} and not _require_super_admin(admin):
        return RedirectResponse(
            url=f"{_url_prefix()}/admin/users/{user_id}?message=Seul le super-admin peut supprimer un compte personnel",
            status_code=303,
        )
    await db.users.delete_one({"id": user_id})
    await db.wallets.delete_many({"user_id": user_id})
    await db.wallet_tx.delete_many({"user_id": user_id})
    await db.beneficiaries.delete_many({"user_id": user_id})
    await db.payment_methods.delete_many({"user_id": user_id})
    await db.notifications.delete_many({"user_id": user_id})
    await db.linked_accounts.delete_many({"user_id": user_id})
    return RedirectResponse(url=f"{_url_prefix()}/admin/users?message=Utilisateur supprimé", status_code=303)


@router.get("/web/admin/agents", response_class=HTMLResponse)
async def admin_agents(
    request: Request,
    page: int = 1,
    limit: int = 20,
    search: str = "",
    status: str = "",
    country: str = "",
):
    user = await _resolve_session("admin", request)
    if not user:
        return _login_page(request, "admin")

    q: dict = {}
    if status:
        q["status"] = status
    if country:
        q["country"] = country.upper()
    if search:
        q["$or"] = [
            {"full_name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
            {"city": {"$regex": search, "$options": "i"}},
        ]

    total = await db.agents.count_documents(q)
    skip = max(0, (page - 1) * limit)
    agents = await db.agents.find(q, {"_id": 0}).sort("created_at", -1).skip(skip).to_list(limit)

    pages = max(1, (total + limit - 1) // limit)
    ctx = _panel_base_ctx(
        request, "admin", user, section="agents", section_title="Agents",
        agents=agents, total=total, page=page, pages=pages, limit=limit,
        search=search, status=status, country=country,
    )
    return templates.TemplateResponse("panels/admin.html", ctx)


@router.get("/web/admin/transfers", response_class=HTMLResponse)
async def admin_transfers(
    request: Request,
    page: int = 1,
    limit: int = 20,
    status: str = "",
    country: str = "",
):
    user = await _resolve_session("admin", request)
    if not user:
        return _login_page(request, "admin")

    q: dict = {}
    if status:
        q["status"] = status
    if country:
        q["destination_country"] = country.upper()

    total = await db.transfers.count_documents(q)
    skip = max(0, (page - 1) * limit)
    transfers = await db.transfers.find(q, {"_id": 0}).sort("created_at", -1).skip(skip).to_list(limit)

    pages = max(1, (total + limit - 1) // limit)
    ctx = _panel_base_ctx(
        request, "admin", user, section="transfers", section_title="Transferts",
        transfers=transfers, total=total, page=page, pages=pages, limit=limit,
        status=status, country=country,
    )
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


@router.get("/web/admin/kyc", response_class=HTMLResponse)
async def admin_kyc(request: Request):
    user = await _resolve_session("admin", request)
    if not user:
        return _login_page(request, "admin")
    # Utilisateurs en attente de KYC (tier < 2 ou status pending)
    pending_users = await db.users.find(
        {"$or": [{"kyc_status": "pending"}, {"kyc_tier": {"$lt": 2}}]},
        {"_id": 0, "password_hash": 0, "pin_hash": 0, "biometric_token": 0},
    ).sort("created_at", -1).to_list(100)
    for u in pending_users:
        ca = u.get("created_at")
        if isinstance(ca, _dt.datetime):
            u["created_at"] = ca.isoformat()
    # Sessions de vérification récentes
    sessions = await db.kyc_sessions.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    user_ids = [s.get("user_id") for s in sessions if s.get("user_id")]
    users_map = {}
    if user_ids:
        async for u in db.users.find({"id": {"$in": user_ids}}, {"_id": 0, "id": 1, "full_name": 1, "email": 1}):
            users_map[u["id"]] = u
    for s in sessions:
        u = users_map.get(s.get("user_id"), {})
        s["user_name"] = u.get("full_name")
        s["user_email"] = u.get("email")
    ctx = _panel_base_ctx(
        request, "admin", user, section="kyc", section_title="KYC",
        pending_users=pending_users, kyc_sessions=sessions,
    )
    return templates.TemplateResponse("panels/admin.html", ctx)


@router.get("/web/admin/support", response_class=HTMLResponse)
async def admin_support(request: Request):
    user = await _resolve_session("admin", request)
    if not user:
        return _login_page(request, "admin")
    # Tickets ouverts avec dernier message
    tickets = await db.support_tickets.find({}, {"_id": 0}).sort("updated_at", -1).to_list(100)
    user_ids = [t.get("user_id") for t in tickets if t.get("user_id")]
    users_map = {}
    if user_ids:
        async for u in db.users.find({"id": {"$in": user_ids}}, {"_id": 0, "id": 1, "full_name": 1, "email": 1, "phone": 1}):
            users_map[u["id"]] = u
    enriched = []
    for t in tickets:
        u = users_map.get(t.get("user_id"), {})
        last_msg = await db.support_messages.find_one(
            {"ticket_id": t["id"]}, {"_id": 0, "text": 1, "sender": 1, "created_at": 1},
            sort=[("created_at", -1)],
        )
        enriched.append({**t, "user_name": u.get("full_name"), "user_email": u.get("email"), "last_message": last_msg})
    ctx = _panel_base_ctx(
        request, "admin", user, section="support", section_title="Support",
        tickets=enriched,
    )
    return templates.TemplateResponse("panels/admin.html", ctx)


@router.get("/web/admin/partners", response_class=HTMLResponse)
async def admin_partners(request: Request):
    user = await _resolve_session("admin", request)
    if not user:
        return _login_page(request, "admin")
    partners = await db.users.find(
        {"role": "partner_admin"},
        {"_id": 0, "password_hash": 0, "pin_hash": 0, "biometric_token": 0},
    ).sort("created_at", -1).to_list(100)
    for p in partners:
        ca = p.get("created_at")
        if isinstance(ca, _dt.datetime):
            p["created_at"] = ca.isoformat()
    ctx = _panel_base_ctx(
        request, "admin", user, section="partners", section_title="Partenaires",
        partners=partners,
    )
    return templates.TemplateResponse("panels/admin.html", ctx)


@router.get("/web/admin/rates", response_class=HTMLResponse)
async def admin_rates(request: Request):
    user = await _resolve_session("admin", request)
    if not user:
        return _login_page(request, "admin")
    corridors = await db.corridors.find({"active": True}, {"_id": 0}).sort("country_name", 1).to_list(300)
    ctx = _panel_base_ctx(
        request, "admin", user, section="rates", section_title="Taux de change",
        corridors=corridors,
    )
    return templates.TemplateResponse("panels/admin.html", ctx)


@router.post("/web/admin/rates/{country_code}", response_class=HTMLResponse)
async def admin_update_rate(request: Request, country_code: str, fx_rate_eur: str = Form(...), fx_margin_percent: str = Form(...)):
    user = await _resolve_session("admin", request)
    if not user:
        return _login_page(request, "admin")
    try:
        await db.corridors.update_one(
            {"country_code": country_code.upper()},
            {"$set": {
                "fx_rate_eur": float(fx_rate_eur),
                "fx_margin_percent": float(fx_margin_percent),
                "updated_at": iso(now_utc()),
            }},
        )
    except ValueError:
        pass
    return RedirectResponse(url=f"{_url_prefix()}/admin/rates", status_code=303)
