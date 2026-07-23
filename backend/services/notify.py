"""Notification service: real SMS (Twilio) + Email (SendGrid) with French templates.

In development mode, codes are also logged to console for easier testing.
Test domains/numbers (e.g. client@sendbid.app, +33000000000) are SKIPPED to avoid
sending real messages during automated testing.
"""
import os
import logging
import asyncio
from typing import Optional

from twilio.rest import Client as TwilioClient
from twilio.base.exceptions import TwilioRestException
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail, Email, To, Content

from core.config import IS_PROD

logger = logging.getLogger("sendbid.notify")

# --- Config ---
TWILIO_SID = os.getenv("TWILIO_ACCOUNT_SID")
TWILIO_TOKEN = os.getenv("TWILIO_AUTH_TOKEN")
TWILIO_FROM = os.getenv("TWILIO_FROM_NUMBER")
SENDGRID_KEY = os.getenv("SENDGRID_API_KEY")
SENDGRID_FROM = os.getenv("SENDGRID_FROM_EMAIL", "noreply@sendbid.app")
SENDGRID_FROM_NAME = os.getenv("SENDGRID_FROM_NAME", "SENDBID")

_twilio = TwilioClient(TWILIO_SID, TWILIO_TOKEN) if TWILIO_SID and TWILIO_TOKEN else None
_sg = SendGridAPIClient(SENDGRID_KEY) if SENDGRID_KEY else None

# --- Test guards: do NOT spam real services during dev/testing ---
TEST_EMAIL_DOMAINS = {"sendbid.app", "example.com", "test.com"}
TEST_PHONE_PREFIXES = ("+33000", "+1555")  # Twilio test/magic numbers

def _is_test_email(addr: str) -> bool:
    if not addr:
        return True
    domain = addr.split("@")[-1].lower() if "@" in addr else ""
    return domain in TEST_EMAIL_DOMAINS

def _is_test_phone(num: str) -> bool:
    return not num or any(num.startswith(p) for p in TEST_PHONE_PREFIXES)


# ---------------- SMS ----------------
async def send_sms(to: str, body: str) -> bool:
    """Send SMS via Twilio. Returns True on success / skip, False on error."""
    if _is_test_phone(to):
        logger.info(f"[notify] SMS SKIPPED (test number) to={to}: {body[:60]}")
        return True
    if not _twilio or not TWILIO_FROM:
        logger.warning("[notify] Twilio not configured — SMS not sent")
        return False
    try:
        # Twilio SDK is sync; run in thread pool
        msg = await asyncio.to_thread(
            lambda: _twilio.messages.create(to=to, from_=TWILIO_FROM, body=body)
        )
        logger.info(f"[notify] SMS sent to={to} sid={msg.sid}")
        return True
    except TwilioRestException as e:
        logger.error(f"[notify] Twilio error to={to}: code={e.code} msg={e.msg}")
        return False
    except Exception as e:
        logger.error(f"[notify] SMS failed to={to}: {e}")
        return False


# ---------------- Email ----------------
async def send_email(to: str, subject: str, html: str, plain: Optional[str] = None) -> bool:
    """Send email via SendGrid. Returns True on success / skip, False on error."""
    if _is_test_email(to):
        logger.info(f"[notify] EMAIL SKIPPED (test domain) to={to}: {subject}")
        return True
    if not _sg:
        logger.warning("[notify] SendGrid not configured — email not sent")
        return False
    try:
        message = Mail(
            from_email=Email(SENDGRID_FROM, SENDGRID_FROM_NAME),
            to_emails=To(to),
            subject=subject,
            plain_text_content=Content("text/plain", plain or _strip_html(html)),
            html_content=Content("text/html", html),
        )
        resp = await asyncio.to_thread(lambda: _sg.send(message))
        logger.info(f"[notify] Email sent to={to} status={resp.status_code}")
        return resp.status_code in (200, 201, 202)
    except Exception as e:
        logger.error(f"[notify] Email failed to={to}: {e}")
        return False


def _strip_html(s: str) -> str:
    import re
    return re.sub(r"<[^>]+>", " ", s)


# ---------------- High-level templates ----------------
async def notify_signup_otp(email: str, phone: str, email_code: str, phone_code: str, full_name: str = "", with_email: bool = True, with_sms: bool = True) -> dict:
    """Send signup verification OTPs via email and/or SMS (parallel).
    Returns {'email': bool, 'sms': bool} indicating delivery results.
    """
    if not IS_PROD:
        logger.info(f"[OTP] DEV email={email_code} phone={phone_code}")

    email_ok, sms_ok = False, False
    if with_email and with_sms:
        email_html = _render_otp_email(email_code, full_name)
        sms_body = f"SENDBID — Votre code de vérification : {phone_code}\nValide 3 minutes. Ne le partagez jamais."
        email_ok, sms_ok = await asyncio.gather(
            send_email(email, "SENDBID — Vérifiez votre email", email_html),
            send_sms(phone, sms_body),
            return_exceptions=False,
        )
    elif with_email:
        email_html = _render_otp_email(email_code, full_name)
        email_ok = await send_email(email, "SENDBID — Vérifiez votre email", email_html)
    elif with_sms:
        sms_body = f"SENDBID — Votre code de vérification : {phone_code}\nValide 3 minutes. Ne le partagez jamais."
        sms_ok = await send_sms(phone, sms_body)
    return {"email": bool(email_ok), "sms": bool(sms_ok)}


