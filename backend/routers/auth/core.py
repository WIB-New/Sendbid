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
from .models import RegisterIn, LoginIn, UpdateMeIn


logger = logging.getLogger("sendbid.auth.core")


@router.post("/register")
async def register(payload: RegisterIn):
    email = payload.email.lower().strip()
    phone = payload.phone.strip()
    # CGU obligatoires
    if payload.accept_terms is False:
        raise HTTPException(status_code=400, detail="Vous devez accepter les CGU et la politique de confidentialité")
    # Twilio Lookup — Valide le téléphone, détecte l'opérateur et le risque fraude
    try:
        from services.twilio_service import validate_phone as twilio_validate
        lookup = await twilio_validate(phone)
        if lookup.get("valid") is False:
            raise HTTPException(status_code=400, detail="Numéro de téléphone invalide ou inexistant")
        if lookup.get("fraud_risk") == "high":
            logger.warning(f"[register] high fraud risk phone={phone} line_type={lookup.get('line_type')}")
        carrier_name = lookup.get("carrier_name")
        line_type = lookup.get("line_type")
        country_lookup = lookup.get("country")
    except HTTPException:
        raise
    except Exception as e:
        logger.warning(f"[register] Twilio lookup skipped: {e}")
        carrier_name, line_type, country_lookup = None, None, None
    # Anti-réutilisation : vérifier email et téléphone séparément avec messages explicites
    existing = await db.users.find_one({"$or": [{"email": email}, {"phone": phone}]})
    if existing:
        # Distinguer compte vérifié vs non finalisé
        is_verified = existing.get("email_verified") or existing.get("phone_verified") or existing.get("pin_hash")
        which = "email" if existing.get("email") == email else "téléphone"
        if is_verified:
            raise HTTPException(status_code=400, detail=f"Ce {which} est déjà associé à un compte vérifié. Connectez-vous ou utilisez 'Mot de passe oublié'.")
        else:
            # Compte non finalisé : autoriser la reprise en supprimant l'ancien
            await db.users.delete_one({"id": existing["id"]})
            await db.wallets.delete_many({"user_id": existing["id"]})
            await db.otp_codes.delete_many({"user_id": existing["id"]})
            logger.info(f"[register] Cleaned up unfinalized account for {which}={email if which == 'email' else phone}")
    if len(payload.password) < 8:
        raise HTTPException(status_code=400, detail="Mot de passe trop court (min 8 caractères)")
    user_id = gen_id()
    import random
    profile_id = f"SB{random.randint(100000, 999999)}"
    user = {
        "id": user_id, "profile_id": profile_id, "email": email, "phone": phone,
        "full_name": payload.full_name, "password_hash": hash_password(payload.password),
        "pin_hash": None, "pin_attempts": 0, "pin_locked_until": None,
        "email_verified": False, "phone_verified": False,
        "kyc_tier": 0, "kyc_status": "none",
        "loyalty_level": "Bronze", "loyalty_points": 0,
        "biometric_enabled": False, "biometric_token": None,
        "avatar_url": None, "language": "fr", "theme": "light",
        "country": (payload.country or country_lookup or "").upper()[:2] or None,
        "city": payload.city or None,
        "carrier_name": carrier_name,
        "phone_line_type": line_type,
        "terms_accepted_at": iso(now_utc()) if payload.accept_terms else None,
        "notif_prefs": {"push": True, "email": True, "sms": False},
        "created_at": iso(now_utc()),
    }
    await db.users.insert_one(user)
    await db.wallets.insert_one({"id": gen_id(), "user_id": user_id, "balance": 0.0, "currency": "EUR", "created_at": iso(now_utc())})

    email_code = gen_otp()
    phone_code = gen_otp()
    await db.otp_codes.insert_one({
        "user_id": user_id, "email_code": email_code, "phone_code": phone_code,
        "expires_at": iso(now_utc() + timedelta(minutes=3)), "created_at": iso(now_utc()),
    })
    logger.info(f"[OTP] user={user_id} email_code={email_code} phone_code={phone_code}")
    # Send real SMS + email via Twilio + SendGrid (skipped for test domains/numbers)
    delivery = await notify_signup_otp(email, phone, email_code, phone_code, payload.full_name)
    response = {
        "user_id": user_id,
        "message": "Compte créé. Vérifiez email et téléphone.",
        "delivery": delivery,
        # Auto-login : l'utilisateur reçoit immédiatement un JWT pour qu'il puisse
        # créer son PIN sans étape OTP préalable (B1 — voir signup.tsx).
        "token": create_access_token(user_id),
        "user": {
            "id": user_id, "profile_id": profile_id, "email": email, "phone": phone,
            "full_name": payload.full_name, "kyc_tier": 0, "kyc_status": "none",
            "loyalty_level": "Bronze", "loyalty_points": 0, "language": "fr",
            "email_verified": False, "phone_verified": False,
            "biometric_enabled": False, "avatar_url": None,
        },
    }
    if not IS_PROD:
        response["dev_email_otp"] = email_code
        response["dev_phone_otp"] = phone_code
    return response


@router.post("/login")
async def login(payload: LoginIn, request: Request):
    ident = payload.identifier.lower().strip()
    user = await db.users.find_one({"$or": [
        {"email": ident},
        {"phone": payload.identifier.strip()},
        {"profile_id": payload.identifier.strip().upper()},
    ]})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Identifiants invalides")
    token = create_access_token(user["id"])
    # v7 : track first login pour déclencher la popup de vérification 30s après
    if not user.get("first_login_at"):
        await db.users.update_one(
            {"id": user["id"]},
            {"$set": {"first_login_at": iso(now_utc())}},
        )
        user["first_login_at"] = iso(now_utc())
    # v6 : persiste une session pour la page Sessions actives
    from routers.sessions import record_session
    await record_session(user["id"], request, kind="password")
    # v9 : expose has_pin sur la réponse de login (utile pour la PIN-gate post-mot-de-passe)
    user_resp = clean_doc(dict(user))
    user_resp["has_pin"] = bool(user.get("pin_hash"))
    return {"access_token": token, "user": user_resp}


@router.get("/me")
async def me(user: dict = Depends(get_current_user)):
    wallet = await db.wallets.find_one({"user_id": user["id"]}, {"_id": 0})
    # Spec v7 : exposer has_pin (booléen dérivé du hash) sans leaker le hash lui-même.
    # NB: get_current_user strip déjà pin_hash de `user` → on requête séparément.
    pin_doc = await db.users.find_one({"id": user["id"]}, {"_id": 0, "pin_hash": 1})
    user_clean = clean_doc(dict(user))
    user_clean["has_pin"] = bool(pin_doc and pin_doc.get("pin_hash"))
    return {"user": user_clean, "wallet": wallet}


@router.put("/me")
async def update_me(payload: UpdateMeIn, user: dict = Depends(get_current_user)):
    """v6 — Personal info update. Used by the /personal-info page."""
    patch = {k: v for k, v in payload.model_dump(exclude_none=True).items()}
    if not patch:
        raise HTTPException(status_code=400, detail="Aucune modification fournie")
    patch["updated_at"] = iso(now_utc())
    await db.users.update_one({"id": user["id"]}, {"$set": patch})
    fresh = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password_hash": 0, "pin_hash": 0})
    return {"ok": True, "user": clean_doc(fresh)}
