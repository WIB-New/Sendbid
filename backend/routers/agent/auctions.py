"""Agent operations module."""
import asyncio
import logging
from datetime import datetime, timedelta
from typing import Optional

from fastapi import Depends, HTTPException
from pydantic import BaseModel

from core.db import db, now_utc, iso, clean_doc
from core.deps import get_current_user
from core.manager import manager
from core.security import gen_id
from routers.notifications import create_notification

from . import router
from .core import _require_agent
from .models import AgentSignupIn, BidIn, CompleteIn


@router.get("/auctions")
async def list_auctions(user: dict = Depends(get_current_user), only_same_city: bool = False):
    agent = await _require_agent(user)
    q: dict = {"status": "BIDDING"}
    auctions = await db.transfers.find(q, {"_id": 0}).sort("created_at", -1).to_list(50)
    city = (agent.get("city") or "").lower()
    for a in auctions:
        a_city = (a.get("destination_city") or a.get("beneficiary", {}).get("city") or "").lower()
        a["same_city"] = a_city == city
    if only_same_city:
        auctions = [a for a in auctions if a["same_city"]]
    # Compute remaining time per round (best-effort)
    return auctions




@router.post("/auctions/{transfer_id}/bid")
async def place_bid(transfer_id: str, payload: BidIn, user: dict = Depends(get_current_user)):
    agent = await _require_agent(user)
    transfer = await db.transfers.find_one({"id": transfer_id}, {"_id": 0})
    if not transfer:
        raise HTTPException(status_code=404, detail="Transfert introuvable")
    if transfer.get("status") != "BIDDING":
        raise HTTPException(status_code=409, detail=f"Transfert non disponible (statut: {transfer.get('status')})")
    if transfer.get("agent_id"):
        raise HTTPException(status_code=409, detail="Un agent a déjà été assigné")
    # STRICT — Refuser tout agent dont le pays diffère du pays destination du transfert
    target_country = (transfer.get("destination_country") or "").upper()
    agent_country = (agent.get("country_code") or agent.get("country") or "").upper()
    if target_country and agent_country and agent_country != target_country:
        raise HTTPException(
            status_code=403,
            detail=f"Vous ne pouvez enchérir que sur des transferts vers votre pays ({agent_country}).",
        )
    fee_min = max(0.5, transfer.get("fee_percent", 2.0) - 1.5)
    fee_max = transfer.get("fee_percent", 2.0)
    # Spec v6.4 : Les agents ne peuvent QUE baisser. Aucune offre >= au taux de l'expéditeur.
    if payload.bid_fee_percent >= fee_max:
        raise HTTPException(
            status_code=400,
            detail=f"Offre invalide : votre proposition doit être strictement inférieure à {fee_max:.2f}% (frais fixés par l'expéditeur).",
        )
    if payload.bid_fee_percent < fee_min:
        raise HTTPException(status_code=400, detail=f"Frais minimum : {fee_min:.2f}%")
    # DESCENDING-ONLY auction: each new bid must be strictly lower than the
    # current lowest bid on this transfer, AND lower than the agent's own
    # previous bid (if any). This prevents agents from raising the price.
    current_best = await db.bids.find_one(
        {"transfer_id": transfer_id},
        sort=[("bid_fee_percent", 1)],
    )
    if current_best and payload.bid_fee_percent >= float(current_best.get("bid_fee_percent", 99)):
        raise HTTPException(
            status_code=400,
            detail=f"Enchère descendante : votre offre doit être strictement inférieure à {float(current_best['bid_fee_percent']):.2f}%",
        )
    last_own = await db.bids.find_one(
        {"transfer_id": transfer_id, "agent_id": agent["id"]},
        sort=[("created_at", -1)],
    )
    if last_own and payload.bid_fee_percent >= float(last_own.get("bid_fee_percent", 99)):
        raise HTTPException(
            status_code=400,
            detail=f"Vous devez baisser votre offre par rapport à votre dernière enchère ({float(last_own['bid_fee_percent']):.2f}%)",
        )
    target_city = (transfer.get("destination_city") or transfer.get("beneficiary", {}).get("city") or "").lower()
    same_city = (agent.get("city") or "").lower() == target_city
    bid = {
        "id": gen_id(), "transfer_id": transfer_id,
        "round": transfer.get("auction_round", 1),
        "agent_id": agent["id"], "agent_name": agent["full_name"],
        "agent_avatar": agent.get("avatar_url"),
        "agent_rating": agent.get("rating", 4.5),
        "agent_city": agent.get("city"),
        "same_city": same_city,
        "agent_distance_km": 1.0 if same_city else 25.0,
        "bid_fee_percent": round(payload.bid_fee_percent, 2),
        "eta_minutes": payload.eta_minutes,
        "manual": True,
        "created_at": iso(now_utc()),
    }
    await db.bids.insert_one(dict(bid))
    await manager.broadcast(transfer_id, {"event": "new_bid", "bid": clean_doc(dict(bid))})

    # Notifier individuellement l'agent précédemment en tête qu'il est surclassé
    previous_best = await db.bids.find_one(
        {"transfer_id": transfer_id, "agent_id": {"$ne": agent["id"]}},
        sort=[("bid_fee_percent", 1)],
    )
    if previous_best and float(previous_best.get("bid_fee_percent", 99)) > payload.bid_fee_percent:
        outbid_agent_id = previous_best.get("agent_id")
        if outbid_agent_id:
            try:
                await manager.broadcast_agents({
                    "event": "outbid",
                    "transfer_id": transfer_id,
                    "your_bid": float(previous_best.get("bid_fee_percent", 0)),
                    "new_best": round(payload.bid_fee_percent, 2),
                    "message": f"Un autre agent a proposé {payload.bid_fee_percent:.2f}% — vous êtes surclassé. Proposez moins pour reprendre la tête.",
                }, agent_ids=[outbid_agent_id])
            except Exception:
                pass

    # Calculate commission breakdown for the agent UI confirmation
    company_commission_pct = 20.0  # company keeps 20% of agent's bid fee
    client_fee_amount = round(transfer.get("send_amount", 0) * payload.bid_fee_percent / 100, 2)
    company_share = round(client_fee_amount * company_commission_pct / 100, 2)
    agent_net = round(client_fee_amount - company_share, 2)
    return {
        "ok": True,
        "bid": clean_doc(dict(bid)),
        "commission": {
            "client_fee_pct": payload.bid_fee_percent,
            "client_fee_amount": client_fee_amount,
            "company_commission_pct": company_commission_pct,
            "company_share": company_share,
            "agent_net": agent_net,
            "currency": "EUR",
            "message": (
                f"Offre acceptée — Commission de l'entreprise : {company_share:.2f}€ (20%). "
                f"Votre gain net : {agent_net:.2f}€ si vous êtes sélectionné."
            ),
        },
    }

