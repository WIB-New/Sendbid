"""Pydantic models for the Transfers package."""
from typing import Optional
from pydantic import BaseModel


class TransferDraftIn(BaseModel):
    destination_country: str
    destination_currency: str
    send_amount: float
    receive_amount: float
    fx_rate: float
    fee_percent: float
    delivery_mode: str
    beneficiary: dict
    delivery_details: Optional[dict] = None
    purpose: str
    source_of_funds: str
    vip_delivery: bool = False
    vip_express: bool = False
    vip_fee_amount: float = 0.0  # Frais VIP séparés (max 1% min 15€ ou 1,5% min 20€)


class ConfirmTransferIn(BaseModel):
    draft_id: str
    pin: str


class BidIn(BaseModel):
    transfer_id: str
    bid_id: str


class ValidateCodeIn(BaseModel):
    code: str


class ExtendPickupIn(BaseModel):
    days: int
