"""Stripe payments service — wraps the emergentintegrations Stripe Checkout client.

Public functions:
- create_recharge_session(user, package_id|amount, origin_url) → CheckoutSessionResponse
- get_session_status(session_id) → CheckoutStatusResponse
- credit_wallet_if_paid(session_id, user_id) → idempotent; returns True if newly credited

Wallet packages are defined server-side ONLY to prevent price manipulation.
"""
from __future__ import annotations

import os
import logging
from typing import Optional

from emergentintegrations.payments.stripe.checkout import (
    StripeCheckout,
    CheckoutSessionRequest,
    CheckoutSessionResponse,
    CheckoutStatusResponse,
)

from core.db import db, now_utc, iso
from core.security import gen_id

logger = logging.getLogger("sendbid.payments")

STRIPE_API_KEY = os.getenv("STRIPE_API_KEY", "").strip()

# Server-defined recharge packages (EUR) — frontend can ONLY pick a package id.
RECHARGE_PACKAGES = {
    "starter": {"amount": 20.0, "label": "Recharge Starter (20 €)"},
    "standard": {"amount": 50.0, "label": "Recharge Standard (50 €)"},
    "premium": {"amount": 100.0, "label": "Recharge Premium (100 €)"},
    "vip": {"amount": 250.0, "label": "Recharge VIP (250 €)"},
}

# Custom amount limits to prevent abuse if "custom" is used by the frontend
CUSTOM_AMOUNT_MIN = 5.0
CUSTOM_AMOUNT_MAX = 500.0


def _client(host_url: str) -> StripeCheckout:
    if not STRIPE_API_KEY:
        raise RuntimeError("STRIPE_API_KEY is not configured")
    webhook_url = host_url.rstrip("/") + "/api/webhook/stripe"
    return StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)


async def create_recharge_session(
    user: dict,
    *,
    package_id: Optional[str],
    custom_amount: Optional[float],
    origin_url: str,
    host_url: str,
) -> CheckoutSessionResponse:
    # Resolve amount server-side ONLY
    if package_id and package_id in RECHARGE_PACKAGES:
        amount = RECHARGE_PACKAGES[package_id]["amount"]
        label = RECHARGE_PACKAGES[package_id]["label"]
    elif custom_amount is not None:
        if custom_amount < CUSTOM_AMOUNT_MIN or custom_amount > CUSTOM_AMOUNT_MAX:
            raise ValueError(
                f"Montant hors limites ({CUSTOM_AMOUNT_MIN:.0f}–{CUSTOM_AMOUNT_MAX:.0f} EUR)"
            )
        amount = round(float(custom_amount), 2)
        label = f"Recharge personnalisée ({amount:.2f} €)"
    else:
        raise ValueError("Aucun montant valide fourni")

    success_url = origin_url.rstrip("/") + "/wallet/recharge?session_id={CHECKOUT_SESSION_ID}"
    cancel_url = origin_url.rstrip("/") + "/wallet/recharge?cancelled=1"

    metadata = {
        "user_id": user["id"],
        "profile_id": user.get("profile_id", ""),
        "type": "wallet_recharge",
        "package_id": package_id or "custom",
        "label": label,
    }

    client = _client(host_url)
    req = CheckoutSessionRequest(
        amount=amount,
        currency="eur",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata=metadata,
    )
    session: CheckoutSessionResponse = await client.create_checkout_session(req)

    # Persist a pending transaction BEFORE returning to the client
    await db.payment_transactions.insert_one({
        "id": gen_id(),
        "session_id": session.session_id,
        "user_id": user["id"],
        "amount": amount,
        "currency": "EUR",
        "package_id": package_id or "custom",
        "label": label,
        "metadata": metadata,
        "status": "open",
        "payment_status": "pending",
        "credited": False,
        "created_at": iso(now_utc()),
        "updated_at": iso(now_utc()),
    })
    return session


async def get_session_status(session_id: str, host_url: str) -> CheckoutStatusResponse:
    client = _client(host_url)
    return await client.get_checkout_status(session_id)


async def credit_wallet_if_paid(
    session_id: str,
    *,
    host_url: str,
    user_id: str,
) -> dict:
    """Check Stripe status and credit the wallet exactly once.

    Returns a dict with { paid: bool, credited_now: bool, amount, status, payment_status }.
    Safe to call repeatedly (idempotent via the 'credited' flag).

    If Stripe.retrieve() fails (e.g., emergent proxy can't yet expose the session,
    or transient error), we gracefully fall back to the persisted state from
    `payment_transactions` so the polling client doesn't see a 500. Webhook
    remains the source of truth for actual credit.
    """
    tx = await db.payment_transactions.find_one({"session_id": session_id, "user_id": user_id}, {"_id": 0})
    if not tx:
        raise LookupError("Transaction inconnue")

    try:
        status = await get_session_status(session_id, host_url)
    except Exception as exc:  # noqa: BLE001
        logger.warning("[stripe] get_session_status failed (returning persisted state): %s", exc)
        return {
            "paid": bool(tx.get("credited")),
            "credited": bool(tx.get("credited")),
            "credited_now": False,
            "amount": tx["amount"],
            "currency": tx["currency"],
            "status": tx.get("status", "open"),
            "payment_status": tx.get("payment_status", "pending"),
            "label": tx.get("label"),
            "fallback": True,
        }

    paid = status.payment_status == "paid"

    # Persist latest status
    await db.payment_transactions.update_one(
        {"session_id": session_id},
        {"$set": {
            "status": status.status,
            "payment_status": status.payment_status,
            "amount_total_cents": status.amount_total,
            "updated_at": iso(now_utc()),
        }},
    )

    credited_now = False
    if paid and not tx.get("credited"):
        # Atomic single-credit: only credit if the flag is still False
        marker = await db.payment_transactions.find_one_and_update(
            {"session_id": session_id, "credited": {"$ne": True}},
            {"$set": {"credited": True, "credited_at": iso(now_utc())}},
        )
        if marker:
            await db.wallets.update_one(
                {"user_id": user_id},
                {"$inc": {"balance": tx["amount"]}},
            )
            await db.wallet_tx.insert_one({
                "id": gen_id(),
                "user_id": user_id,
                "type": "recharge_card",
                "amount": tx["amount"],
                "currency": "EUR",
                "counterparty": "Carte bancaire (Stripe)",
                "note": tx.get("label"),
                "session_id": session_id,
                "created_at": iso(now_utc()),
            })
            credited_now = True
            logger.info("[stripe] credited %s EUR to user=%s session=%s", tx["amount"], user_id, session_id)

    return {
        "paid": paid,
        "credited": tx.get("credited") or credited_now,
        "credited_now": credited_now,
        "amount": tx["amount"],
        "currency": tx["currency"],
        "status": status.status,
        "payment_status": status.payment_status,
        "label": tx.get("label"),
    }
