"""Wallet operations module."""
from datetime import timedelta
from typing import Optional

from fastapi import Depends, HTTPException

from core.db import db, now_utc, iso
from core.deps import get_current_user, require_pin
from core.security import gen_id, sign_qr_payload
from routers.notifications import create_notification

from . import router



@router.get("")
async def get_wallet(user: dict = Depends(get_current_user)):
    return await db.wallets.find_one({"user_id": user["id"]}, {"_id": 0})


@router.get("/transactions")
async def wallet_transactions(user: dict = Depends(get_current_user), limit: int = 50):
    return await db.wallet_tx.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(limit)


@router.get("/transactions/{tx_id}")
async def wallet_transaction_detail(tx_id: str, user: dict = Depends(get_current_user)):
    """Retourne le détail d'une opération wallet précise (utilisé par l'écran wise-style /wallet/op/[id]).
    
    Sécurité : l'opération ne peut être consultée que par son propriétaire.
    Si l'opération est rattachée à un transfert (transfer_id), on enrichit la réponse
    avec un sous-objet 'transfer' contenant le détail complet du transfert.
    """
    tx = await db.wallet_tx.find_one({"id": tx_id, "user_id": user["id"]}, {"_id": 0})
    if not tx:
        raise HTTPException(status_code=404, detail="Opération introuvable")
    # Enrichissement transfert si rattachée
    if tx.get("transfer_id"):
        tr = await db.transfers.find_one({"id": tx["transfer_id"]}, {"_id": 0})
        if tr:
            tx["transfer"] = tr
    return tx


