"""Auth submodule (split from auth.py)."""
import logging
from datetime import datetime, timedelta
from typing import Optional

from fastapi import Depends, HTTPException, Request
from pydantic import BaseModel

from core.db import db, now_utc, iso, clean_doc
from core.deps import get_current_user
from core.security import (
    gen_id, hash_password, verify_password, create_access_token,
    gen_otp,
)
from routers.notifications import create_notification

from . import router
import jwt
from core.config import IS_PROD
from core.security import create_reset_token, decode_token
from services.notify import notify_password_reset
from .models import ForgotPasswordIn, ResetPasswordIn, ChangePasswordIn


logger = logging.getLogger("sendbid.auth.password")


@router.post("/forgot-password")
async def forgot_password(payload: ForgotPasswordIn):
    user = await db.users.find_one({"email": payload.email.lower().strip()})
    if not user:
        return {"ok": True}
    token = create_reset_token(user["id"])
    # Reset URL: deep link or web fallback
    base_url = "https://sendbid.app/reset"  # client-managed reset page in prod
    reset_url = f"{base_url}?token={token}"
    logger.info(f"[RESET] email={user['email']} token issued (10 min validity)")
    delivered = await notify_password_reset(user["email"], reset_url, user.get("full_name", ""))
    response = {"ok": True, "delivered": delivered}
    if not IS_PROD:
        response["dev_reset_token"] = token
        response["dev_reset_url"] = reset_url
    return response


@router.post("/reset-password")
async def reset_password(payload: ResetPasswordIn):
    try:
        decoded = decode_token(payload.token)
        if decoded.get("type") != "reset":
            raise HTTPException(status_code=400, detail="Token invalide")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=400, detail="Lien expiré")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=400, detail="Token invalide")
    if len(payload.new_password) < 8:
        raise HTTPException(status_code=400, detail="Mot de passe trop court")
    await db.users.update_one({"id": decoded["sub"]}, {"$set": {"password_hash": hash_password(payload.new_password)}})
    return {"ok": True}


@router.post("/change-password")
async def change_password(payload: ChangePasswordIn, user: dict = Depends(get_current_user)):
    if not verify_password(payload.current_password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Mot de passe actuel incorrect")
    if len(payload.new_password) < 8:
        raise HTTPException(status_code=400, detail="Au moins 8 caractères requis")
    await db.users.update_one({"id": user["id"]}, {"$set": {"password_hash": hash_password(payload.new_password)}})
    return {"ok": True}
