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
from core.config import IS_PROD
from services.notify import notify_signup_otp, send_sms
from .models import VerifyOtpIn, ChannelOtpIn


logger = logging.getLogger("sendbid.auth.otp")


@router.post("/lookup-phone")
async def lookup_phone(body: dict):
    """Public endpoint — Détection opérateur + validation Twilio Lookup.
    Utilisé par le frontend pendant la saisie (signup, ajout bénéficiaire, recharge momo).
    Best-effort : retourne carrier/line_type/country pour affichage UX.
    """
    phone = (body.get("phone") or "").strip()
    if not phone or len(phone) < 6:
        return {"valid": False, "carrier_name": None, "country": None, "line_type": "invalid"}
    try:
        from services.twilio_service import validate_phone as twilio_validate
        return await twilio_validate(phone)
    except Exception as e:
        logger.warning(f"[lookup-phone] {e}")
        return {"valid": True, "carrier_name": None, "country": None, "line_type": "unknown", "fraud_risk": "unknown"}


@router.post("/resend-otp")
async def resend_otp(body: dict):
    user_id = body.get("user_id")
    if not user_id or not await db.users.find_one({"id": user_id}):
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    email_code = gen_otp()
    phone_code = gen_otp()
    await db.otp_codes.update_one(
        {"user_id": user_id},
        {"$set": {
            "email_code": email_code, "phone_code": phone_code,
            "expires_at": iso(now_utc() + timedelta(minutes=3)),
            "created_at": iso(now_utc()),
        }},
        upsert=True,
    )
    logger.info(f"[OTP] resend user={user_id}")
    # Send SMS via Twilio (best-effort)
    try:
        from services.sms import send_sms_otp
        user = await db.users.find_one({"id": user_id})
        if user and user.get("phone"):
            await send_sms_otp(user["phone"], phone_code)
    except Exception as e:
        logger.warning(f"[OTP resend] sms send: {e}")
    response = {"ok": True}
    if not IS_PROD:
        response["dev_email_otp"] = email_code
        response["dev_phone_otp"] = phone_code
    return response


@router.post("/verify-otp")
async def verify_otp(payload: VerifyOtpIn):
    from datetime import datetime
    rec = await db.otp_codes.find_one({"user_id": payload.user_id})
    if not rec:
        raise HTTPException(status_code=400, detail="Aucun code en attente")
    if datetime.fromisoformat(rec["expires_at"]) < now_utc():
        raise HTTPException(status_code=400, detail="Code expiré")
    if rec["email_code"] != payload.email_code or rec["phone_code"] != payload.phone_code:
        raise HTTPException(status_code=400, detail="Code(s) incorrect(s)")
    await db.users.update_one({"id": payload.user_id}, {"$set": {"email_verified": True, "phone_verified": True}})
    await db.otp_codes.delete_one({"user_id": payload.user_id})
    user = await db.users.find_one({"id": payload.user_id}, {"_id": 0, "password_hash": 0, "pin_hash": 0})
    token = create_access_token(payload.user_id)
    return {"access_token": token, "user": user}


@router.post("/verify-email-otp")
async def verify_email_otp(payload: ChannelOtpIn, user: dict = Depends(get_current_user)):
    """Vérifie UNIQUEMENT le code OTP email pour l'utilisateur authentifié."""
    from datetime import datetime
    if user.get("email_verified"):
        return {"ok": True, "already_verified": True, "email_verified": True}
    rec = await db.otp_codes.find_one({"user_id": user["id"]})
    if not rec:
        raise HTTPException(status_code=400, detail="Aucun code en attente — demandez l'envoi d'un nouveau code")
    if datetime.fromisoformat(rec["expires_at"]) < now_utc():
        raise HTTPException(status_code=400, detail="Code expiré — demandez un nouvel envoi")
    if rec.get("email_code") != payload.code.strip():
        raise HTTPException(status_code=400, detail="Code email incorrect")
    await db.users.update_one({"id": user["id"]}, {"$set": {"email_verified": True}})

    # L'email est vérifié : on envoie automatiquement le SMS pour la vérification téléphone
    if not user.get("phone_verified"):
        new_phone_code = gen_otp()
        await db.otp_codes.update_one(
            {"user_id": user["id"]},
            {"$set": {
                "phone_code": new_phone_code,
                "email_used": True,
                "expires_at": iso(now_utc() + timedelta(minutes=3)),
                "created_at": iso(now_utc()),
            }},
        )
        try:
            await send_sms(user["phone"], f"SENDBID — Votre code de vérification : {new_phone_code}\nValide 3 minutes. Ne le partagez jamais.")
            logger.info(f"[verify-email-otp] phone code sent user={user['id']}")
        except Exception as e:
            logger.warning(f"[verify-email-otp] sms send: {e}")
    else:
        # Email était le dernier canal restant
        await db.otp_codes.delete_one({"user_id": user["id"]})

    return {"ok": True, "email_verified": True}


