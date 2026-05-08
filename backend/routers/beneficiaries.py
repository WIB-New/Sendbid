"""Beneficiaries CRUD (max 100 per user)."""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from core.db import db, now_utc, iso, clean_doc
from core.deps import get_current_user
from core.security import gen_id

router = APIRouter(prefix="/beneficiaries", tags=["beneficiaries"])


class BeneficiaryIn(BaseModel):
    # Identité
    full_name: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    # Adresse
    country: str
    city: Optional[str] = None
    address: Optional[str] = None
    po_box: Optional[str] = None
    # Devise / relation
    currency: Optional[str] = None
    relation: Optional[str] = None
    # Mode de remise par défaut
    default_delivery_mode: Optional[str] = "cash"  # cash | bank | momo
    # Coordonnées bancaires
    bank_name: Optional[str] = None
    iban: Optional[str] = None
    bic_swift: Optional[str] = None
    bank_account: Optional[str] = None  # legacy
    # Mobile money
    momo_operator: Optional[str] = None
    momo_phone: Optional[str] = None
    momo_number: Optional[str] = None  # legacy alias


@router.get("")
async def list_beneficiaries(user: dict = Depends(get_current_user)):
    return await db.beneficiaries.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)


@router.post("")
async def create_beneficiary(payload: BeneficiaryIn, user: dict = Depends(get_current_user)):
    count = await db.beneficiaries.count_documents({"user_id": user["id"]})
    if count >= 100:
        raise HTTPException(status_code=400, detail="Limite de 100 bénéficiaires atteinte")
    data = payload.model_dump()
    # Compat momo: accept either momo_phone or momo_number
    if not data.get("momo_phone") and data.get("momo_number"):
        data["momo_phone"] = data["momo_number"]
    if not data.get("momo_number") and data.get("momo_phone"):
        data["momo_number"] = data["momo_phone"]
    doc = {"id": gen_id(), "user_id": user["id"], **data, "favorite": False, "created_at": iso(now_utc())}
    await db.beneficiaries.insert_one(dict(doc))
    return clean_doc(dict(doc))


@router.post("/{bid}/toggle-favorite")
async def toggle_favorite(bid: str, user: dict = Depends(get_current_user)):
    b = await db.beneficiaries.find_one({"id": bid, "user_id": user["id"]})
    if not b:
        raise HTTPException(status_code=404, detail="Bénéficiaire introuvable")
    new_val = not bool(b.get("favorite", False))
    await db.beneficiaries.update_one({"id": bid, "user_id": user["id"]}, {"$set": {"favorite": new_val}})
    return {"ok": True, "favorite": new_val}


@router.delete("/{bid}")
async def delete_beneficiary(bid: str, user: dict = Depends(get_current_user)):
    await db.beneficiaries.delete_one({"id": bid, "user_id": user["id"]})
    return {"ok": True}