async def notify_password_reset(email: str, reset_url: str, full_name: str = "") -> bool:
    html = _render_reset_email(reset_url, full_name)
    return await send_email(email, "SENDBID — Réinitialisation de votre mot de passe", html)


async def notify_transfer_created(email: str, phone: str, withdrawal_code: str, amount: float, currency: str, beneficiary: str) -> dict:
    sms = f"SENDBID — Transfert créé. Code retrait : {withdrawal_code} ({amount:.0f} {currency} pour {beneficiary}). Valide 48h."
    html = _render_transfer_email(withdrawal_code, amount, currency, beneficiary)
    e_ok, s_ok = await asyncio.gather(
        send_email(email, "SENDBID — Votre transfert est confirmé", html),
        send_sms(phone, sms),
        return_exceptions=False,
    )
    return {"email": bool(e_ok), "sms": bool(s_ok)}


# ---------------- Templates ----------------
def _otp_layout(title: str, intro: str, code: str, footer: str) -> str:
    return f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background:#f8fafc;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:32px 16px;">
      <table width="600" style="max-width:100%;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.08);">
        <tr><td style="background:linear-gradient(135deg,#0F4C81,#10B981);padding:32px;text-align:center;color:#fff;">
          <div style="font-size:28px;font-weight:800;letter-spacing:2px;">SENDBID</div>
          <div style="font-size:14px;opacity:0.9;margin-top:4px;">{title}</div>
        </td></tr>
        <tr><td style="padding:32px 24px;color:#0F172A;">
          <p style="margin:0 0 16px 0;font-size:16px;">{intro}</p>
          <div style="background:#E6EFF7;border-radius:12px;padding:24px;text-align:center;margin:24px 0;">
            <div style="font-size:13px;color:#64748B;letter-spacing:1px;">CODE</div>
            <div style="font-size:36px;font-weight:800;color:#0F4C81;letter-spacing:8px;margin-top:8px;">{code}</div>
          </div>
          <p style="margin:0;font-size:13px;color:#64748B;">{footer}</p>
        </td></tr>
        <tr><td style="padding:16px 24px;background:#F8FAFC;border-top:1px solid #E2E8F0;font-size:11px;color:#94A3B8;text-align:center;">
          SENDBID — Transferts internationaux sécurisés.<br>
          Cet email est confidentiel. Si vous ne l'avez pas demandé, ignorez-le.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>"""


def _render_otp_email(code: str, name: str) -> str:
    intro = f"Bonjour{(' ' + name) if name else ''},<br>Voici votre code de vérification SENDBID :"
    footer = "Code valide 3 minutes. Ne le communiquez à personne, même à un agent SENDBID."
    return _otp_layout("Vérification d'email", intro, code, footer)


def _render_reset_email(url: str, name: str) -> str:
    return f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background:#f8fafc;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:32px 16px;">
      <table width="600" style="max-width:100%;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.08);">
        <tr><td style="background:linear-gradient(135deg,#0F4C81,#10B981);padding:32px;text-align:center;color:#fff;">
          <div style="font-size:28px;font-weight:800;letter-spacing:2px;">SENDBID</div>
          <div style="font-size:14px;opacity:0.9;margin-top:4px;">Réinitialisation du mot de passe</div>
        </td></tr>
        <tr><td style="padding:32px 24px;color:#0F172A;">
          <p style="margin:0 0 16px 0;font-size:16px;">Bonjour{(' ' + name) if name else ''},</p>
          <p style="margin:0 0 16px 0;">Vous avez demandé à réinitialiser votre mot de passe. Cliquez sur le bouton ci-dessous :</p>
          <p style="text-align:center;margin:32px 0;">
            <a href="{url}" style="background:#10B981;color:#fff;padding:14px 28px;border-radius:12px;text-decoration:none;font-weight:bold;display:inline-block;">Réinitialiser mon mot de passe</a>
          </p>
          <p style="font-size:13px;color:#64748B;">Lien valide 10 minutes. Si vous n'avez pas fait cette demande, ignorez cet email.</p>
          <p style="font-size:11px;color:#94A3B8;word-break:break-all;">URL : {url}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>"""


def _render_transfer_email(code: str, amount: float, currency: str, beneficiary: str) -> str:
    intro = f"Votre transfert vers <b>{beneficiary}</b> ({amount:.2f} {currency}) est confirmé.<br>Code de retrait à transmettre :"
    footer = "Code valide 48h. À fournir au bénéficiaire avec une pièce d'identité chez l'agent."
    return _otp_layout("Transfert confirmé", intro, code, footer)
