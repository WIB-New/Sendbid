"""SENDBID Web panels package — split from web_panels.py."""
from fastapi import APIRouter
from fastapi.templating import Jinja2Templates

router = APIRouter(tags=["web_panels"])
templates = Jinja2Templates(directory="templates")

# Side-effect imports
from . import utils         # noqa: E402, F401
from . import marketing     # noqa: E402, F401
from . import auth_panel    # noqa: E402, F401
from . import admin         # noqa: E402, F401
from . import superadmin    # noqa: E402, F401
from . import partner       # noqa: E402, F401

__all__ = ["router"]
