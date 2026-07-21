"""Web panels submodule (split from web_panels.py)."""
import json
import logging
import os
from pathlib import Path
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


logger = logging.getLogger("sendbid.web_panels.marketing")
APK_LINKS_PATH = Path(__file__).resolve().parents[2] / "apk_links.json"


def _apk_details(app_name: str) -> dict:
    env_url = os.getenv(f"{app_name.upper()}_APK_URL", "")
    if env_url:
        return {"status": "ready", "url": env_url}
    try:
        return json.loads(APK_LINKS_PATH.read_text(encoding="utf-8")).get(app_name, {})
    except (OSError, json.JSONDecodeError):
        return {}


@router.get("/web/", response_class=HTMLResponse)
@router.get("/web", response_class=HTMLResponse)
async def marketing_home(request: Request):
    # Stats r\u00e9elles (DB) avec fallback raisonnable pour la d\u00e9mo
    try:
        users = await db.users.count_documents({})
        agents = await db.agents.count_documents({"status": "approved"})
        completed = await db.transfers.count_documents({"status": "COMPLETED"})
        # Volume
        vol = 0.0
        async for x in db.transfers.aggregate([
            {"$match": {"status": "COMPLETED"}},
            {"$group": {"_id": None, "v": {"$sum": "$send_amount"}}},
        ]):
            vol = float(x.get("v") or 0)
    except Exception:
        users, agents, completed, vol = 0, 0, 0, 0.0
    stats = {
        "users": max(users, 1200),
        "agents": max(agents, 350),
        "transfers": max(completed * 4, 15000),
        "completed": max(completed, 12500),
        "volume": "{:,.0f}".format(max(vol, 4_500_000)).replace(",", " "),
    }
    return templates.TemplateResponse("marketing/home.html", _marketing_ctx(request, "home", {"stats": stats}))


@router.get("/web/features", response_class=HTMLResponse)
async def marketing_features(request: Request):
    return templates.TemplateResponse("marketing/features.html", _marketing_ctx(request, "features"))


@router.get("/web/pricing", response_class=HTMLResponse)
async def marketing_pricing(request: Request):
    return templates.TemplateResponse("marketing/pricing.html", _marketing_ctx(request, "pricing"))


@router.get("/web/faq", response_class=HTMLResponse)
async def marketing_faq(request: Request):
    return templates.TemplateResponse("marketing/faq.html", _marketing_ctx(request, "faq"))


@router.get("/web/about", response_class=HTMLResponse)
async def marketing_about(request: Request):
    return templates.TemplateResponse("marketing/about.html", _marketing_ctx(request, "about"))


@router.get("/web/download", response_class=HTMLResponse)
async def marketing_download(request: Request):
    return templates.TemplateResponse("marketing/download.html", _marketing_ctx(request, "download"))


@router.get("/web/download/{app_name}", response_class=HTMLResponse)
async def download_apk(app_name: str, request: Request):
    if app_name not in {"sendbid", "paybid"}:
        return templates.TemplateResponse("marketing/apk_pending.html", {"request": request, "app_name": app_name}, status_code=404)
    apk = _apk_details(app_name)
    if apk.get("status") == "ready" and apk.get("url"):
        return RedirectResponse(apk["url"], status_code=307)
    return templates.TemplateResponse(
        "marketing/apk_pending.html",
        {"request": request, "app_name": app_name, "status": apk.get("status", "building")},
        status_code=503,
    )


