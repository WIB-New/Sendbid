"""Transfers + Auction (WebSocket) router."""
import io
import asyncio
import logging
import random
from datetime import timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, Query, Header
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm

from core.db import db, now_utc, iso, clean_doc
from core.deps import get_current_user, require_pin, get_user_from_token
from core.manager import manager
from core.security import gen_id, gen_withdrawal_code, sign_qr_payload
from routers.notifications import create_notification

router = APIRouter(prefix="/transfers", tags=["transfers"])
logger = logging.getLogger("sendbid.transfers")


class TransferDraftIn(BaseModel):
    destination_country: str
    destination_currency: str
    send_amount: float
    receive_amount: float
    fx_rate: float
    fee_percent: float
    delivery_mode: str
    beneficiary: dict
    delivery_details: Optional[dict] = None
    purpose: str
    source_of_funds: str
    vip_delivery: bool = False


class ConfirmTransferIn(BaseModel):
    draft_id: str
    pin: str


class BidIn(BaseModel):
    transfer_id: str
    bid_id: str


@router.get("/fx-rate")
async def fx_rate(from_currency: str = "EUR", to_currency: str = "XOF"):
    """Dynamic fx-rate driven by the `corridors` collection.

    Each receiving country has its own fx_rate_eur and margin in MongoDB.
    Falls back to a sensible default when the corridor is missing (so older
    clients don't break during the migration window).
    """
    to_curr = to_currency.upper()
    if to_curr == from_currency.upper():
        return {"from": from_currency, "to": to_curr, "rate": 1.0, "margin_percent": 0.0, "fixed": False}

    # Look up corridor by destination currency
    c = await db.corridors.find_one({"currency": to_curr, "active": True}, {"_id": 0})
    if c and c.get("fx_rate_eur"):
        return {
            "from": from_currency,
            "to": to_curr,
            "rate": float(c["fx_rate_eur"]),
            "margin_percent": float(c.get("fx_margin_percent", 1.0)),
            "fixed": bool(c.get("fx_fixed", False)),
            "country": c.get("country_code"),
        }

    # Hard fallback (kept for graceful degradation only)
    fallback = {
        "XOF": (655.957, True), "XAF": (655.957, True), "MAD": (10.85, False),
        "USD": (1.08, False), "NGN": (1750.0, False), "GHS": (17.5, False),
    }
    rate, fixed = fallback.get(to_curr, (1.0, False))
    return {"from": from_currency, "to": to_curr, "rate": rate, "margin_percent": 1.0, "fixed": fixed}


@router.post("/draft")
async def create_draft(payload: TransferDraftIn, user: dict = Depends(get_current_user)):
    draft_id = gen_id()
    fee_amount = round(payload.send_amount * payload.fee_percent / 100, 2)
    total = round(payload.send_amount + fee_amount, 2)
    draft = {
        "id": draft_id, "user_id": user["id"],
        "destination_country": payload.destination_country,
        "destination_currency": payload.destination_currency,
        "send_amount": payload.send_amount, "receive_amount": payload.receive_amount,
        "fx_rate": payload.fx_rate, "fee_percent": payload.fee_percent,
        "fee_amount": fee_amount, "total_amount": total,
        "delivery_mode": payload.delivery_mode, "beneficiary": payload.beneficiary,
        "delivery_details": payload.delivery_details or {},
        "purpose": payload.purpose, "source_of_funds": payload.source_of_funds,
        "vip_delivery": payload.vip_delivery, "status": "DRAFT",
        "created_at": iso(now_utc()),
    }
    await db.transfer_drafts.insert_one(draft)
    return clean_doc(draft)