@router.post("/verify-phone-otp")
async def verify_phone_otp(payload: ChannelOtpIn, user: dict = Depends(get_current_user)):
    """Vérifie UNIQUEMENT le code OTP SMS pour l'utilisateur authentifié."""
    from datetime import datetime
    if user.get("phone_verified"):
        return {"ok": True, "already_verified": True, "phone_verified": True}
    rec = await db.otp_codes.find_one({"user_id": user["id"]})
    if not rec:
        raise HTTPException(status_code=400, detail="Aucun code en attente — demandez l'envoi d'un nouveau code")
    if datetime.fromisoformat(rec["expires_at"]) < now_utc():
        raise HTTPException(status_code=400, detail="Code expiré — demandez un nouvel envoi")
    if rec.get("phone_code") != payload.code.strip():
        raise HTTPException(status_code=400, detail="Code SMS incorrect")
    await db.users.update_one({"id": user["id"]}, {"$set": {"phone_verified": True}})
    if rec.get("email_used") or user.get("email_verified"):
        await db.otp_codes.delete_one({"user_id": user["id"]})
    else:
        await db.otp_codes.update_one({"user_id": user["id"]}, {"$set": {"phone_used": True}})
    return {"ok": True, "phone_verified": True}


@router.post("/resend-email-otp")
async def resend_email_otp(user: dict = Depends(get_current_user)):
    """Régénère et renvoie UNIQUEMENT le code OTP email."""
    if user.get("email_verified"):
        return {"ok": True, "already_verified": True}
    email_code = gen_otp()
    await db.otp_codes.update_one(
        {"user_id": user["id"]},
        {"$set": {
            "email_code": email_code,
            "email_used": False,
            "expires_at": iso(now_utc() + timedelta(minutes=3)),
            "created_at": iso(now_utc()),
        }, "$setOnInsert": {"user_id": user["id"], "phone_code": gen_otp()}},
        upsert=True,
    )
    logger.info(f"[OTP] resend-email user={user['id']}")
    try:
        from services.notify import notify_signup_otp
        await notify_signup_otp(user["email"], None, email_code, None, user.get("full_name", ""))
    except Exception as e:
        logger.warning(f"[OTP resend-email] notify fail: {e}")
    response = {"ok": True}
    if not IS_PROD:
        response["dev_email_otp"] = email_code
    return response


@router.post("/resend-phone-otp")
async def resend_phone_otp(user: dict = Depends(get_current_user)):
    """Régénère et renvoie UNIQUEMENT le code OTP SMS."""
    if user.get("phone_verified"):
        return {"ok": True, "already_verified": True}
    phone_code = gen_otp()
    await db.otp_codes.update_one(
        {"user_id": user["id"]},
        {"$set": {
            "phone_code": phone_code,
            "phone_used": False,
            "expires_at": iso(now_utc() + timedelta(minutes=3)),
            "created_at": iso(now_utc()),
        }, "$setOnInsert": {"user_id": user["id"], "email_code": gen_otp()}},
        upsert=True,
    )
    logger.info(f"[OTP] resend-phone user={user['id']}")
    try:
        from services.sms import send_sms_otp
        if user.get("phone"):
            await send_sms_otp(user["phone"], phone_code)
    except Exception as e:
        logger.warning(f"[OTP resend-phone] sms fail: {e}")
    response = {"ok": True}
    if not IS_PROD:
        response["dev_phone_otp"] = phone_code
    return response


@router.post("/mark-verification-popup-shown")
async def mark_verification_popup_shown(user: dict = Depends(get_current_user)):
    """Mémorise que la popup post-1ère-connexion a déjà été présentée à l'utilisateur."""
    if not user.get("verification_popup_shown_at"):
        await db.users.update_one(
            {"id": user["id"]},
            {"$set": {"verification_popup_shown_at": iso(now_utc())}},
        )
    return {"ok": True}
