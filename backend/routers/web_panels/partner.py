"""Web panels submodule (split from web_panels.py)."""
import logging

from fastapi import Request
from fastapi.responses import HTMLResponse, RedirectResponse

from core.db import db

from . import router, templates
from .utils import (
    _url_prefix, _resolve_session, _panel_base_ctx, _login_page, _admin_kpis,
)


logger = logging.getLogger("sendbid.web_panels.partner")


@router.get("/web/partner", response_class=HTMLResponse)
async def partner_dashboard(request: Request):
    user = await _resolve_session("partner", request)
    if not user:
        return _login_page(request, "partner")
    # KPIs limités au périmètre partenaire (V1 : mêmes KPIs)
    kpis = await _admin_kpis()
    recent_transfers = await db.transfers.find({}, {"_id": 0}).sort("created_at", -1).to_list(10)
    recent_agents = await db.agents.find({}, {"_id": 0}).sort("created_at", -1).to_list(8)
    ctx = _panel_base_ctx(request, "partner", user, section="dashboard",
                          kpis=kpis, recent_transfers=recent_transfers, recent_agents=recent_agents,
                          sidebar_role_path="partner")
    return templates.TemplateResponse("panels/admin.html", ctx)


# All other partner routes redirect to the equivalent admin route.
# This works because auth_panel.py sets both cookies when a partner_admin logs in.
@router.get("/web/partner/{path:path}", response_class=HTMLResponse)
async def partner_catch_all(request: Request, path: str):
    user = await _resolve_session("partner", request)
    if not user:
        return _login_page(request, "partner")
    prefix = _url_prefix(request)
    return RedirectResponse(url=f"{prefix}/admin/{path}", status_code=303)


@router.post("/web/partner/{path:path}", response_class=HTMLResponse)
async def partner_catch_all_post(request: Request, path: str):
    user = await _resolve_session("partner", request)
    if not user:
        return _login_page(request, "partner")
    prefix = _url_prefix(request)
    return RedirectResponse(url=f"{prefix}/admin/{path}", status_code=307)
