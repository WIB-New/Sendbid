"""3-party chat (sender + agent + beneficiary) tied to transfer lifecycle."""
import asyncio
import random
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from core.db import db, now_utc, iso, clean_doc
from core.deps import get_current_user
from core.security import gen_id

router = APIRouter(prefix="/transfers", tags=["chat"])


class ChatMessageIn(BaseModel):
    transfer_id: str
    content: str


async def _resolve_chat_access(transfer_id: str, user: dict) -> tuple[dict, str]:
    """Renvoie (transfer, role) si l'utilisateur a le droit d'accéder au chat.
    Role parmi : 'sender' (expéditeur), 'agent', 'admin', 'beneficiary'.
    """
    role = user.get("role")
    # 1) Sender
    t = await db.transfers.find_one({"id": transfer_id, "user_id": user["id"]}, {"_id": 0})
    if t:
        return t, "sender"
    # 2) Agent assigné
    if role in ("agent", "agent_admin", "super_agent"):
        agent_id = user.get("agent_id")
        if agent_id:
            t = await db.transfers.find_one({"id": transfer_id, "agent_id": agent_id}, {"_id": 0})
            if t:
                return t, "agent"
    # 3) Admin
    if role in ("admin", "super_admin", "partner_admin"):
        t = await db.transfers.find_one({"id": transfer_id}, {"_id": 0})
        if t:
            return t, "admin"
    raise HTTPException(status_code=404, detail="Transfert introuvable ou accès refusé")


@router.get("/{transfer_id}/chat")
async def get_chat(transfer_id: str, user: dict = Depends(get_current_user)):
    t, my_role = await _resolve_chat_access(transfer_id, user)
    room = await db.chat_rooms.find_one({"transfer_id": transfer_id}, {"_id": 0})
    msgs = await db.chat_messages.find({"transfer_id": transfer_id}, {"_id": 0}).sort("created_at", 1).to_list(500)
    # Petits aperçus des 3 parties pour l'en-tête côté UI (noms uniquement)
    sender_name = (t.get("sender_snapshot") or {}).get("full_name")
    if not sender_name and t.get("user_id"):
        u = await db.users.find_one({"id": t["user_id"]}, {"_id": 0, "full_name": 1, "email": 1})
        if u:
            sender_name = u.get("full_name") or u.get("email")
    participants = {
        "sender": {"name": sender_name or "Expéditeur"},
        "agent": {
            "name": (t.get("agent_snapshot") or {}).get("full_name") or "Agent",
            "phone": (t.get("agent_snapshot") or {}).get("phone"),
        },
        "beneficiary": {"name": (t.get("beneficiary") or {}).get("full_name") or "Bénéficiaire"},
    }
    return {"room": room, "messages": msgs, "my_role": my_role, "participants": participants}


@router.post("/{transfer_id}/chat")
async def post_chat(transfer_id: str, payload: ChatMessageIn, user: dict = Depends(get_current_user)):
    t, my_role = await _resolve_chat_access(transfer_id, user)
    # Auto-créer la room si elle n'existe pas (cas où le transfert n'a pas encore généré une chat_room)
    room = await db.chat_rooms.find_one({"transfer_id": transfer_id})
    if not room:
        room = {"transfer_id": transfer_id, "open": True, "created_at": iso(now_utc())}
        await db.chat_rooms.insert_one(dict(room))
    elif not room.get("open"):
        raise HTTPException(status_code=400, detail="Chat fermé")
    msg = {
        "id": gen_id(), "transfer_id": transfer_id, "role": my_role,
        "author_name": user.get("full_name") or user.get("email", "User"),
        "content": payload.content,
        "created_at": iso(now_utc()),
    }
    await db.chat_messages.insert_one(dict(msg))
    # Simuler une réponse agent uniquement si c'est le sender qui écrit ET que le chat est entre sender et agent assigné
    if my_role == "sender":
        asyncio.create_task(_simulate_agent_reply(transfer_id, t.get("agent_snapshot")))
    return clean_doc(dict(msg))


async def _simulate_agent_reply(transfer_id: str, agent: Optional[dict]):
    await asyncio.sleep(random.uniform(2.0, 4.0))
    replies = [
        "Bonjour, je suis disponible pour la remise.",
        "Veuillez vous présenter avec votre QR code et le code à 10 chiffres.",
        "Je vous attends à l'agence.",
        "Tout est prêt côté caisse.",
    ]
    msg = {
        "id": gen_id(), "transfer_id": transfer_id, "role": "agent",
        "author_name": (agent or {}).get("full_name", "Agent"),
        "content": random.choice(replies),
        "created_at": iso(now_utc()),
    }
    await db.chat_messages.insert_one(dict(msg))
