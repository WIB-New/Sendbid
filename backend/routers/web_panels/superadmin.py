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


logger = logging.getLogger("sendbid.web_panels.superadmin")


@router.get("/web/superadmin", response_class=HTMLResponse)
async def superadmin_dashboard(request: Request):
    user = await _resolve_session("superadmin", request)
    if not user:
        return _login_page(request, "superadmin")
    kpis = await _admin_kpis()
    recent_transfers = await db.transfers.find({}, {"_id": 0}).sort("created_at", -1).to_list(10)
    recent_agents = await db.agents.find({}, {"_id": 0}).sort("created_at", -1).to_list(8)
    # Réutilise le template admin.html mais avec couleurs superadmin (moutarde)
    ctx = _panel_base_ctx(request, "superadmin", user, section="dashboard",
                          kpis=kpis, recent_transfers=recent_transfers, recent_agents=recent_agents)
    # Surcharge le template pour pointer vers /admin/* dans la sidebar
    ctx["sidebar_role_path"] = "superadmin"
    return templates.TemplateResponse("panels/admin.html", ctx)
