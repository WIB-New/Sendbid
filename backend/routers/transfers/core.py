"""Core transfer endpoints : fx-rate, draft, confirm, list, get, validate-code, extend-pickup."""
import asyncio
import logging
from datetime import timedelta
from typing import Optional

from fastapi import Depends, HTTPException

from core.db import db, now_utc, iso, clean_doc
from core.deps import get_current_user, require_pin
from core.security import gen_id, gen_withdrawal_code, sign_qr_payload
from routers.notifications import create_notification

from . import router
from .models import TransferDraftIn, ConfirmTransferIn, ValidateCodeIn, ExtendPickupIn

logger = logging.getLogger("sendbid.transfers.core")


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
    vip_fee = round(max(0.0, float(payload.vip_fee_amount or 0.0)), 2)
    total = round(payload.send_amount + fee_amount + vip_fee, 2)
    draft = {
        "id": draft_id, "user_id": user["id"],
        "destination_country": payload.destination_country,
        "destination_currency": payload.destination_currency,
        "send_amount": payload.send_amount, "receive_amount": payload.receive_amount,
        "fx_rate": payload.fx_rate, "fee_percent": payload.fee_percent,
        "fee_amount": fee_amount,
        "vip_fee_amount": vip_fee,
        "total_amount": total,
        "delivery_mode": payload.delivery_mode, "beneficiary": payload.beneficiary,
        "delivery_details": payload.delivery_details or {},
        "purpose": payload.purpose, "source_of_funds": payload.source_of_funds,
        "vip_delivery": payload.vip_delivery,
        "vip_express": payload.vip_express,
        "status": "DRAFT",
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

    from .auction import start_auction, simulate_non_cash_delivery
    if draft["delivery_mode"] == "cash":
        await start_auction(transfer_id)
    else:
        asyncio.create_task(simulate_non_cash_delivery(transfer_id))

    await create_notification(user["id"], "Transfert créé", f"Code retrait: {withdrawal_code}")
    return clean_doc(dict(transfer))


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
    """Retourne le détail d'un transfert.
    
    Autorisations :
      - L'expéditeur (user_id)
      - L'agent assigné (agent.user_id == user.id, qu'il soit pending, processing, ou completed)
      - L'admin / super-admin (accès complet)
    """
    role = user.get("role")
    is_admin = role in ("admin", "super_admin", "partner_admin")
    
    # 1) Tentative en tant qu'expéditeur (le cas le plus fréquent)
    t = await db.transfers.find_one({"id": transfer_id, "user_id": user["id"]}, {"_id": 0})
    
    # 2) Si pas trouvé et c'est un agent → tenter en tant qu'agent assigné
    if not t and role in ("agent", "agent_admin", "super_agent"):
        # L'agent_id est stocké directement sur le user (cf core.deps._require_agent)
        agent_id = user.get("agent_id")
        if agent_id:
            t = await db.transfers.find_one(
                {"id": transfer_id, "agent_id": agent_id}, {"_id": 0}
            )
    
    # 3) Si pas trouvé et c'est un admin → accès complet
    if not t and is_admin:
        t = await db.transfers.find_one({"id": transfer_id}, {"_id": 0})
    
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
