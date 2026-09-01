"""Wallet operations module."""
from datetime import timedelta
from typing import Optional

from fastapi import Depends, HTTPException

from core.db import db, now_utc, iso
from core.deps import get_current_user, require_pin
from core.security import gen_id, sign_qr_payload
from routers.notifications import create_notification
from services.payouts import (
    PAYOUT_PROVIDER,
    PayoutError,
    get_user_connect_account,
    refresh_connect_status,
    start_connect_onboarding,
)

from . import router
from .models import P2PTransferIn, BankWithdrawIn


@router.post("/withdraw")
async def wallet_withdraw(payload: BankWithdrawIn, user: dict = Depends(get_current_user)):
    """v6 — Bank withdraw to IBAN. Used by /wallet/bank-transfer.
    Debits the wallet atomically and creates a pending payout_request doc
    that will be processed by the operations team (SEPA settlement D+1/D+3).
    PIN obligatoire (sécurité : retrait bancaire = opération sensible).
    """
    if not payload.pin or len(payload.pin) != 6:
        raise HTTPException(status_code=400, detail="Code PIN à 6 chiffres requis")
    await require_pin(user["id"], payload.pin)
    if payload.amount <= 0:
        raise HTTPException(status_code=400, detail="Montant invalide")
    if payload.method not in ("bank", "sepa"):
        raise HTTPException(status_code=400, detail="Méthode non supportée (bank uniquement)")
    details = payload.details or {}
    if not details.get("iban") or not details.get("holder"):
        raise HTTPException(status_code=400, detail="IBAN et titulaire requis")
    fee = 1.0  # 1 EUR flat SEPA fee
    total = payload.amount + fee
    # Atomic debit — fail if balance insufficient
    upd = await db.wallets.find_one_and_update(
        {"user_id": user["id"], "balance": {"$gte": total}},
        {"$inc": {"balance": -total}},
    )
    if not upd:
        raise HTTPException(status_code=400, detail="Solde insuffisant (frais 1 EUR inclus)")
    tx_id = gen_id()
    tx = {
        "id": tx_id,
        "user_id": user["id"],
        "type": "withdraw_bank",
        "amount": -total,
        "amount_signed": -total,
        "currency": "EUR",
        "label": f"Virement bancaire vers {str(details.get('iban'))[-4:]}",
        "meta": {"iban": details.get("iban"), "holder": details.get("holder"), "bank": details.get("bank"), "bic": details.get("bic"), "fee": fee},
        "status": "PROCESSING",
        "created_at": iso(now_utc()),
    }
    await db.wallet_tx.insert_one(tx)
    # Stripe Connect : le bénéficiaire doit avoir un compte lié et prêt
    connected_account_id = None
    if PAYOUT_PROVIDER == "stripe":
        record = await get_user_connect_account(user["id"])
        if not record or not record.get("account_id") or not record.get("ready"):
            raise HTTPException(
                status_code=400,
                detail="Veuillez d'abord créer/finaliser votre compte Stripe Connect pour les retraits."
            )
        connected_account_id = record["account_id"]

    payout = {
        "id": gen_id(),
        "user_id": user["id"],
        "wallet_tx_id": tx_id,
        "amount": payload.amount,
        "fee": fee,
        "iban": details.get("iban"),
        "holder": details.get("holder"),
        "bank": details.get("bank"),
        "bic": details.get("bic"),
        "connected_account_id": connected_account_id,
        "status": "PENDING",
        "eta_days": 3,
        "created_at": iso(now_utc()),
    }
    await db.payout_requests.insert_one(payout)
    await create_notification(
        user["id"],
        "Virement bancaire initié",
        f"Votre virement de {payload.amount:.2f} EUR sera crédité sous 1 à 3 jours ouvrés.",
        "wallet",
    )
    return {
        "ok": True,
        "tx_id": tx_id,
        "payout_id": payout["id"],
        "eta_days": 3,
        "fee": fee,
        "provider": PAYOUT_PROVIDER,
        "connected_account_id": connected_account_id,
    }


@router.post("/connect/onboarding")
async def connect_onboarding(user: dict = Depends(get_current_user)):
    """Crée un compte Stripe Connect et renvoie le lien d'onboarding."""
    try:
        result = await start_connect_onboarding(user)
    except PayoutError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return result


@router.get("/connect/status")
async def connect_status(user: dict = Depends(get_current_user)):
    """Rafraîchit et renvoie l'état du compte Stripe Connect."""
    return await refresh_connect_status(user["id"])




@router.post("/withdraw-qr")
async def wallet_withdraw_qr(body: dict, user: dict = Depends(get_current_user)):
    amount = float(body.get("amount", 0))
    pin = body.get("pin", "")
    await require_pin(user["id"], pin)
    wallet = await db.wallets.find_one({"user_id": user["id"]})
    if amount <= 0 or wallet["balance"] < amount:
        raise HTTPException(status_code=400, detail="Solde insuffisant")
    payload = {
        "type": "withdraw", "user_id": user["id"], "profile_id": user["profile_id"],
        "amount": amount, "currency": wallet["currency"],
        "exp": iso(now_utc() + timedelta(minutes=15)),
    }
    return {"qr_token": sign_qr_payload(payload), "expires_at": payload["exp"], "amount": amount}


