"""Endpoints opérations agence — 12/06/2026 (items 1, 5 du lot).

Fournit les routes backend pour les nouvelles pages frontend :
- POST /agent/cash-recharge       → demande de recharge de caisse (item 1)
- POST /agent/loan-request        → demande d'encours (item 1)
- POST /agent/agency/cashin       → encaissement client (recharge wallet)
- POST /agent/agency/cashout      → décaissement client (paiement code retrait)
- GET  /agent/agency/operations   → opérations consolidées (super-agent)
- GET  /agent/agency/cashboxes    → liste des caisses (super-agent — item 5)
- GET  /agent/agency/cashboxes/{cashbox_id}
                                  → détail d'une caisse (super-agent — item 5)

Tous ces endpoints reposent sur les collections existantes (agents, wallets,
transfers, float_movements) sans modèle additionnel obligatoire.
"""
from typing import Optional, Dict, Any, List

from fastapi import Depends, HTTPException

from core.db import db, now_utc, iso, clean_doc
from core.deps import get_current_user
from core.security import gen_id

from . import router


async def _get_agent(user: Dict[str, Any]) -> Dict[str, Any]:
    agent = await db.agents.find_one({"user_id": user.get("id")})
    if not agent:
        raise HTTPException(status_code=403, detail="Compte agent introuvable")
    return agent


# ────────────────────────────────────────────────────────────────────
# 1) Demande de recharge de caisse (item 1)
# ────────────────────────────────────────────────────────────────────
@router.post("/cash-recharge")
async def cash_recharge_request(payload: Dict[str, Any], user=Depends(get_current_user)):
    agent = await _get_agent(user)
    amount = float(payload.get("amount") or 0)
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Montant invalide")
    method = (payload.get("method") or "bank").lower()
    if method not in ("bank", "cash", "momo"):
        raise HTTPException(status_code=400, detail="Méthode invalide")
    doc = {
        "id": gen_id(),
        "agent_id": agent["id"],
        "user_id": user["id"],
        "amount": amount,
        "currency": agent.get("currency", "XOF"),
        "method": method,
        "note": (payload.get("note") or "").strip() or None,
        "status": "pending",
        "created_at": iso(now_utc()),
    }
    await db.cash_recharge_requests.insert_one(doc)
    return {"ok": True, "id": doc["id"], "status": "pending"}


# ────────────────────────────────────────────────────────────────────
# 2) Demande d'encours (item 1)
# ────────────────────────────────────────────────────────────────────
@router.post("/loan-request")
async def loan_request(payload: Dict[str, Any], user=Depends(get_current_user)):
    agent = await _get_agent(user)
    amount = float(payload.get("amount") or 0)
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Montant invalide")
    doc = {
        "id": gen_id(),
        "agent_id": agent["id"],
        "user_id": user["id"],
        "amount": amount,
        "currency": agent.get("currency", "XOF"),
        "reason": (payload.get("reason") or "").strip() or None,
        "status": "pending",
        "created_at": iso(now_utc()),
    }
    await db.loan_requests.insert_one(doc)
    return {"ok": True, "id": doc["id"], "status": "pending"}


# ────────────────────────────────────────────────────────────────────
# 3) Encaissement client (Agency CASH-IN)
# ────────────────────────────────────────────────────────────────────
@router.post("/agency/cashin")
async def agency_cashin(payload: Dict[str, Any], user=Depends(get_current_user)):
    agent = await _get_agent(user)
    profile_id = (payload.get("profile_id") or "").strip().upper()
    amount = float(payload.get("amount") or 0)
    if not profile_id:
        raise HTTPException(status_code=400, detail="ID client requis")
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Montant invalide")

    client = await db.users.find_one({"profile_id": profile_id})
    if not client:
        raise HTTPException(status_code=404, detail="Client introuvable")

    wallet = await db.wallets.find_one({"user_id": client["id"]})
    if not wallet:
        raise HTTPException(status_code=404, detail="Portefeuille client introuvable")

    # Crédit du wallet client + log de transaction
    await db.wallets.update_one(
        {"id": wallet["id"]}, {"$inc": {"balance": amount}, "$set": {"updated_at": iso(now_utc())}}
    )
    await db.wallet_tx.insert_one({
        "id": gen_id(), "user_id": client["id"], "wallet_id": wallet["id"],
        "type": "agency_cashin", "amount": amount, "currency": wallet.get("currency", "EUR"),
        "agent_id": agent["id"], "note": f"Encaissement par {agent.get('full_name') or 'agent'}",
        "created_at": iso(now_utc()),
    })

    # Mouvement caisse côté agent
    await db.float_movements.insert_one({
        "id": gen_id(), "agent_id": agent["id"],
        "type": "agency_cashin", "amount_signed": amount,
        "currency": agent.get("currency", "XOF"),
        "note": f"Encaissement client {profile_id}",
        "created_at": iso(now_utc()),
    })
    return {"ok": True, "client_profile_id": profile_id, "amount": amount}


