"""Wallet operations module."""
from datetime import timedelta
from typing import Optional

from fastapi import Depends, HTTPException

from core.db import db, now_utc, iso
from core.deps import get_current_user, require_pin
from core.security import gen_id, sign_qr_payload
from routers.notifications import create_notification

from . import router



@router.get("")
async def get_wallet(user: dict = Depends(get_current_user)):
    return await db.wallets.find_one({"user_id": user["id"]}, {"_id": 0})


@router.get("/transactions")
async def wallet_transactions(user: dict = Depends(get_current_user), limit: int = 50):
    return await db.wallet_tx.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(limit)

