"""Web panels submodule (split from web_panels.py)."""
import logging
from typing import Optional

from fastapi import Request, Form
from fastapi.responses import HTMLResponse, RedirectResponse

from core.db import db, now_utc, iso, clean_doc
from core.security import verify_password, create_access_token

from . import router, templates
from .utils import (
    _safe_date, _current_year, _url_prefix, _u, _marketing_ctx,
    _resolve_session, _panel_base_ctx, _login_page, _admin_kpis,
)


logger = logging.getLogger("sendbid.web_panels.auth_panel")


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
    prefix = _url_prefix(request)
    resp = RedirectResponse(url=f"{prefix}/{role}", status_code=303)
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
async def panel_logout(role: str, request: Request):
    if role not in ALLOWED_ROLES_BY_PANEL:
        raise HTTPException(404)
    prefix = _url_prefix(request)
    resp = RedirectResponse(url=f"{prefix}/{role}" or f"/{role}", status_code=303)
    resp.delete_cookie(COOKIE_PREFIX + role, path="/")
    return resp
