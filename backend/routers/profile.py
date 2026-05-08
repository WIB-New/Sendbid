"""Profile + settings: PATCH preferences, change password."""
from fastapi import APIRouter, Depends, HTTPException

from core.db import db
from core.deps import get_current_user
from core.security import hash_password, verify_password

router = APIRouter(prefix="/profile", tags=["profile"])


@router.patch("")
async def patch_profile(body: dict, user: dict = Depends(get_current_user)):
    allowed = {"full_name", "avatar_url", "language", "theme", "default_currency", "notif_prefs"}
    update = {k: v for k, v in body.items() if k in allowed}
    if update:
        await db.users.update_one({"id": user["id"]}, {"$set": update})
    return await db.users.find_one({"id": user["id"]}, {"_id": 0, "password_hash": 0, "pin_hash": 0})


@router.post("/change-password")
async def change_password(body: dict, user: dict = Depends(get_current_user)):
    full = await db.users.find_one({"id": user["id"]})
    if not verify_password(body.get("current", ""), full["password_hash"]):
        raise HTTPException(status_code=401, detail="Mot de passe actuel incorrect")
    new = body.get("new", "")
    if len(new) < 8:
        raise HTTPException(status_code=400, detail="Mot de passe trop court")
    await db.users.update_one({"id": user["id"]}, {"$set": {"password_hash": hash_password(new)}})
    return {"ok": True}