@router.post("/confirm")
async def confirm_transfer(payload: ConfirmTransferIn, user: dict = Depends(get_current_user)):
    await require_pin(user["id"], payload.pin)
    draft = await db.transfer_drafts.find_one({"id": payload.draft_id, "user_id": user["id"]}, {"_id": 0})
    if not draft:
        raise HTTPException(status_code=404, detail="Brouillon introuvable")

    # Atomic conditional debit
    debited = await db.wallets.find_one_and_update(
        {"user_id": user["id"], "balance": {"$gte": draft["total_amount"]}},
        {"$inc": {"balance": -draft["total_amount"]}},
        return_document=True,
    )
    if not debited:
        raise HTTPException(status_code=400, detail="Solde Floo Money insuffisant. Rechargez votre wallet.")

    await db.wallet_tx.insert_one({
        "id": gen_id(), "user_id": user["id"], "type": "transfer_escrow",
        "amount": -draft["total_amount"], "currency": debited.get("currency", "EUR"),
        "counterparty": draft["beneficiary"].get("full_name"),
        "note": f"Transfert vers {draft['destination_country']}",
        "created_at": iso(now_utc()),
    })

    transfer_id = gen_id()
    withdrawal_code = gen_withdrawal_code()
    qr_payload = {
        "type": "transfer_pickup", "transfer_id": transfer_id,
        "withdrawal_code": withdrawal_code,
        "amount": draft["receive_amount"], "currency": draft["destination_currency"],
        "exp": iso(now_utc() + timedelta(hours=48)),
    }
    qr_token = sign_qr_payload(qr_payload)

    transfer = {
        **draft, "id": transfer_id, "draft_id": draft["id"],
        "withdrawal_code": withdrawal_code, "qr_token": qr_token,
        "qr_expires_at": qr_payload["exp"],
        "status": "BIDDING" if draft["delivery_mode"] == "cash" else "PROCESSING",
        "agent_id": None, "agent_assigned_at": None, "completed_at": None,
        "auction_round": 0, "confirmed_at": iso(now_utc()),
    }
    transfer.pop("created_at", None)
    transfer["created_at"] = iso(now_utc())
    await db.transfers.insert_one(transfer)
    await db.transfer_drafts.delete_one({"id": draft["id"]})

    if draft["delivery_mode"] == "cash":
        await start_auction(transfer_id)
    else:
        asyncio.create_task(simulate_non_cash_delivery(transfer_id))

    await create_notification(user["id"], "Transfert créé", f"Code retrait: {withdrawal_code}")
    return clean_doc(dict(transfer))


async def simulate_non_cash_delivery(transfer_id: str):
    await asyncio.sleep(8)
    await db.transfers.update_one({"id": transfer_id}, {"$set": {"status": "COMPLETED", "completed_at": iso(now_utc())}})


async def start_auction(transfer_id: str):
    transfer = await db.transfers.find_one({"id": transfer_id}, {"_id": 0})
    if not transfer:
        return
    target_country = (transfer.get("destination_country") or "").upper()
    # === ÉLIGIBILITÉ AGENTS (Item 7 — spec produit) ===
    # DOIVENT : pays compatible + Disponible + KYC tier 3 + pas suspendus + pas de transfert en retard
    agent_query: dict = {
        "$and": [
            {"$or": [{"country_code": target_country}, {"country": target_country}]} if target_country else {},
            {"$or": [{"available": True}, {"available": {"$exists": False}}]},  # default available
            {"$or": [{"kyc_tier": {"$gte": 3}}, {"kyc_tier": {"$exists": False}}]},  # default OK for demo
            {"suspended": {"$ne": True}},
            {"has_overdue_transfer": {"$ne": True}},
        ],
    }
    if not target_country:
        agent_query["$and"][0] = {}
    agents = await db.agents.find(agent_query, {"_id": 0}).to_list(200)
    logger.info(f"[auction] {transfer_id} eligible_agents={len(agents)} country={target_country}")
    asyncio.create_task(run_auction(transfer_id, transfer, agents))


