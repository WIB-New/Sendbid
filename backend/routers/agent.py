"""
PAYBID — Agent-facing API.
All endpoints expect an authenticated user with role="agent".
"""
from typing import Optional, List
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from core.db import db, now_utc, iso, clean_doc
from core.deps import get_current_user
from core.security import gen_id, hash_password
from core.manager import manager

router = APIRouter(prefix="/agent", tags=["agent"])


class AgentSignupIn(BaseModel):
    full_name: str
    email: str
    phone: str
    city: str
    country: str
    password: str
    # v6 — PAYBID acteurs métiers : personnes morales
    agent_type: str = "own"  # own (agent propre) | partner (partenaire) | super_agent
    parent_agent_id: Optional[str] = None  # pour les sub-agents rattachés à un super-agent
    legal_name: Optional[str] = None
    registration_number: Optional[str] = None  # SIRET/RCS
    float_currency: str = "XOF"


@router.post("/signup")
async def agent_signup(payload: AgentSignupIn):
    email = payload.email.lower().strip()
    phone = payload.phone.strip()
    if len(payload.password) < 8:
        raise HTTPException(status_code=400, detail="Mot de passe trop court (min 8 caractères)")
    if await db.users.find_one({"$or": [{"email": email}, {"phone": phone}]}):
        raise HTTPException(status_code=400, detail="Email ou téléphone déjà utilisé")
    user_id = gen_id()
    agent_id = gen_id()
    import random
    profile_id = f"PB{random.randint(100000, 999999)}"
    user = {
        "id": user_id, "profile_id": profile_id, "email": email, "phone": phone,
        "full_name": payload.full_name, "password_hash": hash_password(payload.password),
        "pin_hash": None, "pin_attempts": 0, "pin_locked_until": None,
        "email_verified": True, "phone_verified": True,
        "kyc_tier": 0, "kyc_status": "pending",
        "loyalty_level": "Bronze", "loyalty_points": 0,
        "biometric_enabled": False, "biometric_token": None,
        "avatar_url": None, "language": "fr", "theme": "light",
        "notif_prefs": {"push": True, "email": True, "sms": True},
        "role": "agent", "agent_id": agent_id,
        "created_at": iso(now_utc()),
    }
    await db.users.insert_one(user)
    await db.agents.insert_one({
        "id": agent_id, "user_id": user_id, "full_name": payload.full_name,
        "city": payload.city.strip(), "country": payload.country.strip().upper(),
        "available": False, "kyc_tier": 0, "rating": 0.0, "rating_count": 0,
        "total_transfers": 0, "total_earnings_eur": 0.0,
        "status": "pending_verification",
        # v6 — Hiérarchie & personne morale
        "agent_type": payload.agent_type if payload.agent_type in {"own", "partner", "super_agent"} else "own",
        "parent_agent_id": payload.parent_agent_id,
        "legal_name": payload.legal_name,
        "registration_number": payload.registration_number,
        "float_currency": payload.float_currency or "XOF",
        "created_at": iso(now_utc()),
    })
    # v6 — Cr\u00e9ation auto du float \u00e0 0
    await db.agent_floats.insert_one({
        "id": gen_id(), "agent_id": agent_id,
        "currency": payload.float_currency or "XOF",
        "balance": 0.0, "declared_at": None,
        "created_at": iso(now_utc()), "updated_at": iso(now_utc()),
    })
    await db.wallets.insert_one({
        "id": gen_id(), "user_id": user_id, "balance": 0.0, "currency": "EUR", "created_at": iso(now_utc())
    })
    return {"ok": True, "user_id": user_id, "agent_id": agent_id, "profile_id": profile_id, "role": "agent"}


async def _require_agent(user: dict) -> dict:
    if user.get("role") != "agent":
        raise HTTPException(status_code=403, detail="Réservé aux agents PAYBID")
    agent_id = user.get("agent_id")
    if not agent_id:
        raise HTTPException(status_code=409, detail="Profil agent introuvable")
    agent = await db.agents.find_one({"id": agent_id}, {"_id": 0})
    if not agent:
        raise HTTPException(status_code=404, detail="Profil agent introuvable")
    return agent


