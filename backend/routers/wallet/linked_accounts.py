"""Comptes de paiement liés au wallet (carte, bank, MoMo, PayPal)."""
import re
from typing import Optional, List
from fastapi import Depends, HTTPException
from pydantic import BaseModel, Field

from core.db import db, now_utc, iso
from core.security import gen_id
from core.deps import get_current_user

from . import router


class LinkedAccountIn(BaseModel):
    type: str = Field(..., pattern="^(bank|momo|paypal)$")
    label: Optional[str] = None
    identifier: str = Field(..., min_length=1)
    operator: Optional[str] = None
    bank_name: Optional[str] = None
    country: Optional[str] = None


class LinkedAccountUpdateIn(BaseModel):
    label: Optional[str] = None
    identifier: Optional[str] = None
    operator: Optional[str] = None
    bank_name: Optional[str] = None
    # Remettre à pending en cas de modification pour re-vérification
    status: Optional[str] = None


@router.get("/linked-accounts")
async def list_linked_accounts(user: dict = Depends(get_current_user)):
    """Liste les comptes de paiement liés à l'utilisateur courant."""
    return await db.linked_accounts.find(
        {"user_id": user["id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(100)


@router.post("/linked-accounts")
async def create_linked_account(body: LinkedAccountIn, user: dict = Depends(get_current_user)):
    """Ajoute un nouveau compte de paiement lié."""
    # Éviter les doublons actifs sur le même identifiant + type
    existing = await db.linked_accounts.find_one({
        "user_id": user["id"],
        "type": body.type,
        "identifier": body.identifier,
        "status": {"$ne": "deleted"},
    })
    if existing:
        raise HTTPException(status_code=409, detail="Ce compte est déjà lié")

    account = {
        "id": gen_id(),
        "user_id": user["id"],
        "profile_id": user.get("profile_id"),
        "type": body.type,
        "label": body.label or body.identifier,
        "identifier": body.identifier,
        "operator": body.operator,
        "bank_name": body.bank_name,
        "country": body.country or user.get("country"),
        "status": "pending",
        "created_at": iso(now_utc()),
    }
    await db.linked_accounts.insert_one(account)
    return {**account, "_id": 0}


@router.put("/linked-accounts/{account_id}")
async def update_linked_account(account_id: str, body: LinkedAccountUpdateIn, user: dict = Depends(get_current_user)):
    """Met à jour un compte lié (ex: correction d'IBAN ou numéro erroné)."""
    patch = {k: v for k, v in body.model_dump(exclude_none=True).items() if v is not None}
    if not patch:
        raise HTTPException(status_code=400, detail="Aucune modification fournie")
    # Si l'identifiant ou un champ clé change, on remet en pending pour re-vérification
    if any(k in patch for k in ("identifier", "operator", "bank_name")):
        patch["status"] = "pending"
    patch["updated_at"] = iso(now_utc())
    res = await db.linked_accounts.update_one(
        {"id": account_id, "user_id": user["id"], "status": {"$ne": "deleted"}},
        {"$set": patch},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Compte introuvable")
    fresh = await db.linked_accounts.find_one({"id": account_id}, {"_id": 0})
    return fresh


def _validate_account(acc: dict) -> tuple[bool, str]:
    """Validation automatique de base (format). Retourne (ok, message)."""
    t = acc.get("type")
    ident = (acc.get("identifier") or "").strip()
    if t == "bank":
        raw = ident.replace(" ", "")
        if len(raw) < 14:
            return False, "IBAN trop court (minimum 14 caractères)"
        if not re.match(r"^[A-Z]{2}\\d{2}", raw):
            return False, "IBAN invalide (doit commencer par un code pays, ex: FR14)"
        return True, "Compte bancaire vérifié"
    if t == "momo":
        raw = re.sub(r"\\D", "", ident)
        if len(raw) < 8:
            return False, "Numéro Mobile Money incomplet"
        if not acc.get("operator"):
            return False, "Opérateur Mobile Money manquant"
        return True, "Compte Mobile Money vérifié"
    if t == "paypal":
        if not re.match(r"^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$", ident):
            return False, "Email PayPal invalide"
        return True, "Compte PayPal vérifié"
    return False, "Type de compte inconnu"


@router.post("/linked-accounts/{account_id}/verify")
async def verify_linked_account(account_id: str, user: dict = Depends(get_current_user)):
    """Vérification automatique d'un compte lié (validation de format + simulation d'approbation).

    En production ce endpoint serait remplacé par un webhook opérateur/banque,
    ou appellerait une API externe de vérification. Ici on valide les règles de
    format et on approuve immédiatement si elles sont respectées.
    """
    acc = await db.linked_accounts.find_one({"id": account_id, "user_id": user["id"], "status": {"$ne": "deleted"}}, {"_id": 0})
    if not acc:
        raise HTTPException(status_code=404, detail="Compte introuvable")
    ok, msg = _validate_account(acc)
    new_status = "active" if ok else "rejected"
    await db.linked_accounts.update_one(
        {"id": account_id},
        {"$set": {"status": new_status, "verified_at": iso(now_utc()), "verification_note": msg}},
    )
    return {"ok": ok, "status": new_status, "message": msg}


@router.delete("/linked-accounts/{account_id}")
async def delete_linked_account(account_id: str, user: dict = Depends(get_current_user)):
    """Supprime (soft-delete) un compte lié."""
    res = await db.linked_accounts.update_one(
        {"id": account_id, "user_id": user["id"]},
        {"$set": {"status": "deleted", "deleted_at": iso(now_utc())}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Compte introuvable")
    return {"ok": True}
