"""Pydantic models for Agent."""
from typing import Optional, List
from pydantic import BaseModel


class AgentSignupIn(BaseModel):
    full_name: str
    email: str
    phone: str
    city: str
    country: str
    password: str
    # v6 — PAYBID acteurs métiers : personnes morales
    agent_type: str = "own"  # own (agent propre) | partner (partenaire) | super_agent
    parent_agent_id: Optional[str] = None  # pour les sub-agents rattachés à un super-agent
    legal_name: Optional[str] = None
    registration_number: Optional[str] = None  # SIRET/RCS
    float_currency: str = "XOF"


class BidIn(BaseModel):
    transfer_id: str
    bid_fee_percent: float
    eta_minutes: int = 30


class CompleteIn(BaseModel):
    code: str  # withdrawal_code or qr_token

