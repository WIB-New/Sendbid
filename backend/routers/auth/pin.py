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
from .models import CreatePinIn, ChangePinIn, VerifyPinIn


logger = logging.getLogger("sendbid.auth.pin")


@router.post("/create-pin")
async def create_pin(payload: CreatePinIn, user: dict = Depends(get_current_user)):
    if not (payload.pin and payload.pin.isdigit() and len(payload.pin) == 6):
        raise HTTPException(status_code=400, detail="Le PIN doit contenir 6 chiffres")
    if is_weak_pin(payload.pin):
        raise HTTPException(status_code=400, detail="PIN trop faible (séquentiels, répétés ou communs interdits)")
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"pin_hash": hash_password(payload.pin), "pin_attempts": 0, "pin_locked_until": None}},
    )
    return {"ok": True}


@router.post("/change-pin")
async def change_pin(payload: ChangePinIn, user: dict = Depends(get_current_user)):
    if not user.get("pin_hash") or not verify_password(payload.current_pin, user["pin_hash"]):
        raise HTTPException(status_code=401, detail="Code PIN actuel incorrect")
    if len(payload.new_pin) != 6 or not payload.new_pin.isdigit():
        raise HTTPException(status_code=400, detail="Nouveau PIN invalide (6 chiffres exigés)")
    if is_weak_pin(payload.new_pin):
        raise HTTPException(status_code=400, detail="PIN trop faible (séquentiel / répétitif). Choisissez un code moins évident.")
    await db.users.update_one({"id": user["id"]}, {"$set": {"pin_hash": hash_password(payload.new_pin), "pin_attempts": 0, "pin_locked_until": None}})
    return {"ok": True}


@router.post("/verify-pin")
async def verify_pin(payload: VerifyPinIn, user: dict = Depends(get_current_user)):
    """Vérifie le PIN avec brute-force lockout (5 essais → 15 min de blocage).
    Délègue à core.deps.require_pin pour respecter la même politique de sécurité
    que les actions sensibles (transfert, withdraw, p2p)."""
    from core.deps import require_pin
    await require_pin(user["id"], payload.pin)
    return {"ok": True}
