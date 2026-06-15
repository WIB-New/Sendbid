"""Stripe payments service — refactor 12/06/2026.

Anciennement basé sur `emergentintegrations.payments.stripe.checkout`, ce module
utilise désormais le SDK officiel `stripe` (15.0.1+) avec ses méthodes async natives.

L'API publique du module reste STRICTEMENT identique pour ne pas casser
`routers/payments.py` :

    - create_recharge_session(user, *, package_id, custom_amount, origin_url, host_url)
        → renvoie un objet exposant .url et .session_id
    - get_session_status(session_id, host_url)
        → renvoie un objet exposant .status, .payment_status, .amount_total
    - credit_wallet_if_paid(session_id, *, host_url, user_id)
        → idempotent ; renvoie un dict identique à l'ancien wrapper

Wallet packages are defined server-side ONLY to prevent price manipulation.
"""
from __future__ import annotations

import os
import logging
from dataclasses import dataclass
from typing import Optional

import stripe  # SDK officiel ≥ 15.0.1 (déjà dans requirements.txt)

from core.db import db, now_utc, iso
from core.security import gen_id

logger = logging.getLogger("sendbid.payments")

STRIPE_API_KEY = os.getenv("STRIPE_API_KEY", "").strip()

# Configuration globale du SDK (idempotent — appelable plusieurs fois sans danger)
if STRIPE_API_KEY:
    stripe.api_key = STRIPE_API_KEY

# Packages serveur (pas modifiables côté frontend)
RECHARGE_PACKAGES = {
    "starter": {"amount": 20.0, "label": "Recharge Starter (20 €)"},
    "standard": {"amount": 50.0, "label": "Recharge Standard (50 €)"},
    "premium": {"amount": 100.0, "label": "Recharge Premium (100 €)"},
    "vip": {"amount": 250.0, "label": "Recharge VIP (250 €)"},
}

CUSTOM_AMOUNT_MIN = 5.0
CUSTOM_AMOUNT_MAX = 500.0


# ─────────────────────────────────────────────────────────────────────
# Réponses "compatibles" — préservent l'API publique de l'ancien wrapper
# (qui exposait .url, .session_id, .status, .payment_status, .amount_total)
# ─────────────────────────────────────────────────────────────────────
@dataclass
class CheckoutSessionResponse:
    url: str
    session_id: str


@dataclass
class CheckoutStatusResponse:
    status: str
    payment_status: str
    amount_total: Optional[int]  # cents


def _ensure_configured() -> None:
    if not STRIPE_API_KEY:
        raise RuntimeError("STRIPE_API_KEY is not configured")
    # Si la clé a été mise à jour entre-temps via env, on resynchronise
    if stripe.api_key != STRIPE_API_KEY:
        stripe.api_key = STRIPE_API_KEY


async def create_recharge_session(
    user: dict,
    *,
    package_id: Optional[str],
    custom_amount: Optional[float],
    origin_url: str,
    host_url: str,  # kept for signature compatibility (was used for webhook_url)
) -> CheckoutSessionResponse:
    """Crée une session Stripe Checkout pour la recharge wallet.

    - Résolution montant 100% côté serveur (anti-tampering).
    - Persiste une transaction "open/pending" AVANT de retourner au client.
    """
    _ensure_configured()

    # Résolution montant
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

    # Stripe Checkout : montant en cents, mode payment one-shot
    amount_cents = int(round(amount * 100))
    session = await stripe.checkout.Session.create_async(
        mode="payment",
        success_url=success_url,
        cancel_url=cancel_url,
        line_items=[{
            "price_data": {
                "currency": "eur",
                "product_data": {"name": label},
                "unit_amount": amount_cents,
            },
            "quantity": 1,
        }],
        metadata=metadata,
    )

    # Persiste la transaction pending AVANT retour
    await db.payment_transactions.insert_one({
        "id": gen_id(),
        "session_id": session.id,
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
    return CheckoutSessionResponse(url=session.url, session_id=session.id)


async def get_session_status(session_id: str, host_url: str) -> CheckoutStatusResponse:
    """Récupère le statut d'une session Stripe Checkout."""
    _ensure_configured()
    session = await stripe.checkout.Session.retrieve_async(session_id)
    return CheckoutStatusResponse(
        status=session.status or "open",
        payment_status=session.payment_status or "unpaid",
        amount_total=session.amount_total,
    )


async def credit_wallet_if_paid(
    session_id: str,
    *,
    host_url: str,
    user_id: str,
) -> dict:
    """Check Stripe status and credit the wallet exactly once.

    Returns a dict with { paid, credited, credited_now, amount, currency,
    status, payment_status, label }. Safe to call repeatedly (idempotent).

    En cas d'échec transitoire de l'appel Stripe (rate-limit, réseau…),
    on retourne l'état persisté pour ne pas casser le polling du client.
    Le webhook reste source de vérité du crédit réel.
    """
    tx = await db.payment_transactions.find_one(
        {"session_id": session_id, "user_id": user_id}, {"_id": 0}
    )
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

    # Persiste le dernier statut
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
        # Crédit atomique : on ne crédite que si le flag est encore False
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
            logger.info(
                "[stripe] credited %s EUR to user=%s session=%s",
                tx["amount"], user_id, session_id,
            )

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
