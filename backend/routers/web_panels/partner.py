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
                          kpis=kpis, recent_transfers=recent_transfers, recent_agents=recent_agents)
    ctx["sidebar_role_path"] = "partner"
    return templates.TemplateResponse("panels/admin.html", ctx)
