"""FastAPI dependencies: get_current_user, require_pin (with brute-force lockout)."""
from datetime import datetime, timedelta
from typing import Optional
import jwt
from fastapi import Header, HTTPException

from .db import db, now_utc, iso
from .security import decode_token, verify_password


async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.split(" ", 1)[1].strip()
    try:
        payload = decode_token(token)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    if payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Invalid token type")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    user.pop("password_hash", None)
    user.pop("pin_hash", None)
    return user


async def get_user_from_token(token: str) -> Optional[dict]:
    """Used for WebSocket auth (no Header)."""
    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            return None
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
        if user:
            user.pop("password_hash", None)
            user.pop("pin_hash", None)
        return user
    except Exception:
        return None


async def require_pin(user_id: str, pin: str) -> None:
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "pin_hash": 1, "pin_attempts": 1, "pin_locked_until": 1})
    if not user or not user.get("pin_hash"):
        raise HTTPException(status_code=400, detail="PIN non configuré")
    locked = user.get("pin_locked_until")
    if locked and datetime.fromisoformat(locked) > now_utc():
        raise HTTPException(status_code=423, detail="PIN bloqué temporairement. Réessayez plus tard.")
    if not verify_password(pin, user["pin_hash"]):
        attempts = (user.get("pin_attempts") or 0) + 1
        update = {"pin_attempts": attempts}
        if attempts >= 5:
            update["pin_locked_until"] = iso(now_utc() + timedelta(minutes=15))
            update["pin_attempts"] = 0
        await db.users.update_one({"id": user_id}, {"$set": update})
        raise HTTPException(status_code=401, detail="PIN incorrect")
    await db.users.update_one({"id": user_id}, {"$set": {"pin_attempts": 0, "pin_locked_until": None}})
