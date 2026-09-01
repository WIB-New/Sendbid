"""Payout providers for bank withdrawals.

- manual : the operator validates the request after doing the SEPA/wire externally.
- stripe : sends a Transfer to a Stripe Connect account (connected_account_id).

To pay out to an arbitrary IBAN automatically, the recipient must be a
Stripe Connect account. The connected_account_id must be stored in the
payout_request doc (or retrieved from the user's profile).
"""
from __future__ import annotations

import os
import logging
from typing import Any, Optional

import stripe

from core.db import db, now_utc, iso
from services.payments import STRIPE_API_KEY, _ensure_configured

logger = logging.getLogger("sendbid.payouts")

PAYOUT_PROVIDER = os.getenv("PAYOUT_PROVIDER", "manual").strip().lower()
STRIPE_CONNECT_ACCOUNT_TYPE = os.getenv("STRIPE_CONNECT_ACCOUNT_TYPE", "express").strip().lower()
DEFAULT_CONNECT_COUNTRY = os.getenv("STRIPE_CONNECT_DEFAULT_COUNTRY", "FR").strip().upper()

CONNECT_REFRESH_URL = os.getenv("STRIPE_CONNECT_REFRESH_URL", "https://api.sendbid.app/wallet/connect/refresh")
CONNECT_RETURN_URL = os.getenv("STRIPE_CONNECT_RETURN_URL", "https://sendbid.app/connect/return")


class PayoutError(Exception):
    """Raised when a provider payout cannot be completed."""


async def execute_bank_payout(payout_doc: dict) -> dict[str, Any]:
    """Execute the bank payout for a payout_request document.

    Returns a dict with:
        provider: str  (manual / stripe)
        provider_ref: str | None  (provider transaction reference)
        note: str | None
    """
    provider = PAYOUT_PROVIDER

    if provider == "stripe":
        return await _stripe_payout(payout_doc)

    # Default / manual provider: the operator settles outside the platform.
    return {
        "provider": "manual",
        "provider_ref": None,
        "note": "Paiement manuel validé par l'opérateur.",
    }


async def _stripe_payout(payout_doc: dict) -> dict[str, Any]:
    if not STRIPE_API_KEY:
        raise PayoutError(
            "STRIPE_API_KEY manquante. Vérifiez votre .env ou basculez PAYOUT_PROVIDER=manual."
        )
    _ensure_configured()

    connected_account_id = payout_doc.get("connected_account_id")
    if not connected_account_id:
        raise PayoutError(
            "Bénéficiaire sans connected_account_id Stripe. "
            "Pour automatiser les virements, le client doit avoir un compte Connect. "
            "Basculez PAYOUT_PROVIDER=manual en attendant."
        )

    amount = float(payout_doc.get("amount") or 0)
    if amount <= 0:
        raise PayoutError("Montant de retrait invalide.")

    amount_cents = int(round(amount * 100))
    try:
        transfer = await stripe.Transfer.create_async(
            amount=amount_cents,
            currency="eur",
            destination=connected_account_id,
            metadata={
                "payout_id": payout_doc.get("id"),
                "user_id": payout_doc.get("user_id"),
                "iban_last4": (payout_doc.get("iban") or "")[-4:],
            },
        )
        logger.info(
            "[stripe] payout=%s transfer=%s to=%s amount=%s",
            payout_doc.get("id"),
            transfer.id,
            connected_account_id,
            amount,
        )
        return {
            "provider": "stripe",
            "provider_ref": transfer.id,
            "note": f"Transfer Stripe {transfer.id} créé.",
        }
    except Exception as exc:
        logger.error("[stripe] payout=%s failed: %s", payout_doc.get("id"), exc)
        raise PayoutError(f"Stripe a refusé le virement : {exc}")


# ═══════════════════════════════════════════════════════════════════════
# Stripe Connect onboarding helpers
# ═══════════════════════════════════════════════════════════════════════


def _connect_capabilities() -> dict[str, Any]:
    """Express accounts need the 'transfers' capability to receive payouts."""
    if STRIPE_CONNECT_ACCOUNT_TYPE == "express":
        return {"transfers": {"requested": True}}
    return {}


