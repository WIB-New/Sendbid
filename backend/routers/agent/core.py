"""Agent operations module."""
import asyncio
import logging
from datetime import datetime, timedelta
from typing import Optional

from fastapi import Depends, HTTPException
from pydantic import BaseModel

from core.db import db, now_utc, iso, clean_doc
from core.deps import get_current_user
from core.security import gen_id, hash_password
from routers.notifications import create_notification

from . import router
from .models import AgentSignupIn, BidIn, CompleteIn


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


