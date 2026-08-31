"""Web panels submodule (split from web_panels.py)."""
import logging
from typing import Optional

from fastapi import Request, Form
from fastapi.responses import HTMLResponse, RedirectResponse

from core.db import db, now_utc, iso, clean_doc
from core.security import verify_password, create_access_token, hash_password, gen_id
from core.audit import log_action, get_recent_logs

from . import router, templates
import datetime as _dt
from .utils import (
    _safe_date, _current_year, _url_prefix, _u, _marketing_ctx,
    _resolve_session, _panel_base_ctx, _login_page, _admin_kpis,
)


def _client_ip(request: Request) -> str:
    """Extract client IP from request, handling proxies."""
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else ""


def _actor_info(admin: dict) -> dict:
    """Extract actor info for audit logging."""
    return {
        "actor_id": admin.get("id", ""),
        "actor_role": admin.get("role", ""),
        "actor_name": admin.get("full_name") or admin.get("email", ""),
    }


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
        return RedirectResponse(url=f"{_url_prefix(request)}/admin/users", status_code=303)
    ca = target.get("created_at")
    if isinstance(ca, _dt.datetime):
        target["created_at"] = ca.isoformat()
    ua = target.get("updated_at")
    if isinstance(ua, _dt.datetime):
        target["updated_at"] = ua.isoformat()
    # Enrich: user's transfers
    user_transfers = await db.transfers.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1).to_list(20)
    # User wallet
    wallet = await db.wallets.find_one({"user_id": user_id}, {"_id": 0})
    # Wallet transactions
    wallet_tx = await db.wallet_tx.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1).to_list(20)
    # Support tickets
    tickets = await db.support_tickets.find({"user_id": user_id}, {"_id": 0}).sort("updated_at", -1).to_list(10)
    # Linked accounts
    linked_accounts = await db.linked_accounts.find({"user_id": user_id, "status": {"$ne": "deleted"}}, {"_id": 0}).sort("created_at", -1).to_list(20)
    # Beneficiaries
    beneficiaries = await db.beneficiaries.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1).to_list(20)
    ctx = _panel_base_ctx(
        request, "admin", admin, section="user-detail", section_title="Détail utilisateur",
        target=target, message=message,
        user_transfers=user_transfers, wallet=wallet, wallet_tx=wallet_tx,
        tickets=tickets, linked_accounts=linked_accounts, beneficiaries=beneficiaries,
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
            url=f"{_url_prefix(request)}/admin/personnel?message=Seul le super-admin peut créer du personnel",
            status_code=303,
        )
    if role not in {"admin", "super_admin"}:
        role = "admin"
    if len(password) < 6:
        return RedirectResponse(
            url=f"{_url_prefix(request)}/admin/personnel?message=Le mot de passe doit faire au moins 6 caractères",
            status_code=303,
        )
    if await db.users.find_one({"email": email}):
        return RedirectResponse(
            url=f"{_url_prefix(request)}/admin/personnel?message=Cet email est déjà utilisé",
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
    # Audit log
    await log_action(**_actor_info(admin), action="create_personnel", target_type="personnel",
        target_id=email, target_name=full_name,
        details={"role": role, "email": email},
        ip_address=_client_ip(request), user_agent=request.headers.get("user-agent", ""))
    return RedirectResponse(
        url=f"{_url_prefix(request)}/admin/personnel?message=Membre du personnel créé",
        status_code=303,
    )


@router.post("/web/admin/users/{user_id}/set-password", response_class=HTMLResponse)
async def admin_user_set_password(request: Request, user_id: str, password: str = Form(...)):
    admin = await _resolve_session("admin", request)
    if not admin:
        return _login_page(request, "admin")
    target = await db.users.find_one({"id": user_id}, {"_id": 0, "role": 1, "email": 1, "full_name": 1})
    if target and target.get("role") in {"admin", "super_admin"} and not _require_super_admin(admin):
        return RedirectResponse(
            url=f"{_url_prefix(request)}/admin/users/{user_id}?message=Seul le super-admin peut modifier le mot de passe d'un compte personnel",
            status_code=303,
        )
    if len(password) < 6:
        return RedirectResponse(url=f"{_url_prefix(request)}/admin/users/{user_id}?message=Le mot de passe doit faire au moins 6 caractères", status_code=303)
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"password_hash": hash_password(password), "updated_at": iso(now_utc())}},
    )
    # Audit log + email notification
    await log_action(**_actor_info(admin), action="set_password", target_type="user",
        target_id=user_id, target_name=target.get("full_name") or target.get("email", ""),
        ip_address=_client_ip(request), user_agent=request.headers.get("user-agent", ""))
    try:
        from services.admin_notify import notify_admin_action
        await notify_admin_action(
            user_email=target.get("email", ""), user_name=target.get("full_name", ""),
            action_label="Votre mot de passe a été réinitialisé",
            detail="Un administrateur a réinitialisé votre mot de passe. Si vous n'êtes pas à l'origine de cette action, contactez le support immédiatement.",
            actor_name=admin.get("full_name") or admin.get("email", "l'équipe"),
        )
    except Exception as e:
        logger.warning(f"[admin set_password] notify failed: {e}")
    return RedirectResponse(url=f"{_url_prefix(request)}/admin/users/{user_id}?message=Mot de passe mis à jour", status_code=303)


