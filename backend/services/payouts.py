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
from typing import Any

import stripe

from services.payments import STRIPE_API_KEY, _ensure_configured

logger = logging.getLogger("sendbid.payouts")

PAYOUT_PROVIDER = os.getenv("PAYOUT_PROVIDER", "manual").strip().lower()


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
