"""PayPal (Sandbox/Live) router — create order + capture for wallet recharge.
Uses REST v2 API directly (no SDK dep) via httpx async client.
Flow:
  1. POST /paypal/order            -> creates an order, returns approve_url + order_id
  2. Frontend opens approve_url in WebView -> user logs in & approves
  3. WebView detects return_url    -> calls POST /paypal/capture {order_id, pin}
  4. Capture verifies PayPal status, requires PIN, credits wallet, logs tx
"""
import os
import logging
from typing import Optional
import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv

from core.db import db, now_utc, iso
from core.deps import get_current_user, require_pin
from core.security import gen_id

load_dotenv()

logger = logging.getLogger("sendbid.paypal")
router = APIRouter(prefix="/paypal", tags=["paypal"])

PAYPAL_MODE = os.getenv("PAYPAL_MODE", "sandbox")
PAYPAL_CLIENT_ID = os.getenv("PAYPAL_CLIENT_ID", "")
PAYPAL_SECRET = os.getenv("PAYPAL_SECRET", "")
PAYPAL_BASE = (
    "https://api-m.sandbox.paypal.com" if PAYPAL_MODE == "sandbox"
    else "https://api-m.paypal.com"
)
PLATFORM_FEE_PCT = 0.5  # 0.5% platform fee on PayPal recharges


class CreateOrderIn(BaseModel):
    amount: float


class CaptureOrderIn(BaseModel):
    order_id: str
    pin: str


async def _paypal_token() -> str:
    """Get OAuth2 access token via client_credentials. Cached lazily in module
    state (short-lived: ~9h, but we re-request on each create for simplicity)."""
    if not PAYPAL_CLIENT_ID or not PAYPAL_SECRET:
        raise HTTPException(status_code=503, detail="PayPal non configuré sur cet environnement")
    async with httpx.AsyncClient(timeout=20.0) as cx:
        r = await cx.post(
            f"{PAYPAL_BASE}/v1/oauth2/token",
            auth=(PAYPAL_CLIENT_ID, PAYPAL_SECRET),
            data={"grant_type": "client_credentials"},
            headers={"Accept": "application/json", "Accept-Language": "en_US"},
        )
        if r.status_code != 200:
            logger.error(f"[paypal] token error {r.status_code}: {r.text[:200]}")
            raise HTTPException(status_code=502, detail="Authentification PayPal échouée")
        return r.json()["access_token"]


@router.post("/order")
async def create_order(payload: CreateOrderIn, user: dict = Depends(get_current_user)):
    """Create a PayPal order for wallet recharge. Returns approve_url for WebView."""
    if payload.amount <= 0:
        raise HTTPException(status_code=400, detail="Montant invalide")
    if payload.amount > 5000:
        raise HTTPException(status_code=400, detail="Montant maximum: 5000 EUR")

    fee = round(payload.amount * PLATFORM_FEE_PCT / 100, 2)
    total = round(payload.amount + fee, 2)

    token = await _paypal_token()
    backend_url = os.getenv("PUBLIC_BACKEND_URL", "")
    return_url = f"{backend_url}/api/paypal/return"
    cancel_url = f"{backend_url}/api/paypal/cancel"

    order_body = {
        "intent": "CAPTURE",
        "purchase_units": [{
            "reference_id": user["id"],
            "description": "SENDBID Wallet Recharge",
            "amount": {
                "currency_code": "EUR",
                "value": f"{total:.2f}",
                "breakdown": {
                    "item_total": {"currency_code": "EUR", "value": f"{payload.amount:.2f}"},
                    "handling": {"currency_code": "EUR", "value": f"{fee:.2f}"},
                },
            },
        }],
        "application_context": {
            "brand_name": "SENDBID",
            "user_action": "PAY_NOW",
            "return_url": return_url,
            "cancel_url": cancel_url,
        },
    }
    async with httpx.AsyncClient(timeout=20.0) as cx:
        r = await cx.post(
            f"{PAYPAL_BASE}/v2/checkout/orders",
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            json=order_body,
        )
    if r.status_code not in (200, 201):
        logger.error(f"[paypal] order error {r.status_code}: {r.text[:300]}")
        raise HTTPException(status_code=502, detail="Création commande PayPal échouée")
    data = r.json()
    approve_url = next((l["href"] for l in data.get("links", []) if l.get("rel") == "approve"), None)

    # Persist a pending recharge intent for audit + capture validation
    await db.paypal_orders.insert_one({
        "id": data["id"], "user_id": user["id"], "amount": payload.amount,
        "fee": fee, "total": total, "currency": "EUR",
        "status": "CREATED", "approve_url": approve_url,
        "created_at": iso(now_utc()),
    })
    return {"order_id": data["id"], "approve_url": approve_url, "amount": payload.amount, "fee": fee, "total": total}