# ────────────────────────────────────────────────────────────────────
# 4) Décaissement client (Agency CASH-OUT par code de retrait)
# ────────────────────────────────────────────────────────────────────
@router.post("/agency/cashout")
async def agency_cashout(payload: Dict[str, Any], user=Depends(get_current_user)):
    agent = await _get_agent(user)
    code = (payload.get("withdrawal_code") or "").strip().upper()
    if not code or len(code) < 6:
        raise HTTPException(status_code=400, detail="Code de retrait invalide")
    tx = await db.transfers.find_one({"withdrawal_code": code})
    if not tx:
        raise HTTPException(status_code=404, detail="Code introuvable ou expiré")
    if tx.get("status") not in ("AGENT_ASSIGNED", "VIP_DELIVERY", "PROCESSING"):
        raise HTTPException(status_code=400, detail=f"Statut transfert incompatible: {tx.get('status')}")

    # Marquer le transfert comme complété
    await db.transfers.update_one(
        {"id": tx["id"]},
        {"$set": {"status": "COMPLETED", "completed_at": iso(now_utc()), "completed_by_agent_id": agent["id"]}}
    )
    await db.float_movements.insert_one({
        "id": gen_id(), "agent_id": agent["id"],
        "type": "agency_cashout", "amount_signed": -float(tx.get("amount_send") or 0),
        "currency": tx.get("currency_send", "EUR"),
        "note": f"Décaissement code {code}",
        "transfer_id": tx["id"],
        "created_at": iso(now_utc()),
    })
    return {"ok": True, "transfer_id": tx["id"], "amount": tx.get("amount_send"), "currency": tx.get("currency_send", "EUR")}


# ────────────────────────────────────────────────────────────────────
# 5) Opérations consolidées de l'agence (super-agent)
# ────────────────────────────────────────────────────────────────────
@router.get("/agency/operations")
async def agency_operations(limit: int = 50, user=Depends(get_current_user)):
    agent = await _get_agent(user)
    if agent.get("agent_type") != "super_agent":
        raise HTTPException(status_code=403, detail="Réservé aux super-agents")
    sub_ids = [a["id"] async for a in db.agents.find({"parent_agent_id": agent["id"]})]
    sub_ids.append(agent["id"])
    cursor = db.float_movements.find({"agent_id": {"$in": sub_ids}}).sort("created_at", -1).limit(limit)
    items = [clean_doc(d) async for d in cursor]
    # Enrichir avec le nom de l'agent
    agent_names: Dict[str, str] = {}
    async for a in db.agents.find({"id": {"$in": sub_ids}}, {"id": 1, "full_name": 1, "legal_name": 1, "_id": 0}):
        agent_names[a["id"]] = a.get("legal_name") or a.get("full_name") or "—"
    for it in items:
        it["agent_name"] = agent_names.get(it.get("agent_id"), "—")
    return {"items": items}


# ────────────────────────────────────────────────────────────────────
# 6) Liste & détail des caisses (super-agent — item 5)
# ────────────────────────────────────────────────────────────────────
@router.get("/agency/cashboxes")
async def list_cashboxes(user=Depends(get_current_user)):
    """Renvoie la liste des caisses (sub-agents) sous la responsabilité du super-agent."""
    agent = await _get_agent(user)
    if agent.get("agent_type") != "super_agent":
        raise HTTPException(status_code=403, detail="Réservé aux super-agents")
    cursor = db.agents.find(
        {"parent_agent_id": agent["id"]},
        {"_id": 0, "id": 1, "full_name": 1, "city": 1, "country": 1, "profile_id": 1, "available": 1}
    )
    sub_agents = await cursor.to_list(200)
    # Pour chaque sub-agent, récupérer son solde float principal
    result: List[Dict[str, Any]] = []
    total_balance = 0.0
    currency = agent.get("currency", "XOF")
    for sa in sub_agents:
        floats = await db.float_accounts.find({"agent_id": sa["id"]}).to_list(10)
        balance = sum(float(f.get("balance") or 0) for f in floats)
        total_balance += balance
        cur = (floats[0].get("currency") if floats else currency) or currency
        result.append({
            **sa,
            "balance": balance,
            "currency": cur,
            "label": f"Caisse {(sa.get('profile_id') or sa['id'])[-4:].upper()}",
        })
    return {"total_balance": total_balance, "currency": currency, "cashboxes": result}


@router.get("/agency/cashboxes/{cashbox_id}")
async def get_cashbox_detail(cashbox_id: str, user=Depends(get_current_user)):
    agent = await _get_agent(user)
    if agent.get("agent_type") != "super_agent":
        raise HTTPException(status_code=403, detail="Réservé aux super-agents")
    sa = await db.agents.find_one({"id": cashbox_id, "parent_agent_id": agent["id"]}, {"_id": 0, "password_hash": 0})
    if not sa:
        raise HTTPException(status_code=404, detail="Caisse introuvable")
    floats = await db.float_accounts.find({"agent_id": cashbox_id}, {"_id": 0}).to_list(10)
    movements = await db.float_movements.find({"agent_id": cashbox_id}, {"_id": 0}).sort("created_at", -1).limit(50).to_list(50)
    return {
        "cashbox": clean_doc(sa),
        "floats": [clean_doc(f) for f in floats],
        "movements": [clean_doc(m) for m in movements],
    }