def _composite_score(a: dict, target_city: str, target_country: str) -> float:
    """Composite scoring per Item 7 spec (lower = higher priority).
    Weights: proximity 30% + reputation 25% + wallet 10% + cash capacity 10%
    + claims (inverse) 10% + gamification 10% + seniority 5% = 100%.
    """
    # 1. Proximity (30%) — same city >> same country >> elsewhere
    same_city = (a.get("city") or "").lower() == (target_city or "").lower()
    same_country = (a.get("country_code") or target_country) == target_country
    distance_km = float(a.get("_distance_km") or random.uniform(0.5, 50.0))
    proximity = (0 if same_city else (10 if same_country else 30)) + distance_km / 5
    # 2. Reputation (25%) — rating 0-5 → 25-0 (higher rating better)
    rating = float(a.get("rating") or 4.0)
    reputation = (5 - max(0, min(5, rating))) * 5  # 0..25
    # 3. Wallet balance (10%) — higher = better; threshold 1000 EUR = 0, 0 EUR = 10
    wallet_balance = float(a.get("wallet_balance") or a.get("balance") or 500)
    wallet_score = max(0, 10 - wallet_balance / 100)
    # 4. Cash capacity (10%) — declared capability
    cash_capacity = float(a.get("cash_capacity") or 500)
    cash_score = max(0, 10 - cash_capacity / 100)
    # 5. Claims (10%) — fewer is better
    claims = int(a.get("negative_claims") or 0)
    claims_score = min(10, claims * 2)
    # 6. Gamification (10%) — points/badges; higher = better
    gamif_points = int(a.get("gamification_points") or 0)
    gamif_score = max(0, 10 - gamif_points / 100)
    # 7. Seniority (5%) — older accounts get a bonus; days_since_signup
    days_active = int(a.get("days_active") or 30)
    seniority_score = max(0, 5 - days_active / 60)
    # Weighted sum — lower is higher priority
    return (proximity * 0.30 + reputation * 0.25 + wallet_score * 0.10
            + cash_score * 0.10 + claims_score * 0.10 + gamif_score * 0.10
            + seniority_score * 0.05)


def _commission_breakdown(send_amount: float, fee_pct: float) -> dict:
    """Computes the commission breakdown shown to agents.
    company keeps 20% of the client's fee; agent gets 80% net."""
    client_fee_amount = round(send_amount * fee_pct / 100, 2)
    company_share = round(client_fee_amount * 0.20, 2)
    agent_net = round(client_fee_amount - company_share, 2)
    return {
        "client_fee_pct": fee_pct,
        "client_fee_amount": client_fee_amount,
        "company_share": company_share,
        "agent_net": agent_net,
    }


