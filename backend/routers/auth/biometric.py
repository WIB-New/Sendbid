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
from .models import BiometricLoginIn


logger = logging.getLogger("sendbid.auth.biometric")


@router.post("/biometric-login")
async def biometric_login(payload: BiometricLoginIn, request: Request):
    user = await db.users.find_one({"biometric_token": payload.biometric_token})
    if not user:
        raise HTTPException(status_code=401, detail="Token biométrique invalide")
    token = create_access_token(user["id"])
    from routers.sessions import record_session
    await record_session(user["id"], request, kind="biometric")
    return {"access_token": token, "user": clean_doc(dict(user))}


@router.post("/biometric-enable")
async def biometric_enable(user: dict = Depends(get_current_user)):
    bio_token = secrets.token_urlsafe(48)
    await db.users.update_one({"id": user["id"]}, {"$set": {"biometric_enabled": True, "biometric_token": bio_token}})
    return {"biometric_token": bio_token, "enabled": True}


@router.post("/biometric-disable")
async def biometric_disable(user: dict = Depends(get_current_user)):
    await db.users.update_one({"id": user["id"]}, {"$set": {"biometric_enabled": False, "biometric_token": None}})
    return {"enabled": False}
