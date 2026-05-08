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


@router.get("/packages")
async def list_packages(_: dict = Depends(get_current_user)):
    """Public list of recharge packages (server-defined)."""
    return {
        "packages": [
            {"id": pid, **info} for pid, info in payments_service.RECHARGE_PACKAGES.items()
        ],
        "custom": {
            "min": payments_service.CUSTOM_AMOUNT_MIN,
            "max": payments_service.CUSTOM_AMOUNT_MAX,
        },
        "currency": "EUR",
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
