"""Audit log service — tracks every admin action on user accounts.

All actions performed by admin/super_admin on client accounts are logged
to the `audit_logs` MongoDB collection for compliance and traceability.
"""
import logging
from datetime import datetime, timezone
from typing import Optional

from core.db import db, now_utc, iso
from core.security import gen_id

logger = logging.getLogger("sendbid.audit")


async def log_action(
    *,
    actor_id: str,
    actor_role: str,
    actor_name: str = "",
    action: str,
    target_type: str,          # "user" | "agent" | "transfer" | "kyc" | "linked_account" | "rate" | "personnel" | "support"
    target_id: str = "",
    target_name: str = "",
    details: Optional[dict] = None,
    ip_address: str = "",
    user_agent: str = "",
) -> str:
    """Record an admin action in the audit log.

    Returns the audit log entry ID.
    """
    entry = {
        "id": gen_id(),
        "actor_id": actor_id,
        "actor_role": actor_role,
        "actor_name": actor_name,
        "action": action,           # e.g. "suspend", "reactivate", "delete", "set_password", "kyc_approve", etc.
        "target_type": target_type,
        "target_id": target_id,
        "target_name": target_name,
        "details": details or {},
        "ip_address": ip_address,
        "user_agent": user_agent,
        "created_at": iso(now_utc()),
    }
    await db.audit_logs.insert_one(entry)
    entry.pop("_id", None)
    logger.info(
        f"[audit] {actor_role}:{actor_id} performed '{action}' on {target_type}:{target_id}"
    )
    return entry["id"]


async def get_recent_logs(limit: int = 100, skip: int = 0, actor_role: str = "", target_type: str = "") -> list[dict]:
    """Fetch recent audit log entries with optional filters."""
    q: dict = {}
    if actor_role:
        q["actor_role"] = actor_role
    if target_type:
        q["target_type"] = target_type
    try:
        return await db.audit_logs.find(q, {"_id": 0}).sort("created_at", -1).skip(skip).to_list(limit)
    except Exception as exc:
        logger.warning("[audit] get_recent_logs failed: %s", exc)
        return []


async def get_logs_for_target(target_id: str, limit: int = 50) -> list[dict]:
    """Fetch all audit log entries for a specific target (e.g. a user account)."""
    try:
        return await db.audit_logs.find({"target_id": target_id}, {"_id": 0}).sort("created_at", -1).to_list(limit)
    except Exception as exc:
        logger.warning("[audit] get_logs_for_target failed: %s", exc)
        return []