def _country_code(user: dict) -> str:
    """Best-effort country code for the Connect account."""
    country = (user.get("country") or "").strip().upper()
    if len(country) == 2:
        return country
    # Try to infer from phone prefix if present
    phone = (user.get("phone") or "").strip()
    if phone.startswith("+225"):
        return "CI"
    if phone.startswith("+33"):
        return "FR"
    return DEFAULT_CONNECT_COUNTRY


async def get_user_connect_account(user_id: str) -> Optional[dict]:
    """Return the stored Connect account record for a user, if any."""
    user = await db.users.find_one({"id": user_id}, {"payout_accounts": 1})
    if not user:
        return None
    return (user.get("payout_accounts") or {}).get("stripe")


async def start_connect_onboarding(user: dict) -> dict[str, Any]:
    """Create a Stripe Connect account and an onboarding AccountLink.

    Returns {"account_id", "url"}.
    """
    if not STRIPE_API_KEY:
        raise PayoutError("STRIPE_API_KEY manquante.")
    _ensure_configured()

    user_id = user["id"]
    existing = await get_user_connect_account(user_id)
    if existing and existing.get("account_id"):
        # Recreate an onboarding link for the existing account
        account_id = existing["account_id"]
        account = await stripe.Account.retrieve_async(account_id)
        if _account_ready(account):
            return {"account_id": account_id, "url": None, "status": "ready"}
    else:
        try:
            account = await stripe.Account.create_async(
                type=STRIPE_CONNECT_ACCOUNT_TYPE,
                country=_country_code(user),
                email=(user.get("email") or "").strip(),
                metadata={"user_id": user_id, "app": "sendbid"},
                capabilities=_connect_capabilities(),
            )
        except Exception as exc:
            logger.error("[stripe] connect create account failed: %s", exc)
            raise PayoutError(f"Stripe a refusé la création du compte : {exc}")

    account_id = account.id

    try:
        link = await stripe.AccountLink.create_async(
            account=account_id,
            refresh_url=CONNECT_REFRESH_URL,
            return_url=CONNECT_RETURN_URL,
            type="account_onboarding",
        )
    except Exception as exc:
        logger.error("[stripe] connect onboarding link failed: %s", exc)
        raise PayoutError(f"Stripe a refusé le lien d'onboarding : {exc}")

    await db.users.update_one(
        {"id": user_id},
        {"$set": {
            "payout_accounts.stripe": {
                "provider": "stripe",
                "account_id": account_id,
                "ready": False,
                "country": _country_code(user),
                "created_at": iso(now_utc()),
                "updated_at": iso(now_utc()),
            },
            "updated_at": iso(now_utc()),
        }},
    )

    logger.info("[stripe] connect onboarding user=%s account=%s", user_id, account_id)
    return {"account_id": account_id, "url": link.url, "status": "onboarding"}


async def refresh_connect_status(user_id: str) -> dict[str, Any]:
    """Refresh the Stripe Connect account status and persist it."""
    record = await get_user_connect_account(user_id)
    if not record or not record.get("account_id"):
        return {"ready": False, "status": "not_started"}

    if not STRIPE_API_KEY:
        return {"ready": False, "status": "no_key"}
    _ensure_configured()

    try:
        account = await stripe.Account.retrieve_async(record["account_id"])
    except Exception as exc:
        logger.error("[stripe] retrieve account %s failed: %s", record["account_id"], exc)
        return {"ready": False, "status": "error", "error": str(exc)}

    ready = _account_ready(account)
    await db.users.update_one(
        {"id": user_id},
        {"$set": {
            "payout_accounts.stripe.ready": ready,
            "payout_accounts.stripe.requirements": getattr(
                account, "requirements", {}
            ) and account.requirements.to_dict() or {},
            "payout_accounts.stripe.updated_at": iso(now_utc()),
            "updated_at": iso(now_utc()),
        }},
    )

    return {
        "account_id": record["account_id"],
        "ready": ready,
        "status": "ready" if ready else "pending_requirements",
    }


def _account_ready(account) -> bool:
    """True if the account can receive transfers."""
    capabilities = getattr(account, "capabilities", {}) or {}
    transfers = getattr(capabilities, "transfers", None)
    if transfers == "active":
        return True
    # Some Standard accounts report this differently
    if isinstance(capabilities, dict):
        if capabilities.get("transfers") == "active":
            return True
    return False
