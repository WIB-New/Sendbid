"""Didit KYC service — Tier 2 identity verification.

Creates a verification session via the Didit hosted flow and exposes a
helper to poll the session result. Falls back to a local mock when the
API key is not configured (so the demo flow keeps working).

Docs: https://docs.didit.me/sessions-api/create-session
"""
from __future__ import annotations

import os
import logging
from typing import Optional

import httpx

logger = logging.getLogger("sendbid.didit")

DIDIT_API_KEY = os.getenv("DIDIT_API_KEY", "").strip()
DIDIT_WORKFLOW_ID = os.getenv("DIDIT_WORKFLOW_ID", "").strip()

DIDIT_BASE = "https://verification.didit.me"


def is_configured() -> bool:
    return bool(DIDIT_API_KEY and DIDIT_WORKFLOW_ID)


async def create_session(
    *,
    user_id: str,
    user_email: Optional[str] = None,
    user_phone: Optional[str] = None,
    user_full_name: Optional[str] = None,
    callback_url: Optional[str] = None,
) -> dict:
    """Create a Didit verification session. Returns dict with at least
    `session_id` (str), `verification_url` (str), `status` (str), `provider` (str).
    """
    if not is_configured():
        # Local mock — keeps the UI flow testable without a Didit account
        from core.security import gen_id  # local import to avoid cycle
        sid = gen_id()
        return {
            "session_id": sid,
            "verification_url": f"https://verify.didit.me/session/{sid}?mock=1",
            "status": "Not Started",
            "provider": "mock",
        }

    payload: dict = {
        "workflow_id": DIDIT_WORKFLOW_ID,
        "vendor_data": user_id,
    }
    contact: dict = {}
    if user_email:
        contact["email"] = user_email
    if user_phone:
        contact["phone"] = user_phone
    if contact:
        payload["contact_details"] = contact
    if user_full_name:
        # Didit uses expected_details to pre-validate
        payload["expected_details"] = {"first_name": user_full_name.split(" ")[0],
                                       "last_name": " ".join(user_full_name.split(" ")[1:]) or user_full_name}
    if callback_url:
        payload["callback"] = callback_url

    headers = {"x-api-key": DIDIT_API_KEY, "Content-Type": "application/json"}
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.post(f"{DIDIT_BASE}/v3/session/", json=payload, headers=headers)
            data = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
        if r.status_code >= 400:
            logger.warning("[didit] create_session failed status=%s body=%s", r.status_code, data)
            raise RuntimeError(f"Didit API error {r.status_code}: {data}")
        return {
            "session_id": data.get("session_id") or data.get("id"),
            "session_token": data.get("session_token"),
            "verification_url": data.get("url") or data.get("verification_url"),
            "status": data.get("status", "Not Started"),
            "provider": "didit",
            "raw": data,
        }
    except Exception as exc:  # noqa: BLE001
        logger.exception("[didit] create_session exception: %s", exc)
        raise


async def get_session(session_id: str) -> dict:
    if not is_configured():
        return {"session_id": session_id, "status": "Approved", "provider": "mock", "decision": "approved"}

    headers = {"x-api-key": DIDIT_API_KEY}
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.get(f"{DIDIT_BASE}/v3/session/{session_id}/", headers=headers)
            data = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
        if r.status_code >= 400:
            logger.warning("[didit] get_session failed status=%s body=%s", r.status_code, data)
            raise RuntimeError(f"Didit API error {r.status_code}")
        # Didit terminal statuses: "Approved", "Declined", "Pending Review", "In Review", "Expired"
        return {
            "session_id": session_id,
            "status": data.get("status"),
            "decision": (data.get("decision") or {}).get("status") if isinstance(data.get("decision"), dict) else data.get("decision"),
            "provider": "didit",
            "raw": data,
        }
    except Exception as exc:  # noqa: BLE001
        logger.exception("[didit] get_session exception: %s", exc)
        raise


def is_approved(status: str) -> bool:
    if not status:
        return False
    s = status.lower()
    return s in {"approved", "verified", "completed", "success"}
