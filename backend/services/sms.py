"""SMS dispatch service with pluggable providers.

Providers:
- twilio : Twilio Messages API (legacy, kept for compatibility).
- africastalking : Africa's Talking SMS gateway (good for African markets).
- none : SMS disabled; logs only.

Configuration:
    SMS_PROVIDER=twilio              # or africastalking / none
    TWILIO_ACCOUNT_SID=...
    TWILIO_AUTH_TOKEN=...
    TWILIO_FROM_NUMBER=...
    AFRICAS_TALKING_USERNAME=...
    AFRICAS_TALKING_API_KEY=...
    AFRICAS_TALKING_SENDER_ID=SENDBID  # optional
"""
from __future__ import annotations

import os
import logging
from typing import Optional

import httpx

logger = logging.getLogger("sendbid.sms")

SMS_PROVIDER = os.getenv("SMS_PROVIDER", "auto").strip().lower()

TWILIO_SID = os.getenv("TWILIO_ACCOUNT_SID", "").strip()
TWILIO_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "").strip()
TWILIO_FROM = os.getenv("TWILIO_FROM_NUMBER", "").strip()

AFRICAS_TALKING_USERNAME = os.getenv("AFRICAS_TALKING_USERNAME", "").strip()
AFRICAS_TALKING_API_KEY = os.getenv("AFRICAS_TALKING_API_KEY", "").strip()
AFRICAS_TALKING_SENDER_ID = os.getenv("AFRICAS_TALKING_SENDER_ID", "SENDBID").strip()

TEST_PHONE_PREFIXES = ("+33000", "+1555")


def _provider() -> str:
    if SMS_PROVIDER in {"twilio", "africastalking", "none"}:
        return SMS_PROVIDER
    if TWILIO_SID and TWILIO_TOKEN and TWILIO_FROM:
        return "twilio"
    if AFRICAS_TALKING_USERNAME and AFRICAS_TALKING_API_KEY:
        return "africastalking"
    return "none"


def _is_test_phone(num: str) -> bool:
    return not num or any(str(num).startswith(p) for p in TEST_PHONE_PREFIXES)


async def send_sms(to: str, body: str) -> bool:
    """Send an SMS. Returns True on success / skip, False on failure."""
    if _is_test_phone(to):
        logger.info("[sms] SKIPPED (test number) to=%s: %s", to, body[:60])
        return True

    provider = _provider()
    if provider == "twilio":
        return await _send_twilio(to, body)
    if provider == "africastalking":
        return await _send_africastalking(to, body)

    logger.warning("[sms] No SMS provider configured — SMS not sent")
    return False


async def send_sms_otp(phone: str, code: str) -> bool:
    """Convenience wrapper for OTP SMS."""
    body = f"SENDBID — Votre code de vérification : {code}\nValable 10 min. Ne le partagez jamais."
    return await send_sms(phone, body)


async def _send_twilio(to: str, body: str) -> bool:
    if not (TWILIO_SID and TWILIO_TOKEN and TWILIO_FROM):
        logger.warning("[sms] Twilio credentials missing")
        return False
    url = f"https://api.twilio.com/2010-04-01/Accounts/{TWILIO_SID}/Messages.json"
    try:
        async with httpx.AsyncClient(timeout=10.0) as cx:
            r = await cx.post(
                url,
                auth=(TWILIO_SID, TWILIO_TOKEN),
                data={"From": TWILIO_FROM, "To": to, "Body": body},
            )
        if r.status_code not in (200, 201):
            logger.error("[sms] Twilio send failed %s: %s", r.status_code, r.text[:200])
            return False
        logger.info("[sms] Twilio sent to=%s sid=%s", to, r.json().get("sid"))
        return True
    except Exception as exc:
        logger.error("[sms] Twilio exception to=%s: %s", to, exc)
        return False


async def _send_africastalking(to: str, body: str) -> bool:
    if not (AFRICAS_TALKING_USERNAME and AFRICAS_TALKING_API_KEY):
        logger.warning("[sms] Africa's Talking credentials missing")
        return False

    is_sandbox = AFRICAS_TALKING_USERNAME.lower() == "sandbox"
    base_url = (
        "https://api.sandbox.africastalking.com/version1/messaging"
        if is_sandbox else
        "https://api.africastalking.com/version1/messaging"
    )
    headers = {
        "Accept": "application/json",
        "apiKey": AFRICAS_TALKING_API_KEY,
    }
    data = {
        "username": AFRICAS_TALKING_USERNAME,
        "to": to,
        "message": body,
    }
    if AFRICAS_TALKING_SENDER_ID:
        data["from"] = AFRICAS_TALKING_SENDER_ID

    try:
        async with httpx.AsyncClient(timeout=15.0) as cx:
            r = await cx.post(base_url, headers=headers, data=data)
        if r.status_code != 201:
            logger.error("[sms] Africa's Talking send failed %s: %s", r.status_code, r.text[:400])
            return False
        logger.info("[sms] Africa's Talking sent to=%s response=%s", to, r.text[:200])
        return True
    except Exception as exc:
        logger.error("[sms] Africa's Talking exception to=%s: %s", to, exc)
        return False


async def healthcheck() -> dict:
    return {"provider": _provider(), "configured": _provider() != "none"}
