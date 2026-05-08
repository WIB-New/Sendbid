"""PAYBID Float router — Gestion des espèces déclarées par les agents.

Régles métier :
- Un agent (personne morale) déclare les espèces qu'il a en caisse (cash_float).
- Chaque paiement à un bénéficiaire (`complete_transfer`) déduit le montant
  du cash_float en devise locale.
- L'agent peut aussi recharger un compte client (cash-in) qui déduit aussi
  son float (encaissement physique à reverser au siège).
- Quand l'agent reçoit physiquement ses commissions ou re-approvisionne,
  il poste une "settlement" qui recrédite le float (ou décrédite le
  digital balance si versement au siège).
- Un agent ne peut JAMAIS compléter un transfert si son float est
  insuffisant (HTTP 400).

Documents Mongo :
- agent_floats : { agent_id, currency, balance, declared_at, updated_at }
- agent_float_movements : { id, agent_id, type, amount_signed, currency,
    balance_after, reason, ref_transfer_id, created_at }
"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from core.db import db, now_utc, iso
from core.deps import get_current_user
from core.security import gen_id

router = APIRouter(prefix="/agent/float", tags=["agent-float"])


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


async def _get_or_create_float(agent_id: str, currency: str = "XOF") -> dict:
    """Returns the current float doc for an agent. Auto-creates at 0."""
    doc = await db.agent_floats.find_one({"agent_id": agent_id, "currency": currency}, {"_id": 0})
    if doc:
        return doc
    doc = {
        "id": gen_id(), "agent_id": agent_id, "currency": currency,
        "balance": 0.0, "declared_at": None,
        "created_at": iso(now_utc()), "updated_at": iso(now_utc()),
    }
    await db.agent_floats.insert_one(dict(doc))
    return doc


async def record_float_movement(
    agent_id: str, movement_type: str, amount_signed: float,
    currency: str = "XOF", reason: str = "",
    ref_transfer_id: Optional[str] = None, balance_after: Optional[float] = None,
) -> str:
    mid = gen_id()
    await db.agent_float_movements.insert_one({
        "id": mid, "agent_id": agent_id,
        "type": movement_type,  # declare | payout | cashin | settlement | adjustment
        "amount_signed": amount_signed,  # >0 crédit, <0 débit
        "currency": currency, "reason": reason,
        "ref_transfer_id": ref_transfer_id,
        "balance_after": balance_after,
        "created_at": iso(now_utc()),
    })
    return mid


async def debit_agent_float_for_transfer(agent_id: str, transfer: dict) -> tuple[bool, str]:
    """Called by complete_transfer to debit the agent's local float by the
    receive_amount of a transfer. Returns (success, message).."""
    currency = transfer.get("destination_currency") or "XOF"
    amount = float(transfer.get("receive_amount") or 0)
    if amount <= 0:
        return True, "Aucun montant à débiter"
    # Atomic debit
    upd = await db.agent_floats.find_one_and_update(
        {"agent_id": agent_id, "currency": currency, "balance": {"$gte": amount}},
        {"$inc": {"balance": -amount}, "$set": {"updated_at": iso(now_utc())}},
        return_document=True,
    )
    if not upd:
        cur = await _get_or_create_float(agent_id, currency)
        return False, f"Float insuffisant : {cur['balance']:.0f} {currency} disponibles, {amount:.0f} requis"
    after = (upd or {}).get("balance", None)
    await record_float_movement(
        agent_id=agent_id, movement_type="payout",
        amount_signed=-amount, currency=currency,
        reason=f"Paiement bénéficiaire {transfer.get('beneficiary', {}).get('full_name', '')}",
        ref_transfer_id=transfer.get("id"),
        balance_after=after,
    )
    return True, "OK"


class DeclareIn(BaseModel):
    amount: float = Field(..., gt=0)
    currency: str = "XOF"
    reason: Optional[str] = "Déclaration d'approvisionnement"


@router.get("")
async def get_float(user: dict = Depends(get_current_user)):
    agent = await _require_agent(user)
    # Retourne toutes les devises de float de l'agent
    items = await db.agent_floats.find({"agent_id": agent["id"]}, {"_id": 0}).to_list(20)
    if not items:
        default = await _get_or_create_float(agent["id"], "XOF")
        items = [default]
    return {"items": items}


@router.post("/declare")
async def declare_float(payload: DeclareIn, user: dict = Depends(get_current_user)):
    """Agent déclare un nouvel approvisionnement physique d'espèces.
    Remet à jour `balance += amount` et crée un mouvement traçable.
    """
    agent = await _require_agent(user)
    await _get_or_create_float(agent["id"], payload.currency)
    upd = await db.agent_floats.find_one_and_update(
        {"agent_id": agent["id"], "currency": payload.currency},
        {"$inc": {"balance": payload.amount}, "$set": {"declared_at": iso(now_utc()), "updated_at": iso(now_utc())}},
        return_document=True,
    )
    after = (upd or {}).get("balance", None)
    await record_float_movement(
        agent_id=agent["id"], movement_type="declare",
        amount_signed=payload.amount, currency=payload.currency,
        reason=payload.reason or "Déclaration d'approvisionnement",
        balance_after=after,
    )
    return {"ok": True, "balance": after, "currency": payload.currency}


class SettlementIn(BaseModel):
    amount: float = Field(..., gt=0)
    currency: str = "XOF"
    reason: Optional[str] = "Versement au siège"


@router.post("/settle")
async def settle_float(payload: SettlementIn, user: dict = Depends(get_current_user)):
    """Agent déclare un versement physique au siège (réduction du float)."""
    agent = await _require_agent(user)
    upd = await db.agent_floats.find_one_and_update(
        {"agent_id": agent["id"], "currency": payload.currency, "balance": {"$gte": payload.amount}},
        {"$inc": {"balance": -payload.amount}, "$set": {"updated_at": iso(now_utc())}},
        return_document=True,
    )
    if not upd:
        raise HTTPException(status_code=400, detail="Float insuffisant pour ce versement")
    after = (upd or {}).get("balance", None)
    await record_float_movement(
        agent_id=agent["id"], movement_type="settlement",
        amount_signed=-payload.amount, currency=payload.currency,
        reason=payload.reason or "Versement au siège",
        balance_after=after,
    )
    return {"ok": True, "balance": after, "currency": payload.currency}


@router.get("/movements")
async def list_movements(
    user: dict = Depends(get_current_user),
    limit: int = 50,
    currency: Optional[str] = None,
):
    agent = await _require_agent(user)
    q: dict = {"agent_id": agent["id"]}
    if currency:
        q["currency"] = currency
    items = await db.agent_float_movements.find(q, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return {"items": items}
