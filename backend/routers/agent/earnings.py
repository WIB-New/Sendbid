"""Agent operations module."""
import asyncio
import logging
from datetime import datetime, timedelta
from typing import Optional

from fastapi import Depends, HTTPException
from pydantic import BaseModel

from core.db import db, now_utc, iso, clean_doc
from core.deps import get_current_user
from core.security import gen_id
from routers.notifications import create_notification

from . import router
from .core import _require_agent
from .models import AgentSignupIn, BidIn, CompleteIn


@router.get("/earnings")
async def earnings(user: dict = Depends(get_current_user), days: int = 30):
    await _require_agent(user)  # auth gate
    since = now_utc() - timedelta(days=days)
    txs = await db.wallet_tx.find(
        {"user_id": user["id"], "type": "agent_earnings", "created_at": {"$gte": iso(since)}},
        {"_id": 0},
    ).sort("created_at", -1).to_list(500)
    total = round(sum(t.get("amount", 0) for t in txs), 2)
    return {"period_days": days, "total_eur": total, "transactions": txs}