@router.post("/capture")
async def capture_order(payload: CaptureOrderIn, user: dict = Depends(get_current_user)):
    """Capture a PayPal-approved order. Requires PIN. Credits wallet atomically."""
    if not payload.pin or len(payload.pin) != 6:
        raise HTTPException(status_code=400, detail="Code PIN à 6 chiffres requis")
    await require_pin(user["id"], payload.pin)

    order_doc = await db.paypal_orders.find_one({"id": payload.order_id, "user_id": user["id"]})
    if not order_doc:
        raise HTTPException(status_code=404, detail="Commande PayPal introuvable")
    if order_doc.get("status") == "CAPTURED":
        raise HTTPException(status_code=400, detail="Commande déjà capturée")

    token = await _paypal_token()
    async with httpx.AsyncClient(timeout=20.0) as cx:
        r = await cx.post(
            f"{PAYPAL_BASE}/v2/checkout/orders/{payload.order_id}/capture",
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        )
    if r.status_code not in (200, 201):
        logger.error(f"[paypal] capture error {r.status_code}: {r.text[:300]}")
        raise HTTPException(status_code=402, detail="Capture PayPal échouée — paiement non finalisé")
    data = r.json()
    if data.get("status") != "COMPLETED":
        raise HTTPException(status_code=402, detail=f"Statut PayPal: {data.get('status', 'unknown')}")

    # Credit wallet
    amount = order_doc["amount"]
    credited = await db.wallets.find_one_and_update(
        {"user_id": user["id"]},
        {"$inc": {"balance": amount}},
        return_document=True,
    )
    if not credited:
        raise HTTPException(status_code=500, detail="Crédit wallet échoué")

    tx_id = gen_id()
    await db.wallet_tx.insert_one({
        "id": tx_id, "user_id": user["id"], "type": "recharge_paypal",
        "amount": amount, "currency": "EUR",
        "fee": order_doc.get("fee", 0),
        "counterparty": "PayPal", "note": f"Recharge PayPal #{payload.order_id[:8]}",
        "created_at": iso(now_utc()),
    })
    await db.paypal_orders.update_one(
        {"id": payload.order_id},
        {"$set": {"status": "CAPTURED", "captured_at": iso(now_utc())}},
    )
    return {"ok": True, "tx_id": tx_id, "amount": amount, "new_balance": credited["balance"]}


@router.get("/return")
async def paypal_return(token: Optional[str] = None, PayerID: Optional[str] = None):
    """PayPal redirects here after user approval. Frontend WebView detects this URL
    and triggers /paypal/capture. We respond with a simple HTML to close the WebView."""
    html = f"""<!doctype html><html><head><meta charset='utf-8'><title>Paiement approuvé</title>
    <style>body{{font-family:sans-serif;text-align:center;padding:40px;background:#022a6b;color:white}}
    h1{{margin:20px 0}}.ok{{font-size:64px}}</style></head>
    <body><div class='ok'>✓</div><h1>Paiement approuvé</h1>
    <p>Vous pouvez fermer cette fenêtre. Votre wallet sera crédité après confirmation PIN.</p>
    <p style='opacity:.5;font-size:11px'>Order: {token or ''}</p></body></html>"""
    from fastapi.responses import HTMLResponse
    return HTMLResponse(html)


@router.get("/cancel")
async def paypal_cancel():
    from fastapi.responses import HTMLResponse
    html = """<!doctype html><html><head><meta charset='utf-8'><title>Paiement annulé</title>
    <style>body{font-family:sans-serif;text-align:center;padding:40px;background:#7f1d1d;color:white}</style></head>
    <body><h1>Paiement annulé</h1><p>Vous pouvez fermer cette fenêtre.</p></body></html>"""
    from fastapi.responses import HTMLResponse
    return HTMLResponse(html)
