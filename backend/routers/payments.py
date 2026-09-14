"""Stripe payments router — checkout sessions, status polling, webhook."""
from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from core.deps import get_current_user
from services import payments as payments_service
from routers.notifications import create_notification

logger = logging.getLogger("sendbid.payments")

router = APIRouter(prefix="/payments", tags=["payments"])


class CheckoutSessionIn(BaseModel):
    package_id: Optional[str] = None
    amount: Optional[float] = None
    origin_url: str


def _eur_to_target(amount_eur: float, target_currency: str) -> float:
    """Conversion de EUR vers la devise locale avec fallback fixe."""
    curr = target_currency.upper()
    if curr == "EUR":
        return amount_eur
    fallback = {"XOF": 655.957, "XAF": 655.957, "MAD": 10.85, "USD": 1.08, "GBP": 0.86, "CAD": 1.47, "CHF": 0.94}
    rate = fallback.get(curr, 1.0)
    return round(amount_eur * rate, 2)


@router.get("/packages")
async def list_packages(target_currency: str = "EUR", _: dict = Depends(get_current_user)):
    """Public list of recharge packages (server-defined), convertis en devise locale."""
    curr = target_currency.upper()
    packages = []
    for pid, info in payments_service.RECHARGE_PACKAGES.items():
        local_amount = _eur_to_target(info["amount"], curr)
        packages.append({
            "id": pid,
            "amount": local_amount,
            "amount_eur": info["amount"],
            "label": info["label"],
        })
    custom_min = _eur_to_target(payments_service.CUSTOM_AMOUNT_MIN, curr)
    custom_max = _eur_to_target(payments_service.CUSTOM_AMOUNT_MAX, curr)
    return {
        "packages": packages,
        "custom": {"min": custom_min, "max": custom_max, "min_eur": payments_service.CUSTOM_AMOUNT_MIN, "max_eur": payments_service.CUSTOM_AMOUNT_MAX},
        "currency": curr,
        "enabled": bool(payments_service.STRIPE_API_KEY),
    }


@router.post("/checkout/session")
async def create_checkout_session(
    payload: CheckoutSessionIn,
    request: Request,
    user: dict = Depends(get_current_user),
):
    if not payments_service.STRIPE_API_KEY:
        raise HTTPException(status_code=503, detail="Stripe non configuré")
    try:
        session = await payments_service.create_recharge_session(
            user,
            package_id=payload.package_id,
            custom_amount=payload.amount,
            origin_url=payload.origin_url,
            host_url=str(request.base_url),
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as exc:  # noqa: BLE001
        logger.exception("[stripe] checkout session creation failed: %s", exc)
        raise HTTPException(status_code=500, detail="Création de la session Stripe impossible")
    return {"url": session.url, "session_id": session.session_id}


@router.get("/checkout/status/{session_id}")
async def checkout_status(
    session_id: str,
    request: Request,
    user: dict = Depends(get_current_user),
):
    try:
        result = await payments_service.credit_wallet_if_paid(
            session_id=session_id,
            host_url=str(request.base_url),
            user_id=user["id"],
        )
    except LookupError:
        raise HTTPException(status_code=404, detail="Session inconnue")
    except Exception as exc:  # noqa: BLE001
        logger.exception("[stripe] status check failed: %s", exc)
        raise HTTPException(status_code=500, detail="Vérification du paiement impossible")

    if result.get("credited_now"):
        await create_notification(
            user["id"],
            "Recharge confirmée",
            f"+{result['amount']:.2f} EUR crédités sur votre wallet Floo Money",
        )
    return result


class PaymentIntentIn(BaseModel):
    amount: float
    currency: str = "eur"
    display_amount: Optional[float] = None
    display_currency: Optional[str] = None


class ConfirmPaymentIn(BaseModel):
    payment_intent_id: str
    amount: Optional[float] = None
    currency: Optional[str] = None


@router.post("/payment-intent")
async def create_payment_intent_endpoint(
    payload: PaymentIntentIn,
    user: dict = Depends(get_current_user),
):
    """Crée un PaymentIntent Stripe pour paiement in-app via PaymentSheet."""
    if not payments_service.STRIPE_API_KEY:
        raise HTTPException(status_code=503, detail="Stripe non configuré")
    try:
        result = await payments_service.create_payment_intent(
            user,
            amount=payload.amount,
            currency=payload.currency,
            display_amount=payload.display_amount,
            display_currency=payload.display_currency,
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as exc:  # noqa: BLE001
        logger.exception("[stripe] PaymentIntent creation failed: %s", exc)
        raise HTTPException(status_code=500, detail="Création du PaymentIntent impossible")
    return {"client_secret": result.client_secret, "payment_intent_id": result.id}


@router.post("/confirm-payment")
async def confirm_payment_endpoint(
    payload: ConfirmPaymentIn,
    user: dict = Depends(get_current_user),
):
    """Confirme un PaymentIntent et crédite le wallet si le paiement a réussi."""
    try:
        result = await payments_service.confirm_payment_intent(
            user_id=user["id"],
            payment_intent_id=payload.payment_intent_id,
        )
    except LookupError:
        raise HTTPException(status_code=404, detail="Paiement inconnu")
    except Exception as exc:  # noqa: BLE001
        logger.exception("[stripe] PaymentIntent confirm failed: %s", exc)
        raise HTTPException(status_code=500, detail="Confirmation du paiement impossible")

    if result.get("credited_now"):
        await create_notification(
            user["id"],
            "Recharge confirmée",
            f"+{result['amount']:.2f} {result['currency']} crédités sur votre wallet Floo Money",
        )
    return result
