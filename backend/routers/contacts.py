"""Contacts (P2P social network) — manage user's contacts list with actions."""
from typing import Optional, List
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from core.db import db, now_utc, iso, clean_doc
from core.deps import get_current_user
from core.security import gen_id

router = APIRouter(prefix="/contacts", tags=["contacts"])


class ContactIn(BaseModel):
    full_name: str
    profile_id: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None


class ReportIn(BaseModel):
    reason: Optional[str] = "Comportement indélicat"


@router.get("")
async def list_contacts(user: dict = Depends(get_current_user)) -> List[dict]:
    items = await db.contacts.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    if not items:
        # Pas de contacts — on retourne une liste vide (frontend peut afficher un onboarding)
        return []
    return items


@router.post("")
async def add_contact(payload: ContactIn, user: dict = Depends(get_current_user)) -> dict:
    doc = {
        "id": gen_id(),
        "user_id": user["id"],
        "full_name": payload.full_name,
        "profile_id": payload.profile_id,
        "email": payload.email,
        "phone": payload.phone,
        "created_at": iso(now_utc()),
    }
    await db.contacts.insert_one(dict(doc))
    return clean_doc(dict(doc))


@router.delete("/{cid}")
async def delete_contact(cid: str, user: dict = Depends(get_current_user)) -> dict:
    res = await db.contacts.delete_one({"id": cid, "user_id": user["id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Contact introuvable")
    return {"ok": True}


@router.post("/{cid}/report")
async def report_contact(cid: str, payload: ReportIn, user: dict = Depends(get_current_user)) -> dict:
    """Signaler un contact. Crée un ticket de modération."""
    contact = await db.contacts.find_one({"id": cid, "user_id": user["id"]})
    if not contact:
        raise HTTPException(status_code=404, detail="Contact introuvable")
    ticket = {
        "id": gen_id(),
        "type": "contact_report",
        "reporter_id": user["id"],
        "reporter_name": user.get("full_name"),
        "target_id": cid,
        "target_name": contact.get("full_name"),
        "target_profile_id": contact.get("profile_id"),
        "reason": payload.reason or "Non précisé",
        "status": "PENDING_REVIEW",
        "created_at": iso(now_utc()),
    }
    await db.moderation_tickets.insert_one(dict(ticket))
    return {"ok": True, "ticket_id": ticket["id"]}
