"""Admin router — v6. Read-only + moderation endpoints pour les panels admin web.

Rôles :
- super_admin : accès complet (agents, transferts, users, reconciliation, KPIs)
- admin : gestion agents + transferts (pas de users bancaires)
- partner_admin : lecture seule sur son propre réseau
- agent_admin : lecture seule sur son équipe (super_agent dashboard)
"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from core.db import db, now_utc, iso
from core.deps import get_current_user

router = APIRouter(prefix="/admin", tags=["admin"])


ADMIN_ROLES = {"super_admin", "admin", "partner_admin", "agent_admin"}


async def _require_admin(user: dict, min_role: str = "admin") -> dict:
    role = user.get("role", "")
    if role not in ADMIN_ROLES:
        # Support via le champ user.admin_role si défini
        role = user.get("admin_role", "")
    if role not in ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Accès réservé aux administrateurs")
    return user


@router.get("/kpis")
async def admin_kpis(user: dict = Depends(get_current_user)):
    await _require_admin(user)
    role = user.get("role", "")

    # Filtre de scope : partner_admin restreint à sa zone (champ user.zone = code ISO pays
    # ou nom de région). Si zone absente → vue globale (fallback).
    scope_transfers: dict = {}
    scope_agents: dict = {}
    scope_users: dict = {}
    if role == "partner_admin":
        zone = user.get("zone") or user.get("partner_zone")
        if zone:
            scope_transfers["destination_country"] = zone
            scope_agents["country"] = zone
    elif role == "agent_admin":
        # Super-agent : ne voit que son réseau (agents dont parent_agent_id = user.id)
        scope_agents["parent_agent_id"] = user["id"]
        # Pour les transferts : on filtre par agent_id dans son réseau
        own_agent_ids = [a["id"] async for a in db.agents.find({"parent_agent_id": user["id"]}, {"id": 1})]
        if own_agent_ids:
            scope_transfers["winning_agent_id"] = {"$in": own_agent_ids}

    total_users = await db.users.count_documents(scope_users)
    total_agents = await db.agents.count_documents(scope_agents)
    active_agents = await db.agents.count_documents({**scope_agents, "status": "approved", "available": True})
    pending_agents = await db.agents.count_documents({**scope_agents, "status": "pending_verification"})
    total_transfers = await db.transfers.count_documents(scope_transfers)
    completed_transfers = await db.transfers.count_documents({**scope_transfers, "status": "COMPLETED"})
    in_progress = await db.transfers.count_documents({**scope_transfers, "status": {"$in": ["BIDDING", "AGENT_ASSIGNED", "PROCESSING"]}})
    # Volume EUR agrégé — respect du scope
    match_vol: dict = {**scope_transfers, "status": "COMPLETED"}
    pipeline = [{"$match": match_vol}, {"$group": {"_id": None, "vol": {"$sum": "$send_amount"}}}]
    vol = 0.0
    async for x in db.transfers.aggregate(pipeline):
        vol = float(x.get("vol") or 0)
    # Float total déclaré — respecte le scope agents pour super-agent/partner
    total_float = 0.0
    float_match: dict = {}
    if scope_agents.get("parent_agent_id"):
        agent_ids = [a["id"] async for a in db.agents.find(scope_agents, {"id": 1})]
        if agent_ids:
            float_match["agent_id"] = {"$in": agent_ids}
    float_pipeline = [{"$match": float_match}, {"$group": {"_id": "$currency", "total": {"$sum": "$balance"}}}] if float_match else [{"$group": {"_id": "$currency", "total": {"$sum": "$balance"}}}]
    async for x in db.agent_floats.aggregate(float_pipeline):
        total_float += float(x.get("total") or 0)
    return {
        "users": {"total": total_users},
        "agents": {"total": total_agents, "active": active_agents, "pending": pending_agents},
        "transfers": {"total": total_transfers, "completed": completed_transfers, "in_progress": in_progress, "volume_eur": round(vol, 2)},
        "float": {"total_declared": total_float},
        "scope": {"role": role, "filtered": bool(scope_transfers or scope_agents)},
    }


@router.get("/agents")
async def list_agents(
    user: dict = Depends(get_current_user),
    status: Optional[str] = None,
    agent_type: Optional[str] = None,
    limit: int = 100,
):
    await _require_admin(user)
    q: dict = {}
    if status: q["status"] = status
    if agent_type: q["agent_type"] = agent_type
    items = await db.agents.find(q, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return {"items": items, "count": len(items)}


class AgentModerationIn(BaseModel):
    agent_id: str
    action: str  # approve | reject | suspend | reactivate
    reason: Optional[str] = None


@router.post("/agents/moderate")
async def moderate_agent(payload: AgentModerationIn, user: dict = Depends(get_current_user)):
    await _require_admin(user)
    status_map = {
        "approve": "approved", "reject": "rejected",
        "suspend": "suspended", "reactivate": "approved",
    }
    new_status = status_map.get(payload.action)
    if not new_status:
        raise HTTPException(status_code=400, detail="Action inconnue")
    upd = await db.agents.update_one(
        {"id": payload.agent_id},
        {"$set": {
            "status": new_status,
            "moderated_at": iso(now_utc()),
            "moderated_by": user.get("id"),
            "moderation_reason": payload.reason,
        }},
    )
    if upd.matched_count == 0:
        raise HTTPException(status_code=404, detail="Agent introuvable")
    return {"ok": True, "status": new_status}


@router.get("/transfers")
async def list_transfers(
    user: dict = Depends(get_current_user),
    status: Optional[str] = None,
    limit: int = 50,
):
    await _require_admin(user)
    q: dict = {}
    if status: q["status"] = status
    items = await db.transfers.find(q, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return {"items": items, "count": len(items)}


@router.get("/reconciliation")
async def reconciliation(user: dict = Depends(get_current_user)):
    await _require_admin(user)
    # Mouvements float des 30 derniers jours
    cutoff = iso(now_utc())
    agg = []
    async for x in db.agent_float_movements.aggregate([
        {"$group": {
            "_id": {"type": "$type", "currency": "$currency"},
            "total": {"$sum": "$amount_signed"},
            "count": {"$sum": 1},
        }},
    ]):
        agg.append({"type": x["_id"]["type"], "currency": x["_id"]["currency"], "total": x["total"], "count": x["count"]})
    return {"movements": agg}


@router.get("/users")
async def list_users(
    user: dict = Depends(get_current_user),
    search: Optional[str] = None,
    limit: int = 50,
):
    await _require_admin(user)
    q: dict = {}
    if search:
        q["$or"] = [
            {"email": {"$regex": search, "$options": "i"}},
            {"full_name": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search}},
        ]
    items = await db.users.find(q, {"_id": 0, "password_hash": 0, "pin_hash": 0, "biometric_token": 0}).sort("created_at", -1).to_list(limit)
    return {"items": items, "count": len(items)}
