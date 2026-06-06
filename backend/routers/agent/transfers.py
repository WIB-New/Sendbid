"""Agent operations module."""
import asyncio
import logging
from datetime import datetime, timedelta
from typing import Optional

from fastapi import Depends, HTTPException
from pydantic import BaseModel

from core.db import db, now_utc, iso, clean_doc
from core.deps import get_current_user
from core.security import gen_id
from routers.notifications import create_notification

from . import router
from .core import _require_agent
from .models import AgentSignupIn, BidIn, CompleteIn


@router.get("/transfers")
async def list_my_transfers(user: dict = Depends(get_current_user), status: Optional[str] = None):
    agent = await _require_agent(user)
    q: dict = {"agent_id": agent["id"]}
    if status:
        q["status"] = status
    return await db.transfers.find(q, {"_id": 0}).sort("created_at", -1).to_list(100)


@router.post("/transfers/{transfer_id}/start")
async def start_pickup(transfer_id: str, user: dict = Depends(get_current_user)):
    agent = await _require_agent(user)
    t = await db.transfers.find_one({"id": transfer_id, "agent_id": agent["id"]}, {"_id": 0})
    if not t:
        raise HTTPException(status_code=404, detail="Transfert introuvable")
    new_status = "VIP_DELIVERY" if t.get("vip_delivery") else "READY_FOR_PICKUP"
    await db.transfers.update_one(
        {"id": transfer_id},
        {"$set": {"status": new_status, "processing_at": iso(now_utc())}},
    )
    await manager.broadcast(transfer_id, {"event": "agent_started", "status": new_status})
    return {"ok": True, "status": new_status}




@router.post("/transfers/{transfer_id}/complete")
async def complete_transfer(transfer_id: str, payload: CompleteIn, user: dict = Depends(get_current_user)):
    agent = await _require_agent(user)
    t = await db.transfers.find_one({"id": transfer_id, "agent_id": agent["id"]}, {"_id": 0})
    if not t:
        raise HTTPException(status_code=404, detail="Transfert introuvable")
    if t.get("status") not in {"AGENT_ASSIGNED", "PROCESSING", "READY_FOR_PICKUP", "VIP_DELIVERY"}:
        raise HTTPException(status_code=409, detail=f"Statut invalide: {t.get('status')}")
    code = (payload.code or "").strip()
    if code != t.get("withdrawal_code") and code != t.get("qr_token"):
        raise HTTPException(status_code=400, detail="Code invalide")
    await db.transfers.update_one(
        {"id": transfer_id},
        {"$set": {"status": "COMPLETED", "completed_at": iso(now_utc())}},
    )
    # v6 — Débit du cash_float agent en devise locale (espèces remises au bénéficiaire)
    from routers.agent_float import debit_agent_float_for_transfer
    ok, msg = await debit_agent_float_for_transfer(agent["id"], t)
    if not ok:
        # Rollback du statut si float insuffisant (cas edge — agent aurait dû vérifier)
        await db.transfers.update_one(
            {"id": transfer_id},
            {"$set": {"status": "AGENT_ASSIGNED"}, "$unset": {"completed_at": ""}},
        )
        raise HTTPException(status_code=400, detail=msg)
    # Credit agent earnings
    fee_pct = (t.get("selected_bid") or {}).get("bid_fee_percent", 0)
    earned = round((fee_pct / 100.0) * t.get("send_amount", 0), 2)
    await db.wallets.update_one({"user_id": user["id"]}, {"$inc": {"balance": earned}})
    await db.wallet_tx.insert_one({
        "id": gen_id(), "user_id": user["id"], "type": "agent_earnings",
        "amount": earned, "currency": "EUR",
        "counterparty": t.get("beneficiary", {}).get("full_name", "Bénéficiaire"),
        "note": f"Commission transfert {transfer_id[:8].upper()}",
        "transfer_id": transfer_id,
        "method": "transfer",
        "status": "completed",
        "created_at": iso(now_utc()),
    })
    # Bump rating count
    await db.agents.update_one({"id": agent["id"]}, {"$inc": {"transfers_count": 1}})
    await manager.broadcast(transfer_id, {"event": "completed"})
    return {"ok": True, "earned_eur": earned}

