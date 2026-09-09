"""Notification service: real SMS + Email with French templates.

Providers are now pluggable:
- email: services/email.py (SMTP / SendGrid)
- sms: services/sms.py (Twilio / Africa's Talking)

In development mode, codes are also logged to console for easier testing.
Test domains/numbers (e.g. client@sendbid.app, +33000000000) are SKIPPED to avoid
sending real messages during automated testing.
"""
import os
import logging
import asyncio
from typing import Optional

from core.config import IS_PROD
from services.email import send_email
from services.sms import send_sms

logger = logging.getLogger("sendbid.notify")


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