@router.post("/web/admin/users/{user_id}/set-pin", response_class=HTMLResponse)
async def admin_user_set_pin(request: Request, user_id: str, pin: str = Form(...)):
    admin = await _resolve_session("admin", request)
    if not admin:
        return _login_page(request, "admin")
    target = await db.users.find_one({"id": user_id}, {"_id": 0, "role": 1, "email": 1, "full_name": 1})
    if target and target.get("role") in {"admin", "super_admin"} and not _require_super_admin(admin):
        return RedirectResponse(
            url=f"{_url_prefix(request)}/admin/users/{user_id}?message=Seul le super-admin peut modifier le PIN d'un compte personnel",
            status_code=303,
        )
    if len(pin) != 6 or not pin.isdigit():
        return RedirectResponse(url=f"{_url_prefix(request)}/admin/users/{user_id}?message=Le PIN doit être 6 chiffres", status_code=303)
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"pin_hash": hash_password(pin), "pin_attempts": 0, "pin_locked_until": None, "updated_at": iso(now_utc())}},
    )
    # Audit log + email notification
    await log_action(**_actor_info(admin), action="set_pin", target_type="user",
        target_id=user_id, target_name=target.get("full_name") or target.get("email", ""),
        ip_address=_client_ip(request), user_agent=request.headers.get("user-agent", ""))
    try:
        from services.admin_notify import notify_admin_action
        await notify_admin_action(
            user_email=target.get("email", ""), user_name=target.get("full_name", ""),
            action_label="Votre code PIN a été réinitialisé",
            detail="Un administrateur a réinitialisé votre code PIN de sécurité.",
            actor_name=admin.get("full_name") or admin.get("email", "l'équipe"),
        )
    except Exception as e:
        logger.warning(f"[admin set_pin] notify failed: {e}")
    return RedirectResponse(url=f"{_url_prefix(request)}/admin/users/{user_id}?message=PIN mis à jour", status_code=303)


@router.post("/web/admin/users/{user_id}/toggle-status", response_class=HTMLResponse)
async def admin_user_toggle_status(request: Request, user_id: str):
    admin = await _resolve_session("admin", request)
    if not admin:
        return _login_page(request, "admin")
    if user_id == admin.get("id"):
        return RedirectResponse(url=f"{_url_prefix(request)}/admin/users/{user_id}?message=Impossible de modifier votre propre compte", status_code=303)
    target = await db.users.find_one({"id": user_id}, {"_id": 0, "suspended": 1, "role": 1})
    if not target:
        return RedirectResponse(url=f"{_url_prefix(request)}/admin/users", status_code=303)
    if target.get("role") in {"admin", "super_admin"} and not _require_super_admin(admin):
        return RedirectResponse(
            url=f"{_url_prefix(request)}/admin/users/{user_id}?message=Seul le super-admin peut modifier un compte personnel",
            status_code=303,
        )
    new_status = not target.get("suspended", False)
    label = "suspendu" if new_status else "réactivé"
    action_verb = "suspend" if new_status else "reactivate"
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"suspended": new_status, "updated_at": iso(now_utc())}},
    )
    # Audit log + email notification
    full_target = await db.users.find_one({"id": user_id}, {"_id": 0, "email": 1, "full_name": 1})
    await log_action(**_actor_info(admin), action=action_verb, target_type="user",
        target_id=user_id, target_name=(full_target or {}).get("full_name") or (full_target or {}).get("email", ""),
        ip_address=_client_ip(request), user_agent=request.headers.get("user-agent", ""))
    try:
        from services.admin_notify import notify_admin_action
        if new_status:
            action_label = "Votre compte a été suspendu"
            detail = "Votre compte a été suspendu par un administrateur. Pour plus d'informations, contactez notre support."
        else:
            action_label = "Votre compte a été réactivé"
            detail = "Votre compte est de nouveau actif. Vous pouvez vous connecter normalement."
        await notify_admin_action(
            user_email=(full_target or {}).get("email", ""), user_name=(full_target or {}).get("full_name", ""),
            action_label=action_label, detail=detail,
            actor_name=admin.get("full_name") or admin.get("email", "l'équipe"),
        )
    except Exception as e:
        logger.warning(f"[admin toggle_status] notify failed: {e}")
    return RedirectResponse(url=f"{_url_prefix(request)}/admin/users/{user_id}?message=Compte {label}", status_code=303)


