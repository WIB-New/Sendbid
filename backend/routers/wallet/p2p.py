"""Wallet operations module."""
from datetime import timedelta
from typing import Optional

from fastapi import Depends, HTTPException

from core.db import db, now_utc, iso
from core.deps import get_current_user, require_pin
from core.security import gen_id, sign_qr_payload
from routers.notifications import create_notification

from . import router
from .models import P2PTransferIn


@router.post("/p2p")
async def wallet_p2p(payload: P2PTransferIn, user: dict = Depends(get_current_user)):
    """Atomic P2P transfer: balance debit guarded by find_one_and_update with conditional filter."""
    await require_pin(user["id"], payload.pin)
    if payload.amount <= 0:
        raise HTTPException(status_code=400, detail="Montant invalide")

    ident = payload.recipient_identifier.strip()
    recipient = await db.users.find_one({"$or": [
        {"email": ident.lower()}, {"phone": ident}, {"profile_id": ident.upper()},
    ]})
    if not recipient:
        raise HTTPException(status_code=404, detail="Destinataire introuvable")
    if recipient["id"] == user["id"]:
        raise HTTPException(status_code=400, detail="Impossible de s'envoyer à soi-même")

    # Atomic conditional debit: only succeeds if balance >= amount
    debited = await db.wallets.find_one_and_update(
        {"user_id": user["id"], "balance": {"$gte": payload.amount}},
        {"$inc": {"balance": -payload.amount}},
        return_document=True,
    )
    if not debited:
        raise HTTPException(status_code=400, detail="Solde insuffisant")

    # Credit recipient
    credited = await db.wallets.find_one_and_update(
        {"user_id": recipient["id"]},
        {"$inc": {"balance": payload.amount}},
        return_document=True,
    )
    if not credited:
        # Rollback sender
        await db.wallets.update_one({"user_id": user["id"]}, {"$inc": {"balance": payload.amount}})
        raise HTTPException(status_code=500, detail="Crédit destinataire échoué — débit annulé")

    tx_id = gen_id()
    currency = debited.get("currency", "EUR")
    await db.wallet_tx.insert_many([
        {"id": tx_id + "-s", "user_id": user["id"], "type": "p2p_out", "amount": -payload.amount,
         "currency": currency, "counterparty": recipient["full_name"], "note": payload.note,
         "created_at": iso(now_utc())},
        {"id": tx_id + "-r", "user_id": recipient["id"], "type": "p2p_in", "amount": payload.amount,
         "currency": currency, "counterparty": user["full_name"], "note": payload.note,
         "created_at": iso(now_utc())},
    ])
    await create_notification(recipient["id"], "Virement P2P reçu",
                              f"{user['full_name']} vous a envoyé {payload.amount:.2f} {currency}")
    new_balance = debited.get("balance", 0)  # find_one_and_update returns AFTER document
    return {"ok": True, "new_balance": new_balance}
