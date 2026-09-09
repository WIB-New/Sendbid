"""Email dispatch service with pluggable providers.

Providers:
- smtp : any SMTP server (Gmail, Outlook, Postfix, etc.) via aiosmtplib.
- sendgrid : SendGrid API (legacy, kept for compatibility).

Configuration via environment variables:
    EMAIL_PROVIDER=smtp  # or sendgrid
    SMTP_HOST=smtp.gmail.com
    SMTP_PORT=587
    SMTP_USER=contact@example.com
    SMTP_PASSWORD=app_password
    SMTP_FROM=noreply@example.com
    SMTP_FROM_NAME=SENDBID

For Gmail you MUST use an "App Password", not the account password.
"""
from __future__ import annotations

import os
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional

from core.config import IS_PROD

logger = logging.getLogger("sendbid.email")

EMAIL_PROVIDER = os.getenv("EMAIL_PROVIDER", "auto").strip().lower()

SMTP_HOST = os.getenv("SMTP_HOST", "").strip()
SMTP_PORT = int(os.getenv("SMTP_PORT", "587").strip() or 587)
SMTP_USER = os.getenv("SMTP_USER", "").strip()
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "").strip()
SMTP_FROM = os.getenv("SMTP_FROM", SMTP_USER or "noreply@sendbid.app").strip()
SMTP_FROM_NAME = os.getenv("SMTP_FROM_NAME", "SENDBID").strip()
SMTP_USE_TLS = os.getenv("SMTP_USE_TLS", "true").strip().lower() in ("1", "true", "yes")

SENDGRID_KEY = os.getenv("SENDGRID_API_KEY", "").strip()
SENDGRID_FROM = os.getenv("SENDGRID_FROM_EMAIL", SMTP_FROM or "noreply@sendbid.app").strip()
SENDGRID_FROM_NAME = os.getenv("SENDGRID_FROM_NAME", SMTP_FROM_NAME or "SENDBID").strip()

# Test guards: do NOT spam real services during dev/testing
TEST_EMAIL_DOMAINS = {"sendbid.app", "example.com", "test.com"}


def _provider() -> str:
    if EMAIL_PROVIDER in {"smtp", "sendgrid"}:
        return EMAIL_PROVIDER
    # Auto-select based on available credentials
    if SMTP_HOST and SMTP_USER and SMTP_PASSWORD:
        return "smtp"
    if SENDGRID_KEY:
        return "sendgrid"
    return "none"


def _is_test_email(addr: str) -> bool:
    if not addr:
        return True
    domain = addr.split("@")[-1].lower() if "@" in addr else ""
    return domain in TEST_EMAIL_DOMAINS


def _build_message(to: str, subject: str, html: str, plain: Optional[str] = None) -> MIMEMultipart:
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{SMTP_FROM_NAME} <{SMTP_FROM}>"
    msg["To"] = to
    msg.attach(MIMEText(plain or _strip_html(html), "plain", "utf-8"))
    msg.attach(MIMEText(html, "html", "utf-8"))
    return msg


def _strip_html(s: str) -> str:
    import re
    return re.sub(r"<[^>]+>", " ", s)


async def send_email(to: str, subject: str, html: str, plain: Optional[str] = None) -> bool:
    """Send an email. Returns True on success / skip, False on failure."""
    if _is_test_email(to):
        logger.info("[email] SKIPPED (test domain) to=%s subject=%s", to, subject)
        return True

    provider = _provider()
    if provider == "smtp":
        return await _send_smtp(to, subject, html, plain)
    if provider == "sendgrid":
        return await _send_sendgrid(to, subject, html, plain)

    logger.warning("[email] No email provider configured — email not sent")
    return False


async def _send_smtp(to: str, subject: str, html: str, plain: Optional[str] = None) -> bool:
    try:
        import aiosmtplib
    except ImportError as exc:  # pragma: no cover
        logger.error("[email] aiosmtplib not installed: %s", exc)
        return False

    msg = _build_message(to, subject, html, plain)
    try:
        await aiosmtplib.send(
            msg,
            hostname=SMTP_HOST,
            port=SMTP_PORT,
            username=SMTP_USER,
            password=SMTP_PASSWORD,
            start_tls=SMTP_USE_TLS,
        )
        logger.info("[email] SMTP sent to=%s subject=%s", to, subject)
        return True
    except Exception as exc:
        logger.error("[email] SMTP failed to=%s: %s", to, exc)
        return False


async def _send_sendgrid(to: str, subject: str, html: str, plain: Optional[str] = None) -> bool:
    try:
        from sendgrid import SendGridAPIClient
        from sendgrid.helpers.mail import Mail, Email, To, Content
    except ImportError as exc:  # pragma: no cover
        logger.error("[email] sendgrid not installed: %s", exc)
        return False

    try:
        sg = SendGridAPIClient(SENDGRID_KEY)
        message = Mail(
            from_email=Email(SENDGRID_FROM, SENDGRID_FROM_NAME),
            to_emails=To(to),
            subject=subject,
            plain_text_content=Content("text/plain", plain or _strip_html(html)),
            html_content=Content("text/html", html),
        )
        resp = await __import__("asyncio").to_thread(lambda: sg.send(message))
        logger.info("[email] SendGrid sent to=%s status=%s", to, resp.status_code)
        return resp.status_code in (200, 201, 202)
    except Exception as exc:
        logger.error("[email] SendGrid failed to=%s: %s", to, exc)
        return False


async def healthcheck() -> dict:
    """Quick sanity check for monitoring."""
    return {"provider": _provider(), "configured": _provider() != "none"}
