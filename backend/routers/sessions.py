"""Sessions router — v6 : tracking des sessions actives réelles.

Chaque JWT créé à la connexion / inscription / biométrie ajoute un document
dans db.sessions. L'endpoint retourne la liste des sessions non révoquées
du user courant, et permet de révoquer une session individuelle ou toutes.
"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from core.db import db, now_utc, iso
from core.deps import get_current_user
from core.security import gen_id

router = APIRouter(prefix="/sessions", tags=["sessions"])


async def record_session(user_id: str, request: Optional[Request] = None, kind: str = "password") -> str:
    """Called by auth flows (login, biometric, register) to persist a session."""
    sid = gen_id()
    ua = ""
    ip = ""
    if request is not None:
        ua = request.headers.get("user-agent", "")[:300]
        ip = (request.headers.get("x-forwarded-for") or request.client.host if request.client else "") or ""
    device = _parse_device(ua)
    doc = {
        "id": sid,
        "user_id": user_id,
        "kind": kind,
        "user_agent": ua,
        "ip": ip,
        "device": device,
        "revoked": False,
        "created_at": iso(now_utc()),
        "last_seen": iso(now_utc()),
    }
    await db.sessions.insert_one(doc)
    return sid


def _parse_device(ua: str) -> str:
    u = (ua or "").lower()
    if "iphone" in u: return "iPhone"
    if "ipad" in u: return "iPad"
    if "android" in u: return "Android"
    if "macintosh" in u or "mac os" in u: return "Mac"
    if "windows" in u: return "Windows"
    if "linux" in u: return "Linux"
    if "okhttp" in u or "axios" in u: return "API client"
    return "Navigateur web"


@router.get("")
async def list_sessions(user: dict = Depends(get_current_user)):
    items = await db.sessions.find(
        {"user_id": user["id"], "revoked": False},
        {"_id": 0, "user_id": 0},
    ).sort("created_at", -1).to_list(20)
    return items


class RevokeIn(BaseModel):
    session_id: str


@router.post("/revoke")
async def revoke_session(payload: RevokeIn, user: dict = Depends(get_current_user)):
    res = await db.sessions.update_one(
        {"id": payload.session_id, "user_id": user["id"]},
        {"$set": {"revoked": True, "revoked_at": iso(now_utc())}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Session introuvable")
    return {"ok": True}


@router.post("/revoke-all")
async def revoke_all(user: dict = Depends(get_current_user)):
    res = await db.sessions.update_many(
        {"user_id": user["id"], "revoked": False},
        {"$set": {"revoked": True, "revoked_at": iso(now_utc())}},
    )
    return {"ok": True, "revoked": res.modified_count}
