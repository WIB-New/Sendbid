"""Notifications router (also exposes create_notification helper used by other routers)."""
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from core.db import db, now_utc, iso
from core.deps import get_current_user
from core.security import gen_id
from services import push as push_service

router = APIRouter(prefix="/notifications", tags=["notifications"])


class RegisterTokenIn(BaseModel):
    token: str
    platform: Optional[str] = None      # "ios" | "android" | "web"
    device_name: Optional[str] = None
    provider: Optional[str] = None      # "expo" | "fcm"


async def create_notification(user_id: str, title: str, body: str, type_: str = "info", data: Optional[dict] = None):
    """Persist an in-app notification AND dispatch a push notification (best-effort)."""
    await db.notifications.insert_one({
        "id": gen_id(), "user_id": user_id,
        "title": title, "body": body, "type": type_,
        "read": False, "created_at": iso(now_utc()),
    })
    try:
        await push_service.send_to_user(db, user_id, title, body, data or {"type": type_})
    except Exception:  # noqa: BLE001
        # Push is best-effort; never block the in-app notification on a push failure
        pass


@router.get("")
async def list_notifs(user: dict = Depends(get_current_user)):
    return await db.notifications.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)


@router.post("/{nid}/read")
async def read_notif(nid: str, user: dict = Depends(get_current_user)):
    await db.notifications.update_one({"id": nid, "user_id": user["id"]}, {"$set": {"read": True}})
    return {"ok": True}


@router.post("/read-all")
async def read_all(user: dict = Depends(get_current_user)):
    await db.notifications.update_many({"user_id": user["id"]}, {"$set": {"read": True}})
    return {"ok": True}


@router.post("/register-token")
async def register_token(payload: RegisterTokenIn, user: dict = Depends(get_current_user)):
    """Upsert a push token for the current user (per device)."""
    provider = payload.provider or ("expo" if push_service.is_expo_token(payload.token) else "fcm")
    await db.push_tokens.update_one(
        {"token": payload.token},
        {"$set": {
            "user_id": user["id"],
            "token": payload.token,
            "provider": provider,
            "platform": payload.platform,
            "device_name": payload.device_name,
            "active": True,
            "updated_at": iso(now_utc()),
        }, "$setOnInsert": {"created_at": iso(now_utc())}},
        upsert=True,
    )
    return {"ok": True, "provider": provider}


@router.post("/unregister-token")
async def unregister_token(payload: RegisterTokenIn, user: dict = Depends(get_current_user)):
    await db.push_tokens.update_one(
        {"token": payload.token, "user_id": user["id"]},
        {"$set": {"active": False, "updated_at": iso(now_utc())}},
    )
    return {"ok": True}


@router.post("/test-push")
async def test_push(user: dict = Depends(get_current_user)):
    """Send a test push to all of the current user's registered tokens.

    Useful for QA after registering an Expo or FCM token. Returns per-token results.
    """
    results = await push_service.send_to_user(
        db,
        user["id"],
        title="🔔 SENDBID — Test push",
        body="Si vous voyez ce message, vos notifications sont bien configurées.",
        data={"type": "test"},
    )
    return {"ok": True, "sent": len(results), "results": results}
