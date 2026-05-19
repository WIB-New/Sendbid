"""Twilio integration — Phone validation (Lookup v2) + SMS OTP sending.

- `validate_phone(phone)` : Twilio Lookup v2 with line_type_intelligence.
  Returns {valid: bool, formatted: str, country: str, carrier: dict, line_type: str}
- `send_sms_otp(phone, code)` : Sends SMS via Twilio Messages API.

Both functions are async via httpx. Best-effort: if Twilio is misconfigured,
they log warnings and return safe fallbacks instead of breaking the flow.
"""
import os
import logging
from typing import Optional
import httpx
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger("sendbid.twilio")

TWILIO_SID = os.getenv("TWILIO_ACCOUNT_SID", "")
TWILIO_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "")
TWILIO_FROM = os.getenv("TWILIO_FROM_PHONE", "")

LOOKUPS_BASE = "https://lookups.twilio.com/v2/PhoneNumbers"
MESSAGES_BASE = f"https://api.twilio.com/2010-04-01/Accounts/{TWILIO_SID}/Messages.json"


def _enabled() -> bool:
    return bool(TWILIO_SID and TWILIO_TOKEN and TWILIO_FROM)


async def validate_phone(phone: str) -> dict:
    """Validates a phone using Twilio Lookup v2 + line_type_intelligence.
    Returns {valid, formatted, country, carrier_name, line_type, fraud_risk}.
    On error or if Twilio disabled, returns {valid: True, ...} (best-effort, do not block).
    """
    if not _enabled():
        return {"valid": True, "formatted": phone, "country": None, "carrier_name": None, "line_type": "unknown", "fraud_risk": "unknown"}
    try:
        async with httpx.AsyncClient(timeout=10.0) as cx:
            r = await cx.get(
                f"{LOOKUPS_BASE}/{phone}",
                params={"Fields": "line_type_intelligence"},
                auth=(TWILIO_SID, TWILIO_TOKEN),
            )
        if r.status_code == 404:
            return {"valid": False, "formatted": phone, "country": None, "carrier_name": None, "line_type": "invalid", "fraud_risk": "high"}
        if r.status_code != 200:
            logger.warning(f"[twilio] lookup {phone} status={r.status_code} body={r.text[:200]}")
            return {"valid": True, "formatted": phone, "country": None, "carrier_name": None, "line_type": "unknown", "fraud_risk": "unknown"}
        d = r.json()
        lti = (d.get("line_type_intelligence") or {})
        line_type = (lti.get("type") or "unknown").lower()
        carrier_name = lti.get("carrier_name") or None
        # Fraud heuristic: voip / non-fixed-voip lines are higher fraud risk
        fraud_risk = "high" if line_type in ("voip", "nonFixedVoip", "non_fixed_voip") else "low"
        return {
            "valid": d.get("valid", True),
            "formatted": d.get("phone_number") or phone,
            "country": d.get("country_code"),
            "carrier_name": carrier_name,
            "line_type": line_type,
            "fraud_risk": fraud_risk,
        }
    except Exception as e:
        logger.warning(f"[twilio] lookup exception: {e}")
        return {"valid": True, "formatted": phone, "country": None, "carrier_name": None, "line_type": "unknown", "fraud_risk": "unknown"}


async def send_sms_otp(phone: str, code: str) -> bool:
    """Send an SMS OTP via Twilio. Returns True on success, False on failure.
    On failure (or if disabled), it's a no-op (best-effort)."""
    if not _enabled():
        logger.info(f"[twilio] DISABLED — would send SMS to {phone} code={code}")
        return False
    body = f"SENDBID — Votre code de vérification : {code}\nValable 10 min. Ne le partagez jamais."
    try:
        async with httpx.AsyncClient(timeout=10.0) as cx:
            r = await cx.post(
                MESSAGES_BASE,
                auth=(TWILIO_SID, TWILIO_TOKEN),
                data={"From": TWILIO_FROM, "To": phone, "Body": body},
            )
        if r.status_code not in (200, 201):
            logger.error(f"[twilio] sms send failed {r.status_code}: {r.text[:200]}")
            return False
        logger.info(f"[twilio] sms sent to {phone} sid={r.json().get('sid')}")
        return True
    except Exception as e:
        logger.error(f"[twilio] sms exception: {e}")
        return False
