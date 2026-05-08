"""Misc: referral, loyalty, scheduled transfers, disputes, documents, support, countries."""
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from core.db import db, now_utc, iso, clean_doc
from core.deps import get_current_user
from core.security import gen_id
from routers.notifications import create_notification
from routers.transfers import TransferDraftIn

router = APIRouter(tags=["misc"])


class ScheduleTransferIn(BaseModel):
    draft: TransferDraftIn
    schedule_at: str
    recurrence: Optional[str] = None


class DisputeIn(BaseModel):
    transfer_id: str
    reason: str
    description: str


class ContactIn(BaseModel):
    subject: str
    message: str
    category: str = "general"


@router.get("/referral")
async def get_referral(user: dict = Depends(get_current_user)):
    code = f"SB-{user['profile_id']}"
    invites = await db.referrals.find({"referrer_id": user["id"]}, {"_id": 0}).to_list(100)
    return {"code": code, "share_url": f"https://sendbid.app/i/{code}",
            "invites": invites, "rewards_eur": len(invites) * 5.0}


@router.get("/loyalty")
async def get_loyalty(user: dict = Depends(get_current_user)):
    full = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    levels = [
        {"name": "Bronze", "min_points": 0, "perk": "Frais standards"},
        {"name": "Silver", "min_points": 100, "perk": "-10% sur les frais"},
        {"name": "Gold", "min_points": 500, "perk": "-20% + remises VIP"},
        {"name": "Platinum", "min_points": 2000, "perk": "Frais réduits + assistance prioritaire"},
    ]
    return {"level": full.get("loyalty_level", "Bronze"),
            "points": full.get("loyalty_points", 0), "levels": levels}


@router.get("/scheduled-transfers")
async def list_scheduled(user: dict = Depends(get_current_user)):
    return await db.scheduled_transfers.find({"user_id": user["id"]}, {"_id": 0}).sort("schedule_at", 1).to_list(50)


@router.post("/scheduled-transfers")
async def create_scheduled(payload: ScheduleTransferIn, user: dict = Depends(get_current_user)):
    doc = {
        "id": gen_id(), "user_id": user["id"],
        "draft": payload.draft.model_dump(),
        "schedule_at": payload.schedule_at,
        "recurrence": payload.recurrence or "once",
        "active": True, "created_at": iso(now_utc()),
    }
    await db.scheduled_transfers.insert_one(dict(doc))
    return clean_doc(dict(doc))


@router.delete("/scheduled-transfers/{sid}")
async def delete_scheduled(sid: str, user: dict = Depends(get_current_user)):
    await db.scheduled_transfers.delete_one({"id": sid, "user_id": user["id"]})
    return {"ok": True}


@router.get("/disputes")
async def list_disputes(user: dict = Depends(get_current_user)):
    return await db.disputes.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)


@router.post("/disputes")
async def create_dispute(payload: DisputeIn, user: dict = Depends(get_current_user)):
    doc = {"id": gen_id(), "user_id": user["id"], **payload.model_dump(),
           "status": "open", "created_at": iso(now_utc())}
    await db.disputes.insert_one(dict(doc))
    await create_notification(user["id"], "Litige enregistré", "Notre équipe support va vous contacter.")
    return clean_doc(dict(doc))


@router.get("/documents")
async def list_documents(user: dict = Depends(get_current_user)):
    return await db.documents.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)


@router.get("/support/faq")
async def support_faq():
    return [
        {"q": "Comment fonctionne l'enchère ?", "a": "Dès la création d'un transfert en espèces, jusqu'à 50 agents sont notifiés en 5 tours de 90 secondes. Vous voyez les offres en direct et pouvez accepter la meilleure ou laisser le système choisir."},
        {"q": "Qu'est-ce que le code de retrait ?", "a": "Un code à 10 chiffres généré côté serveur, à fournir au bénéficiaire. L'agent vérifie ce code + scanne le QR signé pour remettre l'argent."},
        {"q": "Combien de temps mon QR est-il valide ?", "a": "48 heures à partir de la création du transfert."},
        {"q": "Comment recharger Floo Money ?", "a": "Générez un QR de recharge dans le wallet et présentez-le à un agent SENDBID partenaire."},
        {"q": "Combien puis-je envoyer ?", "a": "KYC Tier 0: 200€/mois — Tier 1: 2 000€/mois — Tier 2: 10 000€/mois — Platinum: illimité."},
        {"q": "Frais réels ?", "a": "Modulables 1-5% via le système d'enchères. SENDBID absorbe les frais ≤2% si non acceptés."},
    ]


@router.post("/support/contact")
async def support_contact(payload: ContactIn, user: dict = Depends(get_current_user)):
    doc = {"id": gen_id(), "user_id": user["id"], **payload.model_dump(),
           "status": "open", "created_at": iso(now_utc())}
    await db.support_tickets.insert_one(dict(doc))
    await create_notification(user["id"], "Message reçu", "Notre équipe vous répondra sous 24h.")
    return clean_doc(dict(doc))


@router.get("/countries")
async def countries():
    """DEPRECATED — kept for backward compatibility.
    Prefer /api/countries/sending (open registration) and /api/corridors (destinations).
    Returns the receiving countries pulled dynamically from the corridors collection.
    """
    rows = await db.corridors.find({"active": True}, {"_id": 0}).sort("country_name", 1).to_list(200)
    out = []
    for c in rows:
        if (c.get("agents_count") or 0) <= 0 and not c.get("bank_partner") and not c.get("momo_partner"):
            continue
        out.append({
            "code": c["country_code"],
            "name": c["country_name"],
            "currency": c["currency"],
            "flag": c.get("flag", ""),
        })
    return out
