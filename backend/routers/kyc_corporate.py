"""KYC Corporate (Personnes morales) router — v6.

3 niveaux :
- Niveau 1 : Infos de base (raison sociale, forme, RCS/SIRET, pays, contact)
- Niveau 2 : Documents légaux (Kbis, statuts, attestation fiscale, liste bénéficiaires effectifs)
- Niveau 3 : Représentant légal (ID + selfie + preuve d'adresse)
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from core.db import db, now_utc, iso
from core.deps import get_current_user
from core.security import gen_id

router = APIRouter(prefix="/kyc/corporate", tags=["kyc-corporate"])


class Level1In(BaseModel):
    legal_name: str
    entity_type: str  # SAS/SA/SARL/EURL/Association/ONG/Autre
    registration_number: str  # SIRET/RCS/num. association
    country: str  # ISO 2
    registration_date: Optional[str] = None
    legal_address: Optional[str] = None
    legal_city: Optional[str] = None
    legal_postal_code: Optional[str] = None
    activity_code: Optional[str] = None  # NAF/NACE
    contact_email: str
    contact_phone: str


class Level2In(BaseModel):
    kbis_url: str  # base64 ou URL temporaire
    statutes_url: str
    tax_attestation_url: Optional[str] = None
    ubos: List[dict]  # Bénéficiaires effectifs : [{full_name, dob, nationality, ownership_pct}]


class Level3In(BaseModel):
    representative_full_name: str
    representative_dob: str
    representative_nationality: str
    representative_role: str  # président/gérant/directeur
    id_front_url: str
    id_back_url: Optional[str] = None
    selfie_url: str
    address_proof_url: str


async def _get_or_create(user_id: str) -> dict:
    doc = await db.kyc_corporate.find_one({"user_id": user_id}, {"_id": 0})
    if doc:
        return doc
    doc = {
        "id": gen_id(), "user_id": user_id,
        "level": 0, "status": "NOT_STARTED",
        "created_at": iso(now_utc()),
    }
    await db.kyc_corporate.insert_one(dict(doc))
    return doc


@router.get("")
async def get_status(user: dict = Depends(get_current_user)):
    return await _get_or_create(user["id"])


@router.post("/level1")
async def submit_level1(payload: Level1In, user: dict = Depends(get_current_user)):
    await _get_or_create(user["id"])
    await db.kyc_corporate.update_one(
        {"user_id": user["id"]},
        {"$set": {
            "level1": payload.model_dump(),
            "level": 1,
            "status": "PENDING_REVIEW",
            "level1_submitted_at": iso(now_utc()),
        }},
    )
    return {"ok": True, "level": 1, "status": "PENDING_REVIEW"}


@router.post("/level2")
async def submit_level2(payload: Level2In, user: dict = Depends(get_current_user)):
    cur = await _get_or_create(user["id"])
    if (cur.get("level") or 0) < 1:
        raise HTTPException(status_code=400, detail="Complétez d'abord le Niveau 1")
    await db.kyc_corporate.update_one(
        {"user_id": user["id"]},
        {"$set": {
            "level2": payload.model_dump(),
            "level": 2,
            "status": "PENDING_REVIEW",
            "level2_submitted_at": iso(now_utc()),
        }},
    )
    return {"ok": True, "level": 2, "status": "PENDING_REVIEW"}


@router.post("/level3")
async def submit_level3(payload: Level3In, user: dict = Depends(get_current_user)):
    cur = await _get_or_create(user["id"])
    if (cur.get("level") or 0) < 2:
        raise HTTPException(status_code=400, detail="Complétez d'abord les Niveaux 1 et 2")
    await db.kyc_corporate.update_one(
        {"user_id": user["id"]},
        {"$set": {
            "level3": payload.model_dump(),
            "level": 3,
            "status": "PENDING_REVIEW",
            "level3_submitted_at": iso(now_utc()),
        }},
    )
    # Auto-approve for demo (48h délai réel en production via équipe compliance)
    await db.kyc_corporate.update_one(
        {"user_id": user["id"]},
        {"$set": {"status": "APPROVED", "approved_at": iso(now_utc())}},
    )
    # Unlock corporate limits : 500k EUR annuel
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"corporate_verified": True, "corporate_limit_annual": 500000}},
    )
    return {"ok": True, "level": 3, "status": "APPROVED"}