async def run_auction(transfer_id: str, transfer: dict, agents: List[dict]):
    """Item 7 — Algo enchères :
    - 5 tours x 10 agents x 60s. Scoring composite (proximity 30% / reputation 25% / wallet 10% /
      cash capacity 10% / claims 10% / gamification 10% / seniority 5%).
    - Agents simulent : 'Accept', 'Decline', 'Bid lower' (frais < client_fee_pct).
    - À la fin du round : si au moins un bid valide → assigne au meilleur (frais le + bas, puis rating).
    - Si 5 rounds sans gagnant → COUNTER-BID phase : 3 sous-tours de 5 meilleurs agents,
      autorisés à proposer des frais SUPÉRIEURS au client.
    - Si toutes les rounds + counter-bids échouent : ABSORBED (plateforme prend en charge) ou EXPIRED.
    """
    try:
        await db.bids.delete_many({"transfer_id": transfer_id})
        await db.counter_bids.delete_many({"transfer_id": transfer_id})
        ben = transfer.get("beneficiary") or {}
        target_city = (ben.get("city") or "").lower()
        target_country = (ben.get("country") or "").upper()
        client_fee_pct = float(transfer.get("fee_percent") or 2.0)
        send_amount = float(transfer.get("send_amount") or 0)

        # Pre-rank all agents by composite score
        ranked = sorted(agents, key=lambda a: _composite_score(a, target_city, target_country))
        used_ids: set = set()
        ROUNDS = 5
        PER_ROUND = 10
        ROUND_SECONDS = 60

        # ============================== MAIN 5 ROUNDS ==============================
        for round_idx in range(ROUNDS):
            t = await db.transfers.find_one({"id": transfer_id}, {"_id": 0, "status": 1, "agent_id": 1})
            if not t or t["status"] != "BIDDING" or t.get("agent_id"):
                return
            await db.transfers.update_one({"id": transfer_id}, {"$set": {"auction_round": round_idx + 1}})

            pool = [a for a in ranked if a["id"] not in used_ids][:PER_ROUND]
            if not pool:
                continue
            for a in pool:
                used_ids.add(a["id"])

            await manager.broadcast(transfer_id, {
                "event": "round_started",
                "round": round_idx + 1, "total_rounds": ROUNDS,
                "duration_sec": ROUND_SECONDS, "transfer_id": transfer_id,
                "agents_in_round": len(pool),
            })
            # Notifications push aux agents éligibles
            try:
                await manager.broadcast_agents({
                    "event": "auction_invite",
                    "transfer_id": transfer_id,
                    "round": round_idx + 1,
                    "destination_country": transfer.get("destination_country"),
                    "destination_city": transfer.get("destination_city"),
                    "send_amount": send_amount,
                    "client_fee_pct": client_fee_pct,
                    "commission": _commission_breakdown(send_amount, client_fee_pct),
                    "delivery_mode": transfer.get("delivery_mode"),
                    "vip_delivery": transfer.get("vip_delivery"),
                    "vip_express": transfer.get("vip_express"),
                    "expires_in_sec": ROUND_SECONDS,
                    "phase": "main",
                }, agent_ids=[a["id"] for a in pool])
            except Exception:
                pass

            # Simulation : chaque agent répond (accept/decline/bid lower) dans la fenêtre 60s
            schedule = sorted([random.uniform(2, ROUND_SECONDS - 3) for _ in pool])
            start_ts = asyncio.get_event_loop().time()
            for at, agent in zip(schedule, pool):
                wait = max(0, start_ts + at - asyncio.get_event_loop().time())
                if wait > 0:
                    await asyncio.sleep(wait)
                t = await db.transfers.find_one({"id": transfer_id}, {"_id": 0, "status": 1, "agent_id": 1})
                if not t or t["status"] != "BIDDING" or t.get("agent_id"):
                    return
                # Décision agent (60% bid lower, 25% accept au taux client, 15% decline)
                rnd = random.random()
                if rnd < 0.15:
                    continue  # decline (no bid)
                if rnd < 0.40:
                    bid_pct = round(client_fee_pct, 2)  # accept
                else:
                    # bid lower — strictement INFÉRIEUR au taux client (règle stricte spec)
                    bid_pct = round(random.uniform(max(0.5, client_fee_pct - 1.5), client_fee_pct - 0.05), 2)
                bid = {
                    "id": gen_id(), "transfer_id": transfer_id,
                    "round": round_idx + 1, "phase": "main",
                    "agent_id": agent["id"], "agent_name": agent["full_name"],
                    "agent_profile_id": agent.get("profile_id"),
                    "agent_avatar": agent.get("avatar_url"),
                    "agent_rating": agent.get("rating", 4.5),
                    "agent_city": agent.get("city"),
                    "same_city": (agent.get("city") or "").lower() == target_city,
                    "agent_distance_km": round(random.uniform(0.5, 12.0) if (agent.get("city") or "").lower() == target_city else random.uniform(8, 50.0), 1),
                    "bid_fee_percent": bid_pct,
                    "eta_minutes": random.randint(10, 60),
                    "commission": _commission_breakdown(send_amount, bid_pct),
                    "created_at": iso(now_utc()),
                }
                await db.bids.insert_one(dict(bid))
                await manager.broadcast(transfer_id, {"event": "new_bid", "bid": clean_doc(dict(bid))})

            # Attendre fin du round + sélection
            elapsed = asyncio.get_event_loop().time() - start_ts
            if elapsed < ROUND_SECONDS:
                await asyncio.sleep(ROUND_SECONDS - elapsed)
            t = await db.transfers.find_one({"id": transfer_id}, {"_id": 0, "status": 1, "agent_id": 1})
            if not t or t.get("agent_id"):
                return
            round_bids = await db.bids.find({"transfer_id": transfer_id, "round": round_idx + 1, "phase": "main"}, {"_id": 0}).to_list(50)
            if round_bids:
                # Tri : frais le + bas (strictement < client) puis rating décroissant, puis distance
                valid = [b for b in round_bids if b.get("bid_fee_percent", 99) <= client_fee_pct]
                if valid:
                    valid.sort(key=lambda b: (b["bid_fee_percent"], -float(b.get("agent_rating") or 0), b.get("agent_distance_km", 999)))
                    await assign_agent(transfer_id, valid[0]["id"], auto=True)
                    return

        # ============================== AUCUN GAGNANT — FALLBACK DIRECT ==============================
        # RÈGLE PRODUIT (déc 2026) : Les frais d'un agent NE PEUVENT JAMAIS être supérieurs
        # aux frais souhaités par le client. La phase de "counter-bid uplift" qui permettait
        # à un agent de soumettre des frais > client_fee_pct est désormais DÉSACTIVÉE.
        #
        # Si aucun agent n'a accepté dans les 5 tours standards (frais ≤ client_fee_pct),
        # on bascule directement vers le fallback (ABSORBED ou EXPIRED).
        logger.info(f"[auction] {transfer_id} no winner after {ROUNDS} standard rounds → fallback (counter-bid désactivé)")
        return await _run_fallback(transfer_id, send_amount, client_fee_pct)

        # ============================== ULTIMATE FALLBACK ==============================
        # Aucune contre-enchère retournée — plateforme absorbe OU expire
        # Politique simple : si send_amount < 200 EUR → ABSORBED (plateforme prend en charge)
        # Sinon → EXPIRED (client doit republier avec frais plus attractifs)
        if send_amount < 200:
            await db.transfers.update_one({"id": transfer_id}, {"$set": {
                "status": "ABSORBED",
                "absorbed_at": iso(now_utc()),
                "absorption_reason": "no_agent_after_5_rounds_and_3_counter_rounds",
            }})
            await manager.broadcast(transfer_id, {"event": "auction_absorbed", "transfer_id": transfer_id})
            try:
                await create_notification(transfer["user_id"], "Transfert pris en charge",
                                          "Aucun agent disponible — la plateforme prend en charge votre transfert directement. Délai de remise étendu.")
            except Exception:
                pass
        else:
            await db.transfers.update_one({"id": transfer_id}, {"$set": {"status": "EXPIRED"}})
            await manager.broadcast(transfer_id, {"event": "auction_expired"})
            try:
                await create_notification(transfer["user_id"], "Enchère expirée",
                                          "Aucun agent disponible pour ce transfert. Vous pouvez relancer avec des frais plus attractifs.")
            except Exception:
                pass
    except Exception as e:
        logger.error(f"auction error: {e}", exc_info=True)


