"""Wallet (Floo Money) router: balance, transactions, recharge QR, withdraw QR (PIN), atomic P2P (PIN)."""
from datetime import timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from core.db import db, now_utc, iso
from core.deps import get_current_user, require_pin
from core.security import gen_id, sign_qr_payload
from routers.notifications import create_notification

router = APIRouter(prefix="/wallet", tags=["wallet"])


class P2PTransferIn(BaseModel):
    recipient_identifier: str
    amount: float
    note: Optional[str] = None
    pin: str



class BankWithdrawIn(BaseModel):
    amount: float
    method: str = "bank"
    details: dict
    pin: str


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
    return {"ok": True, "tx_id": tx_id, "payout_id": payout["id"], "eta_days": 3, "fee": fee}



@router.get("")
async def get_wallet(user: dict = Depends(get_current_user)):
    return await db.wallets.find_one({"user_id": user["id"]}, {"_id": 0})


@router.get("/transactions")
async def wallet_transactions(user: dict = Depends(get_current_user), limit: int = 50):
    return await db.wallet_tx.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(limit)


@router.post("/recharge-qr")
async def wallet_recharge_qr(body: dict, user: dict = Depends(get_current_user)):
    amount = float(body.get("amount", 0))
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Montant invalide")
    payload = {
        "type": "recharge", "user_id": user["id"], "profile_id": user["profile_id"],
        "amount": amount, "currency": "EUR",
        "exp": iso(now_utc() + timedelta(minutes=15)),
    }
    return {"qr_token": sign_qr_payload(payload), "expires_at": payload["exp"], "amount": amount}


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