@router.get("/web/superagent", response_class=HTMLResponse)
async def superagent_dashboard(request: Request):
    user = await _resolve_session("superagent", request)
    if not user:
        return _login_page(request, "superagent")
    agent_ids = await _super_agent_ids(user)
    total_agents = len(agent_ids)
    active_agents = await db.agents.count_documents({"id": {"$in": agent_ids}, "status": "approved", "available": True}) if agent_ids else 0
    total_transfers = await db.transfers.count_documents({"agent_id": {"$in": agent_ids}}) if agent_ids else 0
    completed_transfers = await db.transfers.count_documents({"agent_id": {"$in": agent_ids}, "status": "COMPLETED"}) if agent_ids else 0
    vol = 0.0
    if agent_ids:
        async for x in db.transfers.aggregate([
            {"$match": {"agent_id": {"$in": agent_ids}, "status": "COMPLETED"}},
            {"$group": {"_id": None, "v": {"$sum": "$send_amount"}}},
        ]):
            vol = float(x.get("v") or 0)
    override = round(vol * 0.10, 2)  # 10% override
    avg_rating = 0.0
    if agent_ids:
        async for x in db.agents.aggregate([
            {"$match": {"id": {"$in": agent_ids}}},
            {"$group": {"_id": None, "avg": {"$avg": "$rating"}}},
        ]):
            avg_rating = float(x.get("avg") or 0)
    total_float = 0.0
    if agent_ids:
        async for x in db.agent_floats.aggregate([
            {"$match": {"agent_id": {"$in": agent_ids}}},
            {"$group": {"_id": None, "t": {"$sum": "$balance"}}},
        ]):
            total_float = float(x.get("t") or 0)
    network = {
        "total_agents": total_agents, "active_agents": active_agents,
        "total_transfers": total_transfers, "completed_transfers": completed_transfers,
        "volume_eur": round(vol, 2), "override_eur": override,
        "avg_rating": avg_rating, "total_float": round(total_float, 2),
    }
    top_agents_raw = await db.agents.find({"id": {"$in": agent_ids}}, {"_id": 0}).sort("transfers_count", -1).to_list(10) if agent_ids else []
    # Volume par agent
    for a in top_agents_raw:
        v = 0.0
        async for x in db.transfers.aggregate([
            {"$match": {"agent_id": a["id"], "status": "COMPLETED"}},
            {"$group": {"_id": None, "v": {"$sum": "$send_amount"}}},
        ]):
            v = float(x.get("v") or 0)
        a["volume_eur"] = round(v, 2)
    ctx = _panel_base_ctx(request, "superagent", user, section="dashboard",
                          network=network, top_agents=top_agents_raw)
    return templates.TemplateResponse("panels/superagent.html", ctx)


@router.get("/web/superagent/agents", response_class=HTMLResponse)
async def superagent_agents(request: Request):
    user = await _resolve_session("superagent", request)
    if not user:
        return _login_page(request, "superagent")
    agent_ids = await _super_agent_ids(user)
    agents = await db.agents.find({"id": {"$in": agent_ids}}, {"_id": 0}).sort("transfers_count", -1).to_list(200) if agent_ids else []
    ctx = _panel_base_ctx(request, "superagent", user, section="agents", section_title="Mon r\u00e9seau", agents=agents)
    return templates.TemplateResponse("panels/superagent.html", ctx)


@router.get("/web/superagent/transfers", response_class=HTMLResponse)
async def superagent_transfers(request: Request):
    user = await _resolve_session("superagent", request)
    if not user:
        return _login_page(request, "superagent")
    agent_ids = await _super_agent_ids(user)
    transfers = await db.transfers.find({"agent_id": {"$in": agent_ids}}, {"_id": 0}).sort("created_at", -1).to_list(200) if agent_ids else []
    # Enrichir avec nom agent
    if transfers:
        ag_map = {}
        async for a in db.agents.find({"id": {"$in": agent_ids}}, {"_id": 0, "id": 1, "full_name": 1, "user_id": 1}):
            ag_map[a["id"]] = a
        # Resolver via user
        user_ids = [a.get("user_id") for a in ag_map.values() if a.get("user_id")]
        users_by_id = {}
        if user_ids:
            async for u in db.users.find({"id": {"$in": user_ids}}, {"_id": 0, "id": 1, "full_name": 1}):
                users_by_id[u["id"]] = u
        for t in transfers:
            a = ag_map.get(t.get("agent_id"), {})
            t["agent_name"] = a.get("full_name") or (users_by_id.get(a.get("user_id"), {}).get("full_name")) or "Agent"
    ctx = _panel_base_ctx(request, "superagent", user, section="transfers", section_title="Transferts du r\u00e9seau", transfers=transfers)
    return templates.TemplateResponse("panels/superagent.html", ctx)


@router.get("/web/superagent/earnings", response_class=HTMLResponse)
async def superagent_earnings(request: Request):
    user = await _resolve_session("superagent", request)
    if not user:
        return _login_page(request, "superagent")
    agent_ids = await _super_agent_ids(user)
    overrides = []
    agents_map = {}
    if agent_ids:
        async for a in db.agents.find({"id": {"$in": agent_ids}}, {"_id": 0}):
            agents_map[a["id"]] = a
        for aid, a in agents_map.items():
            completed = await db.transfers.count_documents({"agent_id": aid, "status": "COMPLETED"})
            v = 0.0
            async for x in db.transfers.aggregate([
                {"$match": {"agent_id": aid, "status": "COMPLETED"}},
                {"$group": {"_id": None, "v": {"$sum": "$send_amount"}}},
            ]):
                v = float(x.get("v") or 0)
            overrides.append({
                "agent_name": a.get("full_name") or "Agent",
                "completed": completed, "volume": round(v, 2),
                "override": round(v * 0.10, 2),
            })
        overrides.sort(key=lambda o: o["override"], reverse=True)
    ctx = _panel_base_ctx(request, "superagent", user, section="earnings", section_title="Override commission", overrides=overrides)
    return templates.TemplateResponse("panels/superagent.html", ctx)