@router.get("/me")
async def agent_me(user: dict = Depends(get_current_user)):
    agent = await _require_agent(user)
    wallet = await db.wallets.find_one({"user_id": user["id"]}, {"_id": 0})
    return {"user": clean_doc(user), "agent": agent, "wallet": wallet}


@router.post("/availability")
async def set_availability(payload: dict, user: dict = Depends(get_current_user)):
    agent = await _require_agent(user)
    avail = bool(payload.get("available", True))
    await db.agents.update_one({"id": agent["id"]}, {"$set": {"available": avail}})
    return {"ok": True, "available": avail}


@router.get("/dashboard")
async def dashboard(user: dict = Depends(get_current_user)):
    agent = await _require_agent(user)
    today_start = now_utc().replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=7)

    # Active assigned transfers
    active = await db.transfers.find(
        {"agent_id": agent["id"], "status": {"$in": ["AGENT_ASSIGNED", "PROCESSING", "READY_FOR_PICKUP", "VIP_DELIVERY"]}},
        {"_id": 0},
    ).sort("created_at", -1).to_list(20)

    # Today completed
    today_done = await db.transfers.count_documents({
        "agent_id": agent["id"], "status": "COMPLETED",
        "completed_at": {"$gte": iso(today_start)},
    })
    week_done = await db.transfers.count_documents({
        "agent_id": agent["id"], "status": "COMPLETED",
        "completed_at": {"$gte": iso(week_start)},
    })

    # Pending auctions in agent's city (BIDDING transfers)
    pending = await db.transfers.find(
        {"status": "BIDDING"}, {"_id": 0}
    ).sort("created_at", -1).to_list(20)
    same_city_pending = [t for t in pending if (t.get("destination_city") or t.get("beneficiary", {}).get("city") or "").lower() == (agent.get("city") or "").lower()]

    # Earnings: sum of fees on completed transfers
    completed = await db.transfers.find(
        {"agent_id": agent["id"], "status": "COMPLETED"},
        {"_id": 0, "selected_bid": 1, "send_amount": 1, "completed_at": 1},
    ).to_list(500)
    total_earnings = round(sum(
        (t.get("selected_bid", {}).get("bid_fee_percent", 0) / 100.0) * (t.get("send_amount", 0))
        for t in completed
    ), 2)
    week_earnings = round(sum(
        (t.get("selected_bid", {}).get("bid_fee_percent", 0) / 100.0) * (t.get("send_amount", 0))
        for t in completed if (t.get("completed_at") or "") >= iso(week_start)
    ), 2)

    return {
        "agent": agent,
        "stats": {
            "today_completed": today_done,
            "week_completed": week_done,
            "active_count": len(active),
            "pending_auctions": len(pending),
            "same_city_auctions": len(same_city_pending),
            "rating": agent.get("rating", 0),
            "total_transfers": agent.get("transfers_count", 0),
            "total_earnings_eur": total_earnings,
            "week_earnings_eur": week_earnings,
        },
        "active_transfers": active[:5],
        "auctions_preview": same_city_pending[:5] if same_city_pending else pending[:3],
    }


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


class BidIn(BaseModel):
    transfer_id: str
    bid_fee_percent: float
    eta_minutes: int = 30


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


class CompleteIn(BaseModel):
    code: str  # withdrawal_code or qr_token


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


@router.get("/earnings")
async def earnings(user: dict = Depends(get_current_user), days: int = 30):
    agent = await _require_agent(user)
    since = now_utc() - timedelta(days=days)
    txs = await db.wallet_tx.find(
        {"user_id": user["id"], "type": "agent_earnings", "created_at": {"$gte": iso(since)}},
        {"_id": 0},
    ).sort("created_at", -1).to_list(500)
    total = round(sum(t.get("amount", 0) for t in txs), 2)
    return {"period_days": days, "total_eur": total, "transactions": txs}
