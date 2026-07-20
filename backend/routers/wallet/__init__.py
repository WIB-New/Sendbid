"""SENDBID Wallet package — split from wallet.py."""
from fastapi import APIRouter

router = APIRouter(prefix="/wallet", tags=["wallet"])

from . import core            # noqa: E402, F401
from . import withdraw        # noqa: E402, F401
from . import recharge        # noqa: E402, F401
from . import p2p             # noqa: E402, F401
from . import linked_accounts # noqa: E402, F401

from .models import P2PTransferIn, BankWithdrawIn  # noqa: E402, F401
__all__ = ["router", "P2PTransferIn", "BankWithdrawIn"]
