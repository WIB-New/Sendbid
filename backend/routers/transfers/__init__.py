"""SENDBID Transfers package — split from original monolithic transfers.py.

Aggregates 3 functional layers behind a single APIRouter:
  - core.py     : draft, confirm, list, get, validate-code, fx-rate, extend-pickup
  - auction.py  : auction logic + bid endpoints + WebSocket helpers
  - receipts.py : PDF receipt download

`router` and `register_websocket` are re-exported so server.py keeps working unchanged:
  from routers import transfers
  api.include_router(transfers.router)
  transfers.register_websocket(app)
"""
from fastapi import APIRouter

# Master router — all sub-modules attach endpoints to this instance
router = APIRouter(prefix="/transfers", tags=["transfers"])

# Side-effect imports : decorators in each module register their routes on `router`
from . import core      # noqa: E402, F401
from . import auction   # noqa: E402, F401
from . import receipts  # noqa: E402, F401

# Re-export WebSocket registration helper
from .auction import register_websocket  # noqa: E402, F401

# Re-export Pydantic models for backward compatibility (misc.py imports TransferDraftIn)
from .models import (  # noqa: E402, F401
    TransferDraftIn,
    ConfirmTransferIn,
    BidIn,
    ValidateCodeIn,
    ExtendPickupIn,
)

__all__ = [
    "router", "register_websocket",
    "TransferDraftIn", "ConfirmTransferIn", "BidIn", "ValidateCodeIn", "ExtendPickupIn",
]
