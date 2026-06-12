"""SENDBID Agent package — split from agent.py."""
from fastapi import APIRouter

router = APIRouter(prefix="/agent", tags=["agent"])

from . import core         # noqa: E402, F401
from . import auctions     # noqa: E402, F401
from . import transfers    # noqa: E402, F401
from . import earnings     # noqa: E402, F401
from . import agency       # noqa: E402, F401

from .models import AgentSignupIn, BidIn, CompleteIn  # noqa: E402, F401
__all__ = ["router", "AgentSignupIn", "BidIn", "CompleteIn"]
