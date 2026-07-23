"""Centralised configuration loaded from .env."""
import os
from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parent.parent
load_dotenv(ROOT_DIR / ".env")

ENVIRONMENT = os.getenv("ENVIRONMENT", "development").lower()
IS_PROD = ENVIRONMENT == "production"

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALG = "HS256"
ACCESS_TOKEN_DAYS = 7
RESET_TOKEN_MINUTES = 10
QR_HMAC_SECRET = os.environ["QR_HMAC_SECRET"].encode()

ADMIN_EMAIL = os.environ["ADMIN_EMAIL"]
ADMIN_PASSWORD = os.environ["ADMIN_PASSWORD"]
SUPER_ADMIN_EMAIL = os.getenv("SUPER_ADMIN_EMAIL", "superadmin@sendbid.app")
SUPER_ADMIN_PASSWORD = os.getenv("SUPER_ADMIN_PASSWORD", "SuperAdmin@123!")
DEMO_CLIENT_EMAIL = os.environ["DEMO_CLIENT_EMAIL"]
DEMO_CLIENT_PASSWORD = os.environ["DEMO_CLIENT_PASSWORD"]
DEMO_CLIENT_PIN = os.environ["DEMO_CLIENT_PIN"]

_origins_raw = os.getenv("ALLOWED_ORIGINS", "*")
ALLOWED_ORIGINS = [o.strip() for o in _origins_raw.split(",")] if _origins_raw else ["*"]
