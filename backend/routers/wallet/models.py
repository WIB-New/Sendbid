"""Pydantic models for Wallet."""
from typing import Optional
from pydantic import BaseModel


class P2PTransferIn(BaseModel):
    recipient_identifier: str
    amount: float
    note: Optional[str] = None
    pin: str


class BankWithdrawIn(BaseModel):
    amount: float
    method: str = "bank"
    details: dict
    pin: str
