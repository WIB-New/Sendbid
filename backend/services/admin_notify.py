"""Admin notification service — sends automatic email/SMS to clients
when an admin performs an action on their account.

This ensures transparency: clients are always informed when their account
is modified by staff (password reset, suspension, KYC decision, etc.).
"""
import logging
from typing import Optional

from services.notify import send_email, send_sms

logger = logging.getLogger("sendbid.admin_notify")


async def notify_admin_action(
    *,
    user_email: str = "",
    user_phone: str = "",
    user_name: str = "",
    action_label: str,          # Human-readable action, e.g. "Votre compte a été suspendu"
    detail: str = "",           # Additional context, e.g. reason
    actor_name: str = "L'équipe SENDBID",
    app_brand: str = "SENDBID",
) -> dict:
    """Send an automatic notification (email + in-app) to a client
    when an admin action affects their account.

    Returns {"email": bool} indicating delivery status.
    """
    email_ok = False
    if user_email:
        html = _render_admin_action_email(user_name, action_label, detail, actor_name, app_brand)
        plain = f"{app_brand} — {action_label}. {detail}".strip()
        subject = f"{app_brand} — {action_label}"
        email_ok = await send_email(user_email, subject, html, plain=plain)

    # Log for audit trail
    logger.info(
        f"[admin_notify] action='{action_label}' user='{user_email}' email_sent={email_ok}"
    )
    return {"email": email_ok}


def _render_admin_action_email(
    name: str,
    action_label: str,
    detail: str,
    actor_name: str,
    brand: str,
) -> str:
    """Professional HTML email template for admin action notifications."""
    greeting = f"Bonjour {name}," if name else "Bonjour,"
    brand_gradient = "#0F4C81,#10B981" if brand == "SENDBID" else "#994A26,#D4A574"

    return f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background:#f8fafc;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:32px 16px;">
      <table width="600" style="max-width:100%;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.08);">
        <tr><td style="background:linear-gradient(135deg,{brand_gradient});padding:32px;text-align:center;color:#fff;">
          <div style="font-size:28px;font-weight:800;letter-spacing:2px;">{brand}</div>
          <div style="font-size:14px;opacity:0.9;margin-top:4px;">Notification de sécurité</div>
        </td></tr>
        <tr><td style="padding:32px 24px;color:#0F172A;">
          <p style="margin:0 0 16px 0;font-size:16px;">{greeting}</p>
          <p style="margin:0 0 16px 0;font-size:16px;"><b>{action_label}</b></p>
          {f'<p style="margin:0 0 16px 0;color:#475569;">{detail}</p>' if detail else ''}
          <div style="background:#F1F5F9;border-radius:12px;padding:16px;margin:24px 0;">
            <p style="margin:0;font-size:13px;color:#64748B;">
              Cette action a été effectuée par <b>{actor_name}</b>.
              Si vous n'êtes pas à l'origine de cette demande ou si vous avez une question,
              contactez notre support à <a href="mailto:support@{brand.lower()}.app" style="color:#0F4C81;">support@{brand.lower()}.app</a>.
            </p>
          </div>
          <p style="margin:0;font-size:13px;color:#64748B;">
            Pour votre sécurité, ne partagez jamais votre mot de passe ou code PIN.
            L'équipe {brand} ne vous demandera jamais ces informations.
          </p>
        </td></tr>
        <tr><td style="padding:16px 24px;background:#F8FAFC;border-top:1px solid #E2E8F0;font-size:11px;color:#94A3B8;text-align:center;">
          {brand} — Transferts internationaux sécurisés.<br>
          Cet email est confidentiel. Si vous n'avez pas demandé cette notification, contactez le support.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>"""