async def _run_fallback(transfer_id: str, send_amount: float, client_fee_pct: float):
    """Fallback cascade — appelé quand la phase standard échoue et qu'aucune contre-enchère n'est autorisée
    (ou si la contre-enchère a aussi échoué). Politique simple : si send_amount < 200 EUR → ABSORBED, sinon EXPIRED."""
    transfer = await db.transfers.find_one({"id": transfer_id}, {"_id": 0}) or {}
    if send_amount < 200:
        await db.transfers.update_one({"id": transfer_id}, {"$set": {
            "status": "ABSORBED",
            "absorbed_at": iso(now_utc()),
            "absorption_reason": "no_agent_after_5_rounds",
        }})
        await manager.broadcast(transfer_id, {"event": "auction_absorbed", "transfer_id": transfer_id})
        try:
            await create_notification(transfer.get("user_id"), "Transfert pris en charge",
                                      "Aucun agent disponible — la plateforme prend en charge votre transfert directement. Délai de remise étendu.")
        except Exception:
            pass
    else:
        await db.transfers.update_one({"id": transfer_id}, {"$set": {"status": "EXPIRED"}})
        await manager.broadcast(transfer_id, {"event": "auction_expired"})
        try:
            await create_notification(transfer.get("user_id"), "Enchère expirée",
                                      "Aucun agent disponible pour ce transfert. Vous pouvez relancer avec des frais plus attractifs.")
        except Exception:
            pass


async def assign_agent(transfer_id: str, bid_id: str, auto: bool = False):
    bid = await db.bids.find_one({"id": bid_id, "transfer_id": transfer_id}, {"_id": 0})
    if not bid:
        return None
    agent = await db.agents.find_one({"id": bid["agent_id"]}, {"_id": 0})
    await db.transfers.update_one(
        {"id": transfer_id},
        {"$set": {
            "status": "AGENT_ASSIGNED", "agent_id": bid["agent_id"],
            "agent_snapshot": agent, "selected_bid": bid,
            "agent_assigned_at": iso(now_utc()),
        }},
    )
    await db.chat_rooms.insert_one({
        "id": gen_id(), "transfer_id": transfer_id,
        "participants": ["sender", "agent", "beneficiary"],
        "open": True, "created_at": iso(now_utc()),
    })
    await manager.broadcast(transfer_id, {"event": "agent_assigned", "agent": agent, "bid": bid, "auto": auto})
    transfer = await db.transfers.find_one({"id": transfer_id}, {"_id": 0})
    if transfer:
        await create_notification(transfer["user_id"], "Agent assigné", f"{agent['full_name']} prend en charge votre transfert")
    return agent


