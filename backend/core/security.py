"""Auth, password, PIN, JWT, QR HMAC primitives."""
import hmac
import json
import uuid
import bcrypt
import base64
import hashlib
import random
import jwt
from datetime import timedelta
from typing import Optional

from .config import JWT_SECRET, JWT_ALG, ACCESS_TOKEN_DAYS, RESET_TOKEN_MINUTES, QR_HMAC_SECRET
from .db import now_utc


def gen_id() -> str:
    return str(uuid.uuid4())


def gen_otp() -> str:
    return f"{random.randint(0, 999999):06d}"


def gen_withdrawal_code() -> str:
    """10-digit numeric server-generated withdrawal code."""
    return f"{random.randint(0, 9999999999):010d}"


def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False


def is_weak_pin(pin: str) -> bool:
    """Reject obvious PINs to harden financial operations."""
    if not (pin and pin.isdigit() and len(pin) == 6):
        return True
    if len(set(pin)) == 1:  # 000000, 111111
        return True
    digits = [int(c) for c in pin]
    if all(digits[i + 1] - digits[i] == 1 for i in range(5)):  # 123456
        return True
    if all(digits[i] - digits[i + 1] == 1 for i in range(5)):  # 654321
        return True
    if pin in {"112233", "121212", "123123", "789456", "147258", "159753", "456789"}:
        return True
    return False


def create_access_token(user_id: str) -> str:
    return jwt.encode({"sub": user_id, "type": "access", "exp": now_utc() + timedelta(days=ACCESS_TOKEN_DAYS)}, JWT_SECRET, algorithm=JWT_ALG)


def create_reset_token(user_id: str) -> str:
    return jwt.encode({"sub": user_id, "type": "reset", "exp": now_utc() + timedelta(minutes=RESET_TOKEN_MINUTES)}, JWT_SECRET, algorithm=JWT_ALG)


def decode_token(token: str) -> dict:
    return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])


def sign_qr_payload(payload: dict) -> str:
    body = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
    sig = hmac.new(QR_HMAC_SECRET, body, hashlib.sha256).hexdigest()
    envelope = {"data": payload, "sig": sig}
    return base64.urlsafe_b64encode(json.dumps(envelope).encode()).decode()


def verify_qr_payload(token: str) -> Optional[dict]:
    try:
        envelope = json.loads(base64.urlsafe_b64decode(token.encode()))
        body = json.dumps(envelope["data"], sort_keys=True, separators=(",", ":")).encode()
        expected = hmac.new(QR_HMAC_SECRET, body, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected, envelope["sig"]):
            return None
        return envelope["data"]
    except Exception:
        return None