@router.post("/web/admin/users/{user_id}/delete", response_class=HTMLResponse)
async def admin_user_delete(request: Request, user_id: str):
    admin = await _resolve_session("admin", request)
    if not admin:
        return _login_page(request, "admin")
    if user_id == admin.get("id"):
        return RedirectResponse(url=f"{_url_prefix(request)}/admin/users/{user_id}?message=Impossible de supprimer votre propre compte", status_code=303)
    target = await db.users.find_one({"id": user_id}, {"_id": 0, "role": 1})
    if target and target.get("role") in {"admin", "super_admin"} and not _require_super_admin(admin):
        return RedirectResponse(
            url=f"{_url_prefix(request)}/admin/users/{user_id}?message=Seul le super-admin peut supprimer un compte personnel",
            status_code=303,
        )
    # Fetch user info before deletion for audit + email
    full_target = await db.users.find_one({"id": user_id}, {"_id": 0, "email": 1, "full_name": 1, "phone": 1})
    await db.users.delete_one({"id": user_id})
    await db.wallets.delete_many({"user_id": user_id})
    await db.wallet_tx.delete_many({"user_id": user_id})
    await db.beneficiaries.delete_many({"user_id": user_id})
    await db.payment_methods.delete_many({"user_id": user_id})
    await db.notifications.delete_many({"user_id": user_id})
    await db.linked_accounts.delete_many({"user_id": user_id})
    # Audit log + email notification
    await log_action(**_actor_info(admin), action="delete", target_type="user",
        target_id=user_id, target_name=(full_target or {}).get("full_name") or (full_target or {}).get("email", ""),
        ip_address=_client_ip(request), user_agent=request.headers.get("user-agent", ""))
    try:
        from services.admin_notify import notify_admin_action
        await notify_admin_action(
            user_email=(full_target or {}).get("email", ""), user_name=(full_target or {}).get("full_name", ""),
            action_label="Votre compte a été supprimé",
            detail="Votre compte et toutes les données associées ont été supprimés conformément à nos politiques.",
            actor_name=admin.get("full_name") or admin.get("email", "l'équipe"),
        )
    except Exception as e:
        logger.warning(f"[admin delete] notify failed: {e}")
    return RedirectResponse(url=f"{_url_prefix(request)}/admin/users?message=Utilisateur supprimé", status_code=303)


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
async def admin_audit(request: Request, page: int = 1, limit: int = 50, actor_role: str = "", target_type: str = ""):
    user = await _resolve_session("admin", request)
    if not user:
        return _login_page(request, "admin")
    # Real audit logs from audit_logs collection
    audit_logs = await get_recent_logs(limit=limit, skip=max(0, (page - 1) * limit), actor_role=actor_role, target_type=target_type)
    total_logs = await db.audit_logs.count_documents({} if not actor_role and not target_type else {
        **({"actor_role": actor_role} if actor_role else {}),
        **({"target_type": target_type} if target_type else {}),
    })
    # Also keep float movements summary
    movements = []
    async for x in db.agent_float_movements.aggregate([
        {"$group": {
            "_id": {"type": "$type", "currency": "$currency"},
            "total": {"$sum": "$amount_signed"}, "count": {"$sum": 1},
        }},
    ]):
        movements.append({"type": x["_id"]["type"], "currency": x["_id"]["currency"], "total": x["total"], "count": x["count"]})
    pages = max(1, (total_logs + limit - 1) // limit)
    ctx = _panel_base_ctx(request, "admin", user, section="audit", section_title="Audit logs",
        audit_logs=audit_logs, total_logs=total_logs, page=page, pages=pages,
        movements=movements, actor_role=actor_role, target_type=target_type)
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
    # Audit log
    account_doc = await db.linked_accounts.find_one({"id": account_id}, {"_id": 0, "user_id": 1, "bank_name": 1})
    if account_doc and account_doc.get("user_id"):
        acc_user = await db.users.find_one({"id": account_doc["user_id"]}, {"_id": 0, "email": 1, "full_name": 1})
        await log_action(**_actor_info(user), action=f"linked_account_{action}", target_type="linked_account",
            target_id=account_id, target_name=account_doc.get("bank_name", ""),
            ip_address=_client_ip(request), user_agent=request.headers.get("user-agent", ""))
        try:
            from services.admin_notify import notify_admin_action
            if action == "approve":
                lbl = "Votre compte bancaire lié a été vérifié"
                det = f"Votre compte bancaire ({account_doc.get('bank_name', 'N/A')}) a été approuvé et est maintenant actif."
            else:
                lbl = "Votre compte bancaire lié a été rejeté"
                det = f"La vérification de votre compte bancaire ({account_doc.get('bank_name', 'N/A')}) a été rejetée. Contactez le support."
            await notify_admin_action(
                user_email=(acc_user or {}).get("email", ""), user_name=(acc_user or {}).get("full_name", ""),
                action_label=lbl, detail=det,
                actor_name=user.get("full_name") or user.get("email", "l'équipe"),
            )
        except Exception as e:
            logger.warning(f"[admin verify_linked_account] notify failed: {e}")
    return RedirectResponse(url=f"{_url_prefix(request)}/admin/linked-accounts", status_code=303)


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
    if not _require_super_admin(user):
        return RedirectResponse(
            url=f"{_url_prefix(request)}/admin/rates?message=Seul le super-admin peut modifier les taux de change",
            status_code=303,
        )
    try:
        await db.corridors.update_one(
            {"country_code": country_code.upper()},
            {"$set": {
                "fx_rate_eur": float(fx_rate_eur),
                "fx_margin_percent": float(fx_margin_percent),
                "updated_at": iso(now_utc()),
            }},
        )
        # Audit log
        await log_action(**_actor_info(user), action="update_rate", target_type="rate",
            target_id=country_code.upper(), target_name=country_code.upper(),
            details={"fx_rate_eur": float(fx_rate_eur), "fx_margin_percent": float(fx_margin_percent)},
            ip_address=_client_ip(request), user_agent=request.headers.get("user-agent", ""))
    except ValueError:
        pass
    return RedirectResponse(url=f"{_url_prefix(request)}/admin/rates?message=Taux mis à jour", status_code=303)


# ── Agent moderation ────────────────────────────────────────────────────────
@router.post("/web/admin/agents/{agent_id}/moderate", response_class=HTMLResponse)
async def admin_moderate_agent(request: Request, agent_id: str, action: str = Form(...), reason: str = Form("")):
    admin = await _resolve_session("admin", request)
    if not admin:
        return _login_page(request, "admin")
    status_map = {
        "approve": "approved", "reject": "rejected",
        "suspend": "suspended", "reactivate": "approved",
    }
    new_status = status_map.get(action)
    if not new_status:
        return RedirectResponse(url=f"{_url_prefix(request)}/admin/agents?message=Action inconnue", status_code=303)
    await db.agents.update_one(
        {"id": agent_id},
        {"$set": {
            "status": new_status,
            "moderated_at": iso(now_utc()),
            "moderated_by": admin.get("id"),
            "moderation_reason": reason or None,
        }},
    )
    # Audit log
    agent_doc = await db.agents.find_one({"id": agent_id}, {"_id": 0, "full_name": 1, "email": 1, "user_id": 1})
    await log_action(**_actor_info(admin), action=f"agent_{action}", target_type="agent",
        target_id=agent_id, target_name=(agent_doc or {}).get("full_name") or (agent_doc or {}).get("email", ""),
        details={"reason": reason} if reason else {},
        ip_address=_client_ip(request), user_agent=request.headers.get("user-agent", ""))
    # Notify agent by email
    try:
        from services.admin_notify import notify_admin_action
        reject_detail = "Votre demande d'agent a été rejetée. " + (f"Raison: {reason}" if reason else "Contactez le support pour plus d'informations.")
        suspend_detail = "Votre compte agent a été suspendu. " + (f"Raison: {reason}" if reason else "Contactez le support pour plus d'informations.")
        action_labels = {
            "approve": ("Votre compte agent a été approuvé", "Félicitations ! Votre compte agent est maintenant actif. Vous pouvez recevoir des transferts."),
            "reject": ("Votre compte agent a été rejeté", reject_detail),
            "suspend": ("Votre compte agent a été suspendu", suspend_detail),
            "reactivate": ("Votre compte agent a été réactivé", "Votre compte agent est de nouveau actif."),
        }
        if action in action_labels and agent_doc and agent_doc.get("user_id"):
            agent_user = await db.users.find_one({"id": agent_doc["user_id"]}, {"_id": 0, "email": 1, "full_name": 1})
            label, detail = action_labels[action]
            await notify_admin_action(
                user_email=(agent_user or {}).get("email", ""), user_name=(agent_user or {}).get("full_name", ""),
                action_label=label, detail=detail,
                actor_name=admin.get("full_name") or admin.get("email", "l'équipe"),
                app_brand="PAYBID",
            )
    except Exception as e:
        logger.warning(f"[admin moderate_agent] notify failed: {e}")
    label = {"approved": "approuvé", "rejected": "rejeté", "suspended": "suspendu"}.get(new_status, new_status)
    return RedirectResponse(url=f"{_url_prefix(request)}/admin/agents?message=Agent {label}", status_code=303)


# ── Agent detail ────────────────────────────────────────────────────────────
@router.get("/web/admin/agents/{agent_id}", response_class=HTMLResponse)
async def admin_agent_detail(request: Request, agent_id: str, message: str = ""):
    admin = await _resolve_session("admin", request)
    if not admin:
        return _login_page(request, "admin")
    agent = await db.agents.find_one({"id": agent_id}, {"_id": 0})
    if not agent:
        return RedirectResponse(url=f"{_url_prefix(request)}/admin/agents", status_code=303)
    # Floats
    floats = await db.agent_floats.find({"agent_id": agent_id}, {"_id": 0}).to_list(50)
    # Recent movements
    movements = await db.agent_float_movements.find({"agent_id": agent_id}, {"_id": 0}).sort("created_at", -1).to_list(50)
    # Assigned transfers
    transfers = await db.transfers.find({"winning_agent_id": agent_id}, {"_id": 0}).sort("created_at", -1).to_list(20)
    ctx = _panel_base_ctx(
        request, "admin", admin, section="agent-detail", section_title=f"Agent — {agent.get('full_name') or agent_id}",
        agent=agent, floats=floats, movements=movements, transfers=transfers, message=message,
    )
    return templates.TemplateResponse("panels/admin.html", ctx)


# ── Transfer detail ─────────────────────────────────────────────────────────
@router.get("/web/admin/transfers/{transfer_id}", response_class=HTMLResponse)
async def admin_transfer_detail(request: Request, transfer_id: str, message: str = ""):
    admin = await _resolve_session("admin", request)
    if not admin:
        return _login_page(request, "admin")
    transfer = await db.transfers.find_one({"id": transfer_id}, {"_id": 0})
    if not transfer:
        return RedirectResponse(url=f"{_url_prefix(request)}/admin/transfers", status_code=303)
    # Bids
    bids = await db.bids.find({"transfer_id": transfer_id}, {"_id": 0}).sort("bid_fee_percent", 1).to_list(50)
    # Agent info
    agent = None
    if transfer.get("winning_agent_id"):
        agent = await db.agents.find_one({"id": transfer["winning_agent_id"]}, {"_id": 0})
    # User info
    user = None
    if transfer.get("user_id"):
        user = await db.users.find_one({"id": transfer["user_id"]}, {"_id": 0, "password_hash": 0, "pin_hash": 0, "biometric_token": 0})
    # Wallet transactions for this transfer
    wallet_tx = await db.wallet_tx.find({"transfer_id": transfer_id}, {"_id": 0}).sort("created_at", -1).to_list(20)
    ctx = _panel_base_ctx(
        request, "admin", admin, section="transfer-detail", section_title=f"Transfert — {transfer_id[:8]}",
        transfer=transfer, bids=bids, agent=agent, t_user=user, wallet_tx=wallet_tx, message=message,
    )
    return templates.TemplateResponse("panels/admin.html", ctx)


# ── Transfer actions ────────────────────────────────────────────────────────
@router.post("/web/admin/transfers/{transfer_id}/action", response_class=HTMLResponse)
async def admin_transfer_action(request: Request, transfer_id: str, action: str = Form(...), reason: str = Form("")):
    admin = await _resolve_session("admin", request)
    if not admin:
        return _login_page(request, "admin")
    transfer = await db.transfers.find_one({"id": transfer_id}, {"_id": 0, "status": 1, "user_id": 1})
    if not transfer:
        return RedirectResponse(url=f"{_url_prefix(request)}/admin/transfers", status_code=303)
    allowed = {"cancel": "CANCELLED", "refund": "REFUNDED", "complete": "COMPLETED", "process": "PROCESSING"}
    new_status = allowed.get(action)
    if not new_status:
        return RedirectResponse(url=f"{_url_prefix(request)}/admin/transfers/{transfer_id}?message=Action inconnue", status_code=303)
    update_set = {
        "status": new_status,
        "updated_at": iso(now_utc()),
        "admin_action": action,
        "admin_action_by": admin.get("id"),
        "admin_action_reason": reason or None,
        "admin_action_at": iso(now_utc()),
    }
    await db.transfers.update_one({"id": transfer_id}, {"$set": update_set})
    # Audit log
    t_doc = await db.transfers.find_one({"id": transfer_id}, {"_id": 0, "send_amount": 1, "send_currency": 1, "destination_country": 1})
    await log_action(**_actor_info(admin), action=f"transfer_{action}", target_type="transfer",
        target_id=transfer_id, target_name=f"{transfer_id[:8]}",
        details={"new_status": new_status, "reason": reason} if reason else {"new_status": new_status},
        ip_address=_client_ip(request), user_agent=request.headers.get("user-agent", ""))
    # If refund, credit user wallet back
    if action == "refund" and transfer.get("user_id"):
        wallet = await db.wallets.find_one({"user_id": transfer["user_id"]})
        if wallet:
            await db.wallets.update_one(
                {"user_id": transfer["user_id"]},
                {"$inc": {"balance": transfer.get("send_amount", 0)}, "$set": {"updated_at": iso(now_utc())}},
            )
            await db.wallet_tx.insert_one({
                "id": gen_id(), "user_id": transfer["user_id"], "transfer_id": transfer_id,
                "type": "refund", "amount": transfer.get("send_amount", 0), "currency": "EUR",
                "created_at": iso(now_utc()), "note": f"Remboursement admin ({reason or 'N/A'})",
            })
    label = {"CANCELLED": "annulé", "REFUNDED": "remboursé", "COMPLETED": "complété", "PROCESSING": "en traitement"}.get(new_status, new_status)
    # Notify user by email
    try:
        from services.admin_notify import notify_admin_action
        if transfer.get("user_id"):
            t_user = await db.users.find_one({"id": transfer["user_id"]}, {"_id": 0, "email": 1, "full_name": 1})
            action_labels = {
                "cancel": ("Votre transfert a été annulé", f"Le transfert {transfer_id[:8]} a été annulé{(' — ' + reason) if reason else ''}."),
                "refund": ("Votre transfert a été remboursé", f"Le transfert {transfer_id[:8]} a été remboursé. Le montant a été crédité sur votre wallet."),
                "complete": ("Votre transfert est complété", f"Le transfert {transfer_id[:8]} est maintenant marqué comme complété."),
                "process": ("Votre transfert est en traitement", f"Le transfert {transfer_id[:8]} est en cours de traitement."),
            }
            if action in action_labels and t_user:
                lbl, det = action_labels[action]
                await notify_admin_action(
                    user_email=t_user.get("email", ""), user_name=t_user.get("full_name", ""),
                    action_label=lbl, detail=det,
                    actor_name=admin.get("full_name") or admin.get("email", "l'équipe"),
                )
    except Exception as e:
        logger.warning(f"[admin transfer_action] notify failed: {e}")
    return RedirectResponse(url=f"{_url_prefix(request)}/admin/transfers/{transfer_id}?message=Transfert {label}", status_code=303)


# ── KYC actions ─────────────────────────────────────────────────────────────
@router.post("/web/admin/kyc/{user_id}/action", response_class=HTMLResponse)
async def admin_kyc_action(request: Request, user_id: str, action: str = Form(...), reason: str = Form("")):
    admin = await _resolve_session("admin", request)
    if not admin:
        return _login_page(request, "admin")
    if action == "approve":
        await db.users.update_one(
            {"id": user_id},
            {"$set": {"kyc_status": "verified", "kyc_tier": 2, "kyc_verified_at": iso(now_utc()), "kyc_verified_by": admin.get("id"), "updated_at": iso(now_utc())}},
        )
        msg = "KYC approuvé — Tier 2 attribué"
        audit_action = "kyc_approve"
        notify_label = "Votre vérification KYC a été approuvée"
        notify_detail = "Votre identité a été vérifiée. Vous avez maintenant accès à toutes les fonctionnalités de transfert (Tier 2)."
    elif action == "reject":
        await db.users.update_one(
            {"id": user_id},
            {"$set": {"kyc_status": "rejected", "kyc_rejection_reason": reason or None, "kyc_reviewed_at": iso(now_utc()), "kyc_reviewed_by": admin.get("id"), "updated_at": iso(now_utc())}},
        )
        msg = f"KYC rejeté{(' — ' + reason) if reason else ''}"
        audit_action = "kyc_reject"
        notify_label = "Votre vérification KYC a été rejetée"
        notify_detail = f"Votre demande de vérification KYC a été rejetée{(' — ' + reason) if reason else ''}. Vous pouvez soumettre à nouveau vos documents."
    elif action == "tier3":
        await db.users.update_one(
            {"id": user_id},
            {"$set": {"kyc_status": "verified", "kyc_tier": 3, "kyc_verified_at": iso(now_utc()), "kyc_verified_by": admin.get("id"), "updated_at": iso(now_utc())}},
        )
        msg = "KYC approuvé — Tier 3 attribué"
        audit_action = "kyc_tier3"
        notify_label = "Votre compte a été élevé au Tier 3"
        notify_detail = "Votre compte a été vérifié au niveau Tier 3. Vous bénéficiez de limites de transfert étendues."
    else:
        msg = "Action inconnue"
        return RedirectResponse(url=f"{_url_prefix(request)}/admin/kyc?message={msg}", status_code=303)
    # Audit log
    kyc_user = await db.users.find_one({"id": user_id}, {"_id": 0, "email": 1, "full_name": 1})
    await log_action(**_actor_info(admin), action=audit_action, target_type="kyc",
        target_id=user_id, target_name=(kyc_user or {}).get("full_name") or (kyc_user or {}).get("email", ""),
        details={"reason": reason} if reason else {},
        ip_address=_client_ip(request), user_agent=request.headers.get("user-agent", ""))
    # Email notification
    try:
        from services.admin_notify import notify_admin_action
        await notify_admin_action(
            user_email=(kyc_user or {}).get("email", ""), user_name=(kyc_user or {}).get("full_name", ""),
            action_label=notify_label, detail=notify_detail,
            actor_name=admin.get("full_name") or admin.get("email", "l'équipe"),
        )
    except Exception as e:
        logger.warning(f"[admin kyc_action] notify failed: {e}")
    return RedirectResponse(url=f"{_url_prefix(request)}/admin/kyc?message={msg}", status_code=303)


# ── Support detail ──────────────────────────────────────────────────────────
@router.get("/web/admin/support/{ticket_id}", response_class=HTMLResponse)
async def admin_support_detail(request: Request, ticket_id: str, message: str = ""):
    admin = await _resolve_session("admin", request)
    if not admin:
        return _login_page(request, "admin")
    ticket = await db.support_tickets.find_one({"id": ticket_id}, {"_id": 0})
    if not ticket:
        return RedirectResponse(url=f"{_url_prefix(request)}/admin/support", status_code=303)
    messages = await db.support_messages.find({"ticket_id": ticket_id}, {"_id": 0}).sort("created_at", 1).to_list(200)
    user = None
    if ticket.get("user_id"):
        user = await db.users.find_one({"id": ticket["user_id"]}, {"_id": 0, "password_hash": 0, "pin_hash": 0, "biometric_token": 0})
    ctx = _panel_base_ctx(
        request, "admin", admin, section="support-detail", section_title=f"Ticket — {ticket_id[:8]}",
        ticket=ticket, messages=messages, t_user=user, message=message,
    )
    return templates.TemplateResponse("panels/admin.html", ctx)


@router.post("/web/admin/support/{ticket_id}/reply", response_class=HTMLResponse)
async def admin_support_reply(request: Request, ticket_id: str, text: str = Form(...)):
    admin = await _resolve_session("admin", request)
    if not admin:
        return _login_page(request, "admin")
    ticket = await db.support_tickets.find_one({"id": ticket_id})
    if not ticket:
        return RedirectResponse(url=f"{_url_prefix(request)}/admin/support", status_code=303)
    await db.support_messages.insert_one({
        "id": gen_id(), "ticket_id": ticket_id,
        "sender": "admin", "text": text.strip(),
        "created_at": iso(now_utc()),
    })
    await db.support_tickets.update_one({"id": ticket_id}, {"$set": {"updated_at": iso(now_utc()), "status": "open"}})
    return RedirectResponse(url=f"{_url_prefix(request)}/admin/support/{ticket_id}?message=Réponse envoyée", status_code=303)


@router.post("/web/admin/support/{ticket_id}/close", response_class=HTMLResponse)
async def admin_support_close(request: Request, ticket_id: str):
    admin = await _resolve_session("admin", request)
    if not admin:
        return _login_page(request, "admin")
    await db.support_tickets.update_one({"id": ticket_id}, {"$set": {"status": "closed", "closed_at": iso(now_utc())}})
    return RedirectResponse(url=f"{_url_prefix(request)}/admin/support?message=Ticket fermé", status_code=303)


# ── User detail enrichment ──────────────────────────────────────────────────
# (the existing admin_user_detail route is enriched with additional data below)


# ── Admin send notification to user ─────────────────────────────────────────
@router.post("/web/admin/users/{user_id}/notify", response_class=HTMLResponse)
async def admin_notify_user(request: Request, user_id: str, subject: str = Form(...), body: str = Form(...), channel: str = Form("email")):
    admin = await _resolve_session("admin", request)
    if not admin:
        return _login_page(request, "admin")
    target = await db.users.find_one({"id": user_id}, {"_id": 0, "email": 1, "phone": 1, "full_name": 1})
    if not target:
        return RedirectResponse(url=f"{_url_prefix(request)}/admin/users/{user_id}?message=Utilisateur introuvable", status_code=303)
    sent = {"email": False, "sms": False}
    try:
        from services.notify import send_email, send_sms
        if channel in ("email", "both"):
            sent["email"] = await send_email(target.get("email", ""), subject, f"<p>{body}</p>", plain=body)
        if channel in ("sms", "both"):
            sms_body = f"SENDBID — {subject}: {body[:100]}"
            sent["sms"] = await send_sms(target.get("phone", ""), sms_body)
    except Exception as e:
        logger.warning(f"[admin notify] {e}")
    # Also create in-app notification
    await db.notifications.insert_one({
        "id": gen_id(), "user_id": user_id,
        "type": "admin_message", "title": subject, "body": body,
        "read": False, "created_at": iso(now_utc()),
    })
    # Audit log
    await log_action(**_actor_info(admin), action="notify_user", target_type="user",
        target_id=user_id, target_name=target.get("full_name") or target.get("email", ""),
        details={"subject": subject, "channel": channel},
        ip_address=_client_ip(request), user_agent=request.headers.get("user-agent", ""))
    msg_parts = []
    if sent["email"]: msg_parts.append("email envoyé")
    if sent["sms"]: msg_parts.append("SMS envoyé")
    msg_parts.append("notification in-app créée")
    return RedirectResponse(url=f"{_url_prefix(request)}/admin/users/{user_id}?message={', '.join(msg_parts)}", status_code=303)


# ── Service status ──────────────────────────────────────────────────────────
@router.get("/web/admin/services", response_class=HTMLResponse)
async def admin_services(request: Request):
    admin = await _resolve_session("admin", request)
    if not admin:
        return _login_page(request, "admin")
    import os as _os
    services = []
    # MongoDB
    try:
        await db.command("ping")
        services.append({"name": "MongoDB", "status": "ok", "detail": "Connecté"})
    except Exception as e:
        services.append({"name": "MongoDB", "status": "error", "detail": str(e)[:100]})
    # Twilio
    twilio_sid = _os.getenv("TWILIO_ACCOUNT_SID", "")
    twilio_from = _os.getenv("TWILIO_FROM_NUMBER", "")
    if twilio_sid and twilio_from:
        services.append({"name": "Twilio (SMS)", "status": "ok", "detail": f"SID={twilio_sid[:8]}… From={twilio_from}"})
    else:
        services.append({"name": "Twilio (SMS)", "status": "error", "detail": "Variables manquantes"})
    # SendGrid
    sg_key = _os.getenv("SENDGRID_API_KEY", "")
    sg_from = _os.getenv("SENDGRID_FROM_EMAIL", "")
    if sg_key:
        services.append({"name": "SendGrid (Email)", "status": "ok", "detail": f"From={sg_from}"})
    else:
        services.append({"name": "SendGrid (Email)", "status": "error", "detail": "SENDGRID_API_KEY manquant"})
    # Stripe
    stripe_key = _os.getenv("STRIPE_API_KEY", "")
    if stripe_key:
        services.append({"name": "Stripe (Paiement)", "status": "ok", "detail": f"Key={stripe_key[:8]}…"})
    else:
        services.append({"name": "Stripe (Paiement)", "status": "warning", "detail": "Non configuré"})
    # PayPal
    pp_id = _os.getenv("PAYPAL_CLIENT_ID", "")
    if pp_id:
        services.append({"name": "PayPal", "status": "ok", "detail": f"Client ID={pp_id[:8]}…"})
    else:
        services.append({"name": "PayPal", "status": "warning", "detail": "Non configuré"})
    ctx = _panel_base_ctx(
        request, "admin", admin, section="services", section_title="Statut des services",
        services=services,
    )
    return templates.TemplateResponse("panels/admin.html", ctx)


# ── Export CSV ──────────────────────────────────────────────────────────────
@router.get("/web/admin/export/{entity}")
async def admin_export_csv(request: Request, entity: str):
    admin = await _resolve_session("admin", request)
    if not admin:
        return _login_page(request, "admin")
    import csv
    import io
    from fastapi.responses import StreamingResponse
    output = io.StringIO()
    writer = csv.writer(output)
    if entity == "users":
        writer.writerow(["ID", "Nom", "Email", "Téléphone", "Rôle", "KYC Tier", "KYC Statut", "Suspendu", "Créé"])
        async for u in db.users.find({}, {"_id": 0, "password_hash": 0, "pin_hash": 0, "biometric_token": 0}).sort("created_at", -1):
            writer.writerow([u.get("id", ""), u.get("full_name", ""), u.get("email", ""), u.get("phone", ""), u.get("role", "user"), u.get("kyc_tier", 0), u.get("kyc_status", "none"), u.get("suspended", False), (u.get("created_at") or "")[:10]])
    elif entity == "transfers":
        writer.writerow(["ID", "Expéditeur", "Bénéficiaire", "Destination", "Montant", "Devise", "Statut", "Date"])
        async for t in db.transfers.find({}, {"_id": 0}).sort("created_at", -1):
            ben = (t.get("beneficiary") or {})
            writer.writerow([t.get("id", ""), t.get("sender_name", ""), ben.get("full_name", ben.get("name", "")), t.get("destination_country", ""), t.get("send_amount", 0), t.get("send_currency", "EUR"), t.get("status", ""), (t.get("created_at") or "")[:16]])
    elif entity == "agents":
        writer.writerow(["ID", "Nom", "Email", "Pays", "Ville", "Statut", "Tier", "Note", "Transferts", "Disponible"])
        async for a in db.agents.find({}, {"_id": 0}).sort("created_at", -1):
            writer.writerow([a.get("id", ""), a.get("full_name", ""), a.get("email", ""), a.get("country", ""), a.get("city", ""), a.get("status", ""), a.get("tier", ""), a.get("rating", 0), a.get("transfers_count", 0), a.get("available", False)])
    else:
        return RedirectResponse(url=f"{_url_prefix(request)}/admin", status_code=303)
    output.seek(0)
    headers = {"Content-Disposition": f"attachment; filename={entity}_export.csv"}
    return StreamingResponse(iter([output.getvalue()]), media_type="text/csv", headers=headers)


@router.get("/web/admin/users/{user_id}/statement")
async def admin_user_statement(request: Request, user_id: str):
    """Export CSV du relevé de transactions d'un client spécifique."""
    admin = await _resolve_session("admin", request)
    if not admin:
        return _login_page(request, "admin")
    target = await db.users.find_one({"id": user_id}, {"_id": 0, "email": 1, "full_name": 1, "phone": 1})
    if not target:
        return RedirectResponse(url=f"{_url_prefix(request)}/admin/users", status_code=303)
    import csv
    import io
    from fastapi.responses import StreamingResponse
    output = io.StringIO()
    writer = csv.writer(output)
    # Header
    writer.writerow([f"Relevé de transactions — {target.get('full_name') or target.get('email', user_id)}"])
    writer.writerow([f"Date export: {iso(now_utc())}"])
    writer.writerow([])
    # Section 1: Transferts
    writer.writerow(["=== TRANSFERTS ==="])
    writer.writerow(["ID", "Date", "Bénéficiaire", "Destination", "Montant envoyé", "Devise", "Frais", "Statut", "Agent"])
    async for t in db.transfers.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1):
        ben = (t.get("beneficiary") or {})
        agent_name = ""
        if t.get("winning_agent_id"):
            ag = await db.agents.find_one({"id": t["winning_agent_id"]}, {"_id": 0, "full_name": 1})
            agent_name = (ag or {}).get("full_name", "")
        writer.writerow([
            t.get("id", "")[:12],
            (t.get("created_at") or "")[:16].replace("T", " "),
            ben.get("full_name", ben.get("name", "")),
            f"{t.get('destination_country', '')} {t.get('destination_city', '')}",
            t.get("send_amount", 0),
            t.get("send_currency", "EUR"),
            t.get("fee_amount", 0),
            t.get("status", ""),
            agent_name,
        ])
    writer.writerow([])
    # Section 2: Transactions wallet
    writer.writerow(["=== TRANSACTIONS WALLET ==="])
    writer.writerow(["ID", "Date", "Type", "Montant", "Devise", "Note"])
    async for w in db.wallet_tx.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1):
        writer.writerow([
            w.get("id", "")[:12],
            (w.get("created_at") or "")[:16].replace("T", " "),
            w.get("type", ""),
            w.get("amount", 0),
            w.get("currency", "EUR"),
            w.get("note", ""),
        ])
    writer.writerow([])
    # Section 3: Comptes liés
    writer.writerow(["=== COMPTES LIÉS ==="])
    writer.writerow(["Type", "Banque/Opérateur", "Identifiant", "Pays", "Statut", "Date"])
    async for la in db.linked_accounts.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1):
        writer.writerow([
            la.get("type", ""),
            la.get("bank_name", la.get("operator", "")),
            la.get("identifier", ""),
            la.get("country", ""),
            la.get("status", ""),
            (la.get("created_at") or "")[:10],
        ])
    output.seek(0)
    safe_name = (target.get("full_name") or target.get("email", user_id)).replace(" ", "_").replace("/", "_")
    headers = {"Content-Disposition": f"attachment; filename=releve_{safe_name}.csv"}
    return StreamingResponse(iter([output.getvalue()]), media_type="text/csv", headers=headers)
