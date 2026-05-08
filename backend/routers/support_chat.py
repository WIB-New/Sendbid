"""Support live chat — ticket + message thread persistant.

Un ticket de support est ouvert par utilisateur dès qu'il poste un premier message.
Les messages sont stockés dans MongoDB. Le backend répond de manière automatique
(bot FAQ) en attendant la connexion d'un opérateur humain.

Endpoints :
  POST /api/support/chat/open          → crée ou retrouve le ticket ouvert
  GET  /api/support/chat/messages      → liste les messages (derniers 100)
  POST /api/support/chat/send          → envoie un message utilisateur, renvoie
                                          la réponse bot (et crée un message bot)
  POST /api/support/chat/close         → ferme le ticket (côté user)
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional

from core.db import db, now_utc, iso
from core.deps import get_current_user
import uuid

def gen_id() -> str:
    return str(uuid.uuid4())

router = APIRouter(prefix="/support/chat", tags=["support-chat"])


class SendMsgIn(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)


# --- Bot FAQ (simple pattern-match) ----------------------------------------
FAQ_PATTERNS = [
    (["bonjour", "salut", "hello", "hi", "bjr"],
     "Bonjour 👋, je suis l'assistant virtuel SENDBID. Je vous oriente en attendant qu'un conseiller se connecte. Décrivez votre problème ou choisissez un sujet : transfert, KYC, remboursement, sécurité, connexion."),
    (["merci", "thanks"],
     "Avec plaisir ! N'hésitez pas si vous avez une autre question. 😊"),
    (["transfert", "bloqué", "bloquer", "en cours", "statut"],
     "Pour suivre un transfert, allez dans l'onglet Transferts → cliquez sur le transfert pour voir son statut en temps réel. Si le statut est bloqué depuis plus de 24h, notre équipe interviendra. Puis-je avoir le numéro du transfert (format TRF-xxxx) ?"),
    (["kyc", "vérification", "identité", "pièce"],
     "La vérification KYC se fait en 3 tiers : Tier 1 (pièce d'identité, 2 min) → Tier 2 (justificatif de domicile + selfie, 5 min, résultat sous 24h) → Tier 3 (renforcé). Allez dans Profil → Vérification KYC. Une erreur précise ? (document refusé, délai, flou…)"),
    (["remboursement", "rembourser", "annulation", "annuler"],
     "La politique de remboursement dépend du statut : avant assignation d'un agent → remboursement intégral instantané. Après assignation → frais de 5% retenus. Après remise → non annulable (ouvrir un litige). Quel est le numéro du transfert ?"),
    (["pin", "mot de passe", "password", "oublié", "oubli"],
     "Vous pouvez réinitialiser votre mot de passe depuis l'écran de connexion → « Mot de passe oublié ». Pour changer votre PIN, allez dans Profil → Paramètres → Changer le code PIN. Si votre compte est bloqué, dites-nous votre email."),
    (["agent", "enchère", "enchere", "payeur"],
     "SENDBID utilise un système d'enchères inversées : dès que vous confirmez un transfert, nos agents locaux soumettent leur meilleur tarif pendant 3 minutes. Le gagnant est automatiquement assigné. Aucune action de votre part n'est requise."),
    (["frais", "coût", "cout", "tarif", "taux"],
     "Les frais sont déterminés par l'enchère des agents (transparent, visible avant validation). En moyenne 1,5% à 5% selon le corridor et le mode de remise. Le taux de change est celui du marché + marge 0,5 à 2%."),
    (["sécurité", "securite", "piraté", "pirate", "fraude"],
     "Si vous suspectez un piratage : (1) changez immédiatement votre mot de passe, (2) contactez-nous par email support@sendbid.app avec objet URGENCE PIRATAGE, (3) nous bloquons votre compte sous 30 min. Votre email SENDBID ?"),
    (["conseiller", "humain", "agent support", "opérateur"],
     "Un conseiller humain va rejoindre la conversation sous 2-5 minutes (ouvert 24/7). En attendant, décrivez votre problème avec un maximum de détails (numéros, captures, email concerné)."),
    (["corridors", "pays", "destination"],
     "SENDBID couvre plus de 250 pays. Parmi les corridors les plus rapides : France → Sénégal, Côte d'Ivoire, Mali, Maroc, Cameroun (remise en < 30 min). Pour voir la liste complète, faites un nouveau transfert et tapez le pays dans la recherche."),
]


def _bot_response(message: str) -> str:
    low = message.lower().strip()
    for keywords, response in FAQ_PATTERNS:
        if any(kw in low for kw in keywords):
            return response
    return (
        "Je n'ai pas de réponse automatique pour cette question. Un conseiller humain va vous répondre "
        "dès que possible (généralement sous 5 minutes). En attendant, vous pouvez : consulter notre FAQ "
        "(Profil → FAQ), ou joindre une capture d'écran si pertinent. Merci pour votre patience ! 🙏"
    )


# --- Endpoints --------------------------------------------------------------
async def _get_or_create_ticket(user_id: str) -> dict:
    t = await db.support_tickets.find_one({"user_id": user_id, "status": "open"})
    if t:
        return t
    t = {
        "id": gen_id(),
        "user_id": user_id,
        "status": "open",
        "created_at": iso(now_utc()),
        "updated_at": iso(now_utc()),
    }
    await db.support_tickets.insert_one(t)
    # Message de bienvenue automatique
    await db.support_messages.insert_one({
        "id": gen_id(),
        "ticket_id": t["id"],
        "sender": "bot",
        "text": (
            "Bonjour 👋 ! Je suis l'assistant SENDBID, je vous aide pendant qu'un "
            "conseiller humain rejoint la conversation. Comment puis-je vous aider ?"
        ),
        "created_at": iso(now_utc()),
    })
    return t


@router.post("/open")
async def open_chat(user: dict = Depends(get_current_user)):
    t = await _get_or_create_ticket(user["id"])
    return {"ticket_id": t["id"], "status": t["status"], "created_at": t["created_at"]}


@router.get("/messages")
async def get_messages(user: dict = Depends(get_current_user)):
    t = await _get_or_create_ticket(user["id"])
    cursor = db.support_messages.find({"ticket_id": t["id"]}).sort("created_at", 1).limit(100)
    msgs = await cursor.to_list(length=100)
    for m in msgs:
        m.pop("_id", None)
    return {"ticket_id": t["id"], "messages": msgs}


@router.post("/send")
async def send_message(payload: SendMsgIn, user: dict = Depends(get_current_user)):
    t = await _get_or_create_ticket(user["id"])
    user_msg = {
        "id": gen_id(),
        "ticket_id": t["id"],
        "sender": "user",
        "text": payload.message.strip(),
        "created_at": iso(now_utc()),
    }
    await db.support_messages.insert_one(user_msg)
    # Réponse bot
    bot_msg = {
        "id": gen_id(),
        "ticket_id": t["id"],
        "sender": "bot",
        "text": _bot_response(payload.message),
        "created_at": iso(now_utc()),
    }
    await db.support_messages.insert_one(bot_msg)
    await db.support_tickets.update_one({"id": t["id"]}, {"$set": {"updated_at": iso(now_utc())}})
    user_msg.pop("_id", None)
    bot_msg.pop("_id", None)
    return {"ticket_id": t["id"], "user_message": user_msg, "bot_reply": bot_msg}


@router.post("/close")
async def close_chat(user: dict = Depends(get_current_user)):
    t = await db.support_tickets.find_one({"user_id": user["id"], "status": "open"})
    if not t:
        raise HTTPException(status_code=404, detail="Aucun ticket ouvert")
    await db.support_tickets.update_one({"id": t["id"]}, {"$set": {"status": "closed", "closed_at": iso(now_utc())}})
    return {"ok": True}
