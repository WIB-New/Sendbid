"""Auction engine + bid endpoints + WebSocket handlers."""
import asyncio
import logging
import random
from typing import List, Optional

from fastapi import Depends, HTTPException, WebSocket, WebSocketDisconnect, Query

from core.db import db, now_utc, iso, clean_doc
from core.deps import get_current_user, get_user_from_token
from core.manager import manager
from core.security import gen_id
from routers.notifications import create_notification

from . import router
from .models import BidIn

logger = logging.getLogger("sendbid.transfers.auction")


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
        ROUND_SECONDS = 30

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
                    bid_pct = round(client_fee_pct, 2)  # accept au prix exact client
                else:
                    # bid lower — strictement INFÉRIEUR au taux client (règle stricte spec)
                    bid_pct = round(random.uniform(max(0.5, client_fee_pct - 1.5), client_fee_pct - 0.05), 2)

                # === GARDE-FOU CRITIQUE ===
                # Cap dur : aucun bid ne peut excéder client_fee_pct. Si dépassement
                # (cas théorique de bug en amont), on tronque au max client.
                if bid_pct > client_fee_pct:
                    bid_pct = round(client_fee_pct, 2)
                if bid_pct < 0.1:
                    bid_pct = 0.1
                # === FIN GARDE-FOU ===
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

            # Attendre fin du round + sélection (sortie anticipée si round_forced OU si tous les agents ont déjà répondu avec ≥1 offre valide)
            elapsed = asyncio.get_event_loop().time() - start_ts
            remaining = ROUND_SECONDS - elapsed

            # === FAST-FINISH (spec : raccourcir le délai si tous les agents ont répondu) ===
            # À ce stade, la boucle `for at, agent in zip(schedule, pool):` est terminée
            # → CHAQUE agent du pool a déjà pris sa décision (bid OU decline).
            # Si au moins une offre satisfaisante (bid_fee_percent ≤ client_fee_pct) a été
            # reçue, on FINIT IMMÉDIATEMENT sans attendre la fin des 30s.
            early_bids_check = await db.bids.find(
                {"transfer_id": transfer_id, "round": round_idx + 1, "phase": "main"},
                {"_id": 0, "bid_fee_percent": 1},
            ).to_list(50)
            valid_early = [b for b in early_bids_check if float(b.get("bid_fee_percent", 99)) <= client_fee_pct]
            if valid_early:
                logger.info(
                    f"[auction] {transfer_id} round {round_idx+1} FAST-FINISH at {elapsed:.1f}s "
                    f"(all {len(pool)} agents responded · {len(valid_early)} valid offer(s))"
                )
                await manager.broadcast(transfer_id, {
                    "event": "round_ended_early",
                    "round": round_idx + 1,
                    "elapsed_sec": round(elapsed, 1),
                    "valid_bids": len(valid_early),
                    "reason": "all_agents_responded",
                })
                # On saute l'attente restante : sélection immédiate
            else:
                # Pas d'offre valide encore → on attend la fin des 30s (cas où des bids
                # pourraient arriver après — théorique, ou pour laisser le compteur visuel
                # se terminer côté client). Pendant l'attente : check toutes 0.5s du
                # signal "force-next" (relance manuelle par le client).
                waited = 0.0
                while waited < remaining:
                    await asyncio.sleep(min(0.5, remaining - waited))
                    waited += 0.5
                    t_chk = await db.transfers.find_one(
                        {"id": transfer_id},
                        {"_id": 0, "agent_id": 1, "auction_round_force_next": 1},
                    )
                    if not t_chk:
                        return
                    if t_chk.get("agent_id"):
                        return
                    if t_chk.get("auction_round_force_next"):
                        logger.info(f"[auction] {transfer_id} round {round_idx+1} interrupted by client force-next request")
                        await db.transfers.update_one(
                            {"id": transfer_id},
                            {"$unset": {"auction_round_force_next": "", "auction_round_force_next_at": ""}},
                        )
                        break
                    # Re-check : une offre valide est-elle arrivée pendant l'attente ?
                    late_bids = await db.bids.find(
                        {"transfer_id": transfer_id, "round": round_idx + 1, "phase": "main"},
                        {"_id": 0, "bid_fee_percent": 1},
                    ).to_list(50)
                    if any(float(b.get("bid_fee_percent", 99)) <= client_fee_pct for b in late_bids):
                        # Une offre satisfaisante est apparue : on coupe l'attente
                        await manager.broadcast(transfer_id, {
                            "event": "round_ended_early",
                            "round": round_idx + 1,
                            "elapsed_sec": round(elapsed + waited, 1),
                            "valid_bids": len([b for b in late_bids if float(b.get("bid_fee_percent", 99)) <= client_fee_pct]),
                            "reason": "satisfactory_offer_received",
                        })
                        break
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



@router.post("/{transfer_id}/next-round")
async def force_next_round(transfer_id: str, user: dict = Depends(get_current_user)):
    """
    Force le passage au tour SUIVANT de l'enchère en cours, élargissant le périmètre
    d'agents contactés (corridors voisins, agents moins prioritaires).

    Déclenché depuis l'écran "Offres en temps réel" lorsqu'aucune offre n'a été reçue
    au terme d'un tour. Idempotent : si l'enchère est déjà terminée ou si un agent
    est assigné, l'appel est ignoré (200 OK avec `skipped`).
    """
    transfer = await db.transfers.find_one({"id": transfer_id, "user_id": user["id"]}, {"_id": 0})
    if not transfer:
        raise HTTPException(status_code=404, detail="Transfert introuvable")
    if transfer.get("agent_id"):
        return {"ok": True, "skipped": True, "reason": "Agent déjà assigné"}
    if transfer.get("status") not in ("BIDDING",):
        return {"ok": True, "skipped": True, "reason": f"Statut {transfer.get('status')} non éligible"}
    current_round = int(transfer.get("auction_round") or 1)
    if current_round >= 5:
        return {"ok": True, "skipped": True, "reason": "Tour maximum atteint"}
    # Notifie l'écran client que le tour est forcé (le worker en cours détecte la nouvelle ronde)
    await db.transfers.update_one(
        {"id": transfer_id},
        {"$set": {"auction_round_force_next": True, "auction_round_force_next_at": iso(now_utc())}},
    )
    # Broadcast immédiat : le client peut réinitialiser le compteur localement
    await manager.broadcast(transfer_id, {
        "event": "round_forced",
        "from_round": current_round,
        "next_round": current_round + 1,
        "reason": "force_user_request",
    })
    logger.info(f"[auction] {transfer_id} client requested force-next-round (was round {current_round})")
    return {"ok": True, "next_round": current_round + 1}



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
