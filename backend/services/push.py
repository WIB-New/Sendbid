"""Push notifications service — supports both Expo push tokens and native FCM tokens.

- ExponentPushToken[...] → Expo push API (https://exp.host/--/api/v2/push/send)
- raw FCM device token → Firebase Admin SDK (.messaging.send)

This dual-path design lets the app work in Expo Go (Expo tokens) AND in
production EAS/native builds (real FCM tokens), without touching the caller.
"""
from __future__ import annotations

import os
import logging
from pathlib import Path
from typing import Optional

import httpx

logger = logging.getLogger("sendbid.push")

FIREBASE_CREDENTIALS_PATH = os.getenv(
    "FIREBASE_CREDENTIALS_PATH", "/app/backend/secrets/firebase-service-account.json"
)

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"

_firebase_initialized = False
_firebase_app = None
_messaging = None


def _maybe_init_firebase() -> bool:
    global _firebase_initialized, _firebase_app, _messaging
    if _firebase_initialized:
        return _firebase_app is not None
    _firebase_initialized = True
    try:
        if not Path(FIREBASE_CREDENTIALS_PATH).exists():
            logger.info("[push] firebase service account file missing, FCM disabled")
            return False
        import firebase_admin
        from firebase_admin import credentials, messaging

        cred = credentials.Certificate(FIREBASE_CREDENTIALS_PATH)
        _firebase_app = firebase_admin.initialize_app(cred, name="sendbid")
        _messaging = messaging
        logger.info("[push] firebase admin initialized for project=%s", cred.project_id)
        return True
    except Exception as exc:  # noqa: BLE001
        logger.warning("[push] firebase admin init failed: %s", exc)
        return False


def is_expo_token(token: str) -> bool:
    return bool(token) and (token.startswith("ExponentPushToken[") or token.startswith("ExpoPushToken["))


async def send_to_token(
    token: str,
    title: str,
    body: str,
    data: Optional[dict] = None,
) -> dict:
    """Send a single push notification. Routes by token format.

    Returns {ok: bool, provider: str, detail?: str}.
    Never raises — failures are logged + returned to the caller.
    """
    if not token:
        return {"ok": False, "provider": "none", "detail": "empty token"}

    if is_expo_token(token):
        return await _send_expo(token, title, body, data or {})
    return await _send_fcm(token, title, body, data or {})


async def _send_expo(token: str, title: str, body: str, data: dict) -> dict:
    payload = {
        "to": token,
        "title": title,
        "body": body,
        "sound": "default",
        "data": data,
        "priority": "high",
    }
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.post(EXPO_PUSH_URL, json=payload, headers={"Accept": "application/json"})
            j = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
        if r.status_code == 200 and (j.get("data", {}).get("status") in {"ok", None}):
            return {"ok": True, "provider": "expo", "ticket": j.get("data")}
        logger.warning("[push] expo send failed status=%s body=%s", r.status_code, j)
        return {"ok": False, "provider": "expo", "detail": j or r.text}
    except Exception as exc:  # noqa: BLE001
        logger.warning("[push] expo send exception: %s", exc)
        return {"ok": False, "provider": "expo", "detail": str(exc)}


async def _send_fcm(token: str, title: str, body: str, data: dict) -> dict:
    if not _maybe_init_firebase() or not _messaging:
        return {"ok": False, "provider": "fcm", "detail": "firebase admin unavailable"}
    try:
        # firebase_admin is sync; offload to a thread to keep the loop free
        import asyncio

        msg = _messaging.Message(
            token=token,
            notification=_messaging.Notification(title=title, body=body),
            data={k: str(v) for k, v in (data or {}).items()},
        )
        message_id = await asyncio.to_thread(_messaging.send, msg, app=_firebase_app)
        return {"ok": True, "provider": "fcm", "message_id": message_id}
    except Exception as exc:  # noqa: BLE001
        logger.warning("[push] fcm send failed: %s", exc)
        return {"ok": False, "provider": "fcm", "detail": str(exc)}


async def send_to_user(db, user_id: str, title: str, body: str, data: Optional[dict] = None) -> list[dict]:
    """Look up all registered push tokens for a user and send to each."""
    import json
    rows = await db.push_tokens.find({"user_id": user_id, "active": True}, {"_id": 0}).to_list(20)
    results = []
    for row in rows:
        res = await send_to_token(row["token"], title, body, data)
        results.append({**res, "token": row["token"][:20] + "…"})
        if not res.get("ok"):
            # Normalise detail (may be string OR parsed JSON dict from Expo) before scanning
            raw_detail = res.get("detail")
            if isinstance(raw_detail, dict):
                detail_str = json.dumps(raw_detail).lower()
            else:
                detail_str = (raw_detail or "").lower() if isinstance(raw_detail, str) else ""
            if any(kw in detail_str for kw in (
                "notregistered", "deviceunregistered", "invalidregistration",
                "device_not_registered", "invalid_registration",
            )):
                await db.push_tokens.update_one({"token": row["token"]}, {"$set": {"active": False}})
    return results
