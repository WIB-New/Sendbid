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


logger = logging.getLogger("sendbid.web_panels.agent_admin")


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
