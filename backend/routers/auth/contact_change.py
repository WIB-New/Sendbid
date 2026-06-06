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
from .models import PhoneOtpIn, EmailChangeIn


logger = logging.getLogger("sendbid.auth.contact_change")


@router.post("/request-phone-otp")
async def request_phone_otp(payload: PhoneOtpIn, user: dict = Depends(get_current_user)):
    """Envoie un code OTP au nouveau numéro pour revérifier le téléphone.

    Lorsque l'utilisateur modifie son numéro via /personal-info, on déclenche
    une revérification par SMS. Le compte reste utilisable entre temps mais le
    statut phone_verified passe à False.
    """
    phone = (payload.phone or "").strip()
    if not phone or len(phone) < 6:
        raise HTTPException(status_code=400, detail="Numéro invalide")
    code = f"{__import__('secrets').randbelow(1_000_000):06d}"
    await db.phone_otps.update_one(
        {"user_id": user["id"]},
        {"$set": {"user_id": user["id"], "phone": phone, "code": code, "created_at": iso(now_utc())}},
        upsert=True,
    )
    await db.users.update_one({"id": user["id"]}, {"$set": {"phone": phone, "phone_verified": False}})
    # Envoi SMS en best-effort
    try:
        await notify_signup_otp(phone, code)  # réutilise le même canal
    except Exception:
        pass
    return {"ok": True, "sent_to": phone[-4:]}


@router.post("/request-email-change")
async def request_email_change(payload: EmailChangeIn, user: dict = Depends(get_current_user)):
    """Envoie un lien de confirmation à la nouvelle adresse.

    Tant que l'utilisateur ne clique pas sur le lien, l'ancien email reste
    actif pour les connexions. Le champ email_verified passe à False dès que
    le changement est confirmé.
    """
    new_email = (payload.new_email or "").strip().lower()
    if "@" not in new_email or "." not in new_email.split("@")[-1]:
        raise HTTPException(status_code=400, detail="Adresse email invalide")
    if new_email == (user.get("email") or "").lower():
        raise HTTPException(status_code=400, detail="Adresse identique à l'actuelle")
    existing = await db.users.find_one({"email": new_email})
    if existing:
        raise HTTPException(status_code=409, detail="Cette adresse est déjà utilisée par un autre compte")
    # Token de confirmation JWT 48h
    token = jwt.encode(
        {"sub": user["id"], "new_email": new_email, "exp": (now_utc() + timedelta(hours=48)).timestamp()},
        JWT_SECRET, algorithm="HS256",
    )
    await db.email_change_requests.update_one(
        {"user_id": user["id"]},
        {"$set": {"user_id": user["id"], "new_email": new_email, "token": token, "created_at": iso(now_utc())}},
        upsert=True,
    )
    # Envoi email best-effort (dev: log seulement)
    try:
        await notify_password_reset(new_email, token)  # réutilise le canal email
    except Exception:
        pass
    return {"ok": True, "sent_to": new_email}
