"""SENDBID Auth package — split from auth.py."""
from fastapi import APIRouter

router = APIRouter(prefix="/auth", tags=["auth"])

from . import core           # noqa: E402, F401
from . import otp            # noqa: E402, F401
from . import biometric      # noqa: E402, F401
from . import pin            # noqa: E402, F401
from . import password       # noqa: E402, F401
from . import contact_change # noqa: E402, F401

# Re-export all Pydantic models for backward compat
from .models import *  # noqa: E402, F401, F403

__all__ = ["router"]
