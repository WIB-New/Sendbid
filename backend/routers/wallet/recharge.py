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


@router.post("/recharge-qr")
async def wallet_recharge_qr(body: dict, user: dict = Depends(get_current_user)):
    """Génère un QR code de dépôt en espèces (signé HMAC, 15 min).
    PIN obligatoire pour confirmer l'intention de dépôt côté client.
    L'agent scannera ce QR depuis PAYBID puis encaissera les fonds en présence.
    """
    amount = float(body.get("amount", 0))
    pin = body.get("pin", "")
    if not pin or len(pin) != 6:
        raise HTTPException(status_code=400, detail="Code PIN à 6 chiffres requis")
    await require_pin(user["id"], pin)
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Montant invalide")
    payload = {
        "type": "recharge", "user_id": user["id"], "profile_id": user["profile_id"],
        "amount": amount, "currency": "EUR",
        "exp": iso(now_utc() + timedelta(minutes=15)),
    }
    # Persist a pending deposit record so the agent can list/validate
    deposit_id = gen_id()
    await db.cash_deposits.insert_one({
        "id": deposit_id, "user_id": user["id"], "profile_id": user["profile_id"],
        "full_name": user.get("full_name"),
        "amount": amount, "currency": "EUR", "status": "PENDING",
        "created_at": iso(now_utc()),
        "expires_at": payload["exp"],
    })
    return {
        "qr_token": sign_qr_payload(payload),
        "expires_at": payload["exp"],
        "amount": amount,
        "deposit_id": deposit_id,
    }


