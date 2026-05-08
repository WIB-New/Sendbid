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


@router.get("/{transfer_id}/chat")
async def get_chat(transfer_id: str, user: dict = Depends(get_current_user)):
    t = await db.transfers.find_one({"id": transfer_id, "user_id": user["id"]}, {"_id": 0})
    if not t:
        raise HTTPException(status_code=404, detail="Transfert introuvable")
    room = await db.chat_rooms.find_one({"transfer_id": transfer_id}, {"_id": 0})
    msgs = await db.chat_messages.find({"transfer_id": transfer_id}, {"_id": 0}).sort("created_at", 1).to_list(500)
    return {"room": room, "messages": msgs}


@router.post("/{transfer_id}/chat")
async def post_chat(transfer_id: str, payload: ChatMessageIn, user: dict = Depends(get_current_user)):
    t = await db.transfers.find_one({"id": transfer_id, "user_id": user["id"]}, {"_id": 0})
    if not t:
        raise HTTPException(status_code=404, detail="Transfert introuvable")
    room = await db.chat_rooms.find_one({"transfer_id": transfer_id})
    if not room or not room.get("open"):
        raise HTTPException(status_code=400, detail="Chat fermé")
    msg = {
        "id": gen_id(), "transfer_id": transfer_id, "role": "sender",
        "author_name": user["full_name"], "content": payload.content,
        "created_at": iso(now_utc()),
    }
    await db.chat_messages.insert_one(dict(msg))
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
