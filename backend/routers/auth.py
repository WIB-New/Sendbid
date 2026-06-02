"""Auth router: register, OTP verify, login, biometric, PIN, forgot/reset password."""
import logging
import secrets
from datetime import timedelta
from typing import Optional

import jwt
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr

from core.config import IS_PROD, JWT_SECRET
from core.db import db, now_utc, iso, clean_doc
from core.deps import get_current_user
from core.security import (
    gen_id, gen_otp, hash_password, verify_password,
    is_weak_pin, create_access_token, create_reset_token, decode_token,
)
from services.notify import notify_signup_otp, notify_password_reset

router = APIRouter(prefix="/auth", tags=["auth"])
logger = logging.getLogger("sendbid.auth")


class RegisterIn(BaseModel):
    email: EmailStr
    phone: str
    password: str
    full_name: str
    country: Optional[str] = None  # ISO 3166-1 alpha-2 (ex: "FR", "SN")
    city: Optional[str] = None
    accept_terms: Optional[bool] = True  # CGU acceptance


class VerifyOtpIn(BaseModel):
    user_id: str
    email_code: str
    phone_code: str


class LoginIn(BaseModel):
    identifier: str
    password: str


class BiometricLoginIn(BaseModel):
    biometric_token: str


class CreatePinIn(BaseModel):
    pin: str


class ForgotPasswordIn(BaseModel):
    email: EmailStr


class ResetPasswordIn(BaseModel):
    token: str
    new_password: str


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
    logger.info(f"[OTP] resend user={user_id} email={email_code} phone={phone_code}")
    # Send SMS via Twilio (best-effort)
    try:
        from services.twilio_service import send_sms_otp
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
    # v6 : persiste une session pour la page Sessions actives
    from routers.sessions import record_session
    await record_session(user["id"], request, kind="password")
    return {"access_token": token, "user": clean_doc(dict(user))}


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


@router.get("/me")
async def me(user: dict = Depends(get_current_user)):
    wallet = await db.wallets.find_one({"user_id": user["id"]}, {"_id": 0})
    return {"user": user, "wallet": wallet}



class UpdateMeIn(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    language: Optional[str] = None
    theme: Optional[str] = None  # "light" | "dark" | "system"


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



# ---------------------------------------------------------------------------
# Revérification email / téléphone (V6.4)
# ---------------------------------------------------------------------------
class PhoneOtpIn(BaseModel):
    phone: str


class EmailChangeIn(BaseModel):
    new_email: str


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



# ---------------------------------------------------------------------------
# Changement PIN / mot de passe (V6.5)
# ---------------------------------------------------------------------------
class ChangePinIn(BaseModel):
    current_pin: str
    new_pin: str


class ChangePasswordIn(BaseModel):
    current_password: str
    new_password: str


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


@router.post("/change-password")
async def change_password(payload: ChangePasswordIn, user: dict = Depends(get_current_user)):
    if not verify_password(payload.current_password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Mot de passe actuel incorrect")
    if len(payload.new_password) < 8:
        raise HTTPException(status_code=400, detail="Au moins 8 caractères requis")
    await db.users.update_one({"id": user["id"]}, {"$set": {"password_hash": hash_password(payload.new_password)}})
    return {"ok": True}


class VerifyPinIn(BaseModel):
    pin: str


@router.post("/verify-pin")
async def verify_pin(payload: VerifyPinIn, user: dict = Depends(get_current_user)):
    """Vérifie le PIN sans modifier l'état. Utilisé pour des actions sensibles (ex : dévoiler le solde)."""
    rec = await db.users.find_one({"id": user["id"]}, {"_id": 0, "pin_hash": 1})
    if not rec or not rec.get("pin_hash") or not verify_password(payload.pin, rec["pin_hash"]):
        raise HTTPException(status_code=401, detail="Code PIN incorrect")
    return {"ok": True}