@router.post("/{transfer_id}/accept-bid")
async def accept_bid(transfer_id: str, body: BidIn, user: dict = Depends(get_current_user)):
    transfer = await db.transfers.find_one({"id": transfer_id, "user_id": user["id"]}, {"_id": 0})
    if not transfer:
        raise HTTPException(status_code=404, detail="Transfert introuvable")
    if transfer["status"] != "BIDDING":
        raise HTTPException(status_code=400, detail="Enchère terminée")
    agent = await assign_agent(transfer_id, body.bid_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Enchère introuvable")
    return {"ok": True, "agent": agent}


@router.get("/{transfer_id}/bids")
async def list_bids(transfer_id: str, user: dict = Depends(get_current_user)):
    return await db.bids.find({"transfer_id": transfer_id}, {"_id": 0}).sort("bid_fee_percent", 1).to_list(50)


@router.post("/{transfer_id}/retry-auction")
async def retry_auction(transfer_id: str, user: dict = Depends(get_current_user)):
    """Relance une enchère expirée pour trouver un nouvel agent."""
    transfer = await db.transfers.find_one({"id": transfer_id, "user_id": user["id"]}, {"_id": 0})
    if not transfer:
        raise HTTPException(status_code=404, detail="Transfert introuvable")
    if transfer.get("status") not in ("EXPIRED", "BIDDING"):
        raise HTTPException(status_code=400, detail="Enchère non éligible à une relance")
    if transfer.get("agent_id"):
        raise HTTPException(status_code=409, detail="Un agent a déjà été assigné")
    await db.bids.delete_many({"transfer_id": transfer_id})
    await db.transfers.update_one({"id": transfer_id}, {"$set": {"status": "BIDDING", "auction_round": 0}})
    await start_auction(transfer_id)
    return {"ok": True}


@router.post("/{transfer_id}/complete-mock")
async def complete_mock(transfer_id: str, user: dict = Depends(get_current_user)):
    t = await db.transfers.find_one({"id": transfer_id, "user_id": user["id"]}, {"_id": 0})
    if not t:
        raise HTTPException(status_code=404, detail="Transfert introuvable")
    await db.transfers.update_one({"id": transfer_id}, {"$set": {"status": "COMPLETED", "completed_at": iso(now_utc())}})
    await db.chat_rooms.update_one({"transfer_id": transfer_id}, {"$set": {"open": False}})
    await create_notification(user["id"], "Transfert finalisé", f"Code {t['withdrawal_code']} utilisé")
    await manager.broadcast(transfer_id, {"event": "completed"})
    return {"ok": True}


class ValidateCodeIn(BaseModel):
    code: str


@router.post("/validate-code")
async def validate_code(payload: ValidateCodeIn, _user: dict = Depends(get_current_user)):
    """
    PAYBID agent helper: looks up an active transfer by withdrawal_code (10 digits)
    or by signed qr_token, and returns the minimum information needed to perform
    the cash hand-off. The qr is considered valid only if not expired and the
    transfer is in a status where pickup is allowed.
    """
    code = (payload.code or "").strip()
    if len(code) < 6:
        raise HTTPException(status_code=400, detail="Code invalide")
    # Try withdrawal_code first, then qr_token
    t = await db.transfers.find_one({"withdrawal_code": code}, {"_id": 0})
    if not t:
        t = await db.transfers.find_one({"qr_token": code}, {"_id": 0})
    if not t:
        raise HTTPException(status_code=404, detail="Aucun transfert trouvé pour ce code")
    if t.get("status") not in {"AGENT_ASSIGNED", "PROCESSING", "READY_FOR_PICKUP", "VIP_DELIVERY"}:
        raise HTTPException(status_code=409, detail=f"Transfert non disponible (statut: {t.get('status')})")
    qr_exp = t.get("qr_expires_at")
    if qr_exp:
        try:
            from datetime import datetime
            if isinstance(qr_exp, str):
                exp_dt = datetime.fromisoformat(qr_exp.replace("Z", "+00:00"))
            else:
                exp_dt = qr_exp
            if exp_dt.replace(tzinfo=None) < now_utc().replace(tzinfo=None):
                raise HTTPException(status_code=410, detail="Code expiré")
        except HTTPException:
            raise
        except Exception:
            pass
    # Strip out internal/sensitive fields
    return {
        "id": t.get("id"),
        "beneficiary": t.get("beneficiary"),
        "destination_country": t.get("destination_country"),
        "destination_currency": t.get("destination_currency"),
        "receive_amount": t.get("receive_amount"),
        "delivery_mode": t.get("delivery_mode"),
        "vip_delivery": t.get("vip_delivery", False),
        "status": t.get("status"),
        "agent_snapshot": t.get("agent_snapshot"),
        "qr_expires_at": t.get("qr_expires_at"),
    }



@router.get("")
async def list_transfers(user: dict = Depends(get_current_user), status: Optional[str] = None, limit: int = 50):
    q: dict = {"user_id": user["id"]}
    if status:
        q["status"] = status
    return await db.transfers.find(q, {"_id": 0}).sort("created_at", -1).to_list(limit)


@router.get("/{transfer_id}")
async def get_transfer(transfer_id: str, user: dict = Depends(get_current_user)):
    t = await db.transfers.find_one({"id": transfer_id, "user_id": user["id"]}, {"_id": 0})
    if not t:
        raise HTTPException(status_code=404, detail="Transfert introuvable")
    # Si agent assigné, embarquer ses infos publiques (parcours live offers / receipt)
    if t.get("agent_id"):
        ag = await db.agents.find_one({"id": t["agent_id"]},
            {"_id": 0, "id": 1, "full_name": 1, "profile_id": 1, "city": 1, "country_code": 1,
             "phone": 1, "agency_name": 1, "agency_address": 1, "avatar_url": 1,
             "rating": 1, "lat": 1, "lng": 1})
        if ag:
            t["assigned_agent"] = ag
    return t


@router.get("/{transfer_id}/receipt-pdf")
async def receipt_pdf(transfer_id: str, token: Optional[str] = Query(None), authorization: Optional[str] = Header(None)):
    # Allow either Authorization header (default) OR ?token= query param (for direct browser/mobile download)
    auth_user = None
    if authorization and authorization.lower().startswith("bearer "):
        auth_user = await get_user_from_token(authorization.split(" ", 1)[1].strip())
    if not auth_user and token:
        auth_user = await get_user_from_token(token)
    if not auth_user:
        raise HTTPException(status_code=401, detail="Non authentifié")
    t = await db.transfers.find_one({"id": transfer_id, "user_id": auth_user["id"]}, {"_id": 0})
    if not t:
        raise HTTPException(status_code=404, detail="Transfert introuvable")
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    width, height = A4
    c.setFillColorRGB(0.058, 0.298, 0.506)
    c.rect(0, height - 40 * mm, width, 40 * mm, fill=1, stroke=0)
    c.setFillColorRGB(1, 1, 1)
    c.setFont("Helvetica-Bold", 22)
    c.drawString(20 * mm, height - 22 * mm, "SENDBID")
    c.setFont("Helvetica", 10)
    c.drawString(20 * mm, height - 30 * mm, "Reçu de transfert")
    c.setFillColorRGB(0, 0, 0)
    y = height - 55 * mm
    c.setFont("Helvetica-Bold", 12)
    c.drawString(20 * mm, y, f"Référence: {t['id'][:8].upper()}")
    y -= 8 * mm
    c.setFont("Helvetica", 10)
    rows = [
        ("Statut", t["status"]),
        ("Bénéficiaire", t["beneficiary"].get("full_name", "—")),
        ("Pays destination", t["destination_country"]),
        ("Mode remise", t["delivery_mode"].upper()),
        ("Montant envoyé", f"{t['send_amount']:.2f} EUR"),
        ("Frais", f"{t['fee_amount']:.2f} EUR"),
        ("Total débité", f"{t['total_amount']:.2f} EUR"),
        ("Montant reçu", f"{t['receive_amount']:.2f} {t['destination_currency']}"),
        ("Code retrait", t.get("withdrawal_code", "—")),
        ("Date", t["created_at"][:19].replace("T", " ")),
    ]
    for k, v in rows:
        c.drawString(20 * mm, y, f"{k}:")
        c.drawString(80 * mm, y, str(v))
        y -= 7 * mm
    c.setFillColorRGB(0.4, 0.4, 0.4)
    c.setFont("Helvetica-Oblique", 8)
    c.drawString(20 * mm, 20 * mm, "Reçu signé HMAC-SHA256. SENDBID — Transfert international.")
    c.showPage()
    c.save()
    buf.seek(0)
    return StreamingResponse(buf, media_type="application/pdf",
                             headers={"Content-Disposition": f'attachment; filename="recu-{transfer_id[:8]}.pdf"'})


class ExtendPickupIn(BaseModel):
    days: int


@router.post("/{transfer_id}/extend-pickup")
async def extend_pickup(transfer_id: str, payload: ExtendPickupIn, user: dict = Depends(get_current_user)):
    """Prolonger le délai de retrait (Cash uniquement). Frais déduits du paiement bénéficiaire."""
    if payload.days not in (1, 7):
        raise HTTPException(status_code=400, detail="Durée invalide. Choisir 1 ou 7 jours.")
    t = await db.transfers.find_one({"id": transfer_id, "user_id": user["id"]}, {"_id": 0})
    if not t:
        raise HTTPException(status_code=404, detail="Transfert introuvable")
    if str(t.get("delivery_mode", "cash")).lower() != "cash":
        raise HTTPException(status_code=400, detail="Prolongation possible uniquement pour les transferts Espèces")
    if t.get("status") in ("COMPLETED", "FAILED", "CANCELLED_USER"):
        raise HTTPException(status_code=400, detail="Transfert déjà finalisé")
    current_ext = int(t.get("pickup_extension_days") or 0)
    new_ext = current_ext + payload.days
    fee = 1.0 if payload.days == 1 else 3.0
    await db.transfers.update_one(
        {"id": transfer_id, "user_id": user["id"]},
        {"$set": {"pickup_extension_days": new_ext, "pickup_extension_fee": float(t.get("pickup_extension_fee") or 0) + fee, "pickup_extended_at": iso(now_utc())}},
    )
    await create_notification(user["id"], "Délai prolongé", f"Délai de retrait prolongé de {payload.days} jour(s). Frais : {fee:.2f}€ déduits du paiement bénéficiaire.", "transfer", transfer_id)
    return {"ok": True, "extension_days": new_ext, "fee_added": fee}


def register_websocket(app):
    """Register the auction WebSocket on the FastAPI app, with optional token auth."""

    @app.websocket("/api/ws/auction/{transfer_id}")
    async def ws_auction(ws: WebSocket, transfer_id: str, token: Optional[str] = Query(None)):
        # Optional auth: if a token is passed, validate it. Anonymous read-only allowed for backward compat.
        if token:
            user = await get_user_from_token(token)
            if not user:
                await ws.close(code=4401)
                return
            t = await db.transfers.find_one({"id": transfer_id, "user_id": user["id"]}, {"_id": 0, "id": 1})
            if not t:
                await ws.close(code=4403)
                return
        await manager.connect(transfer_id, ws)
        try:
            bids = await db.bids.find({"transfer_id": transfer_id}, {"_id": 0}).sort("bid_fee_percent", 1).to_list(50)
            await ws.send_json({"event": "snapshot", "bids": bids})
            while True:
                await ws.receive_text()
        except WebSocketDisconnect:
            manager.disconnect(transfer_id, ws)
        except Exception:
            manager.disconnect(transfer_id, ws)

    # ============================================================
    # Agent global channel (PAYBID) — receives auction invites
    # ============================================================
    @app.websocket("/api/ws/agent")
    async def ws_agent(ws: WebSocket, token: Optional[str] = Query(None)):
        if not token:
            await ws.close(code=4401)
            return
        user = await get_user_from_token(token)
        if not user or user.get("role") != "agent":
            await ws.close(code=4403)
            return
        agent_id = user["id"]
        await manager.connect_agent(agent_id, ws)
        try:
            await ws.send_json({"event": "agent_connected", "agent_id": agent_id, "ts": iso(now_utc())})
            while True:
                await ws.receive_text()
        except WebSocketDisconnect:
            manager.disconnect_agent(agent_id, ws)
        except Exception:
            manager.disconnect_agent(agent_id, ws)
