"""SENDBID — FastAPI entry point.
The monolithic server.py was split into modular packages:
- core/  — config, db, security, deps, websocket manager
- routers/ — auth, wallet, transfers, chat, beneficiaries, payment_methods, kyc, notifications, profile, misc
- seed.py — admin/demo/agent seeding
"""
import logging
import os
from fastapi import APIRouter, FastAPI, Request, HTTPException
from starlette.middleware.cors import CORSMiddleware

from core.config import ALLOWED_ORIGINS, IS_PROD
from core.db import db, now_utc, iso
from routers import auth, wallet, transfers, chat, beneficiaries, payment_methods, kyc, notifications, profile, misc, maps, payments, corridors, agent, sessions, kyc_corporate, agent_float, admin, support_chat, contacts, paypal, web_panels
from seed import seed_demo_data

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("sendbid")

app = FastAPI(title="SENDBID API", version="1.0.0")

# CORS — strict in prod (read from ALLOWED_ORIGINS), permissive in dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount HTTP routers under /api
api = APIRouter(prefix="/api")
api.include_router(auth.router)
api.include_router(wallet.router)
api.include_router(transfers.router)
api.include_router(chat.router)
api.include_router(beneficiaries.router)
api.include_router(payment_methods.router)
api.include_router(kyc.router)
api.include_router(notifications.router)
api.include_router(profile.router)
api.include_router(misc.router)
api.include_router(maps.router)
api.include_router(payments.router)
api.include_router(corridors.router)
api.include_router(agent.router)
api.include_router(sessions.router)
api.include_router(kyc_corporate.router)
api.include_router(agent_float.router)
api.include_router(admin.router)
api.include_router(support_chat.router)
api.include_router(contacts.router)
api.include_router(paypal.router)
api.include_router(web_panels.router)  # Panels web HTML — sous /api/web/* pour passer par l'ingress Kubernetes


# Stripe webhook (mounted at /api/webhook/stripe per playbook conventions)
@api.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    from services import payments as payments_service

    if not payments_service.STRIPE_API_KEY:
        raise HTTPException(status_code=503, detail="Stripe non configuré")
    import stripe as _stripe

    webhook_secret = os.getenv("STRIPE_WEBHOOK_SECRET", "").strip()
    body = await request.body()
    signature = request.headers.get("Stripe-Signature", "")
    try:
        event = _stripe.Webhook.construct_event(body, signature, webhook_secret) if webhook_secret else None
        if event is None:
            logger.warning("[stripe] webhook reçu sans secret configuré — ignoré")
            return {"received": True}
    except Exception as exc:  # noqa: BLE001
        logger.exception("[stripe] webhook verification failed: %s", exc)
        raise HTTPException(status_code=400, detail="Webhook invalide")

    session_id = None
    payment_status = None
    if event["type"] in ("checkout.session.completed", "checkout.session.async_payment_succeeded"):
        obj = event["data"]["object"]
        session_id = obj.get("id")
        payment_status = obj.get("payment_status")

    if payment_status == "paid" and session_id:
        # Update transaction + credit wallet (idempotent)
        tx = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
        if tx and not tx.get("credited"):
            marker = await db.payment_transactions.find_one_and_update(
                {"session_id": session_id, "credited": {"$ne": True}},
                {"$set": {
                    "credited": True,
                    "credited_at": iso(now_utc()),
                    "payment_status": "paid",
                    "status": "complete",
                    "updated_at": iso(now_utc()),
                }},
            )
            if marker:
                await db.wallets.update_one(
                    {"user_id": tx["user_id"]},
                    {"$inc": {"balance": tx["amount"]}},
                )
                await db.wallet_tx.insert_one({
                    "id": tx["id"] + "-wh",
                    "user_id": tx["user_id"],
                    "type": "recharge_card",
                    "amount": tx["amount"],
                    "currency": "EUR",
                    "counterparty": "Carte bancaire (Stripe)",
                    "note": tx.get("label"),
                    "session_id": session_id,
                    "via": "webhook",
                    "created_at": iso(now_utc()),
                })
                logger.info("[stripe] webhook credited %s EUR to user=%s", tx["amount"], tx["user_id"])
    return {"received": True}


@api.get("/")
async def root():
    return {"name": "SENDBID API", "version": "1.0.0", "status": "ok", "env": "prod" if IS_PROD else "dev"}


@api.get("/health")
async def health():
    """Healthcheck endpoint pour Dokploy/Traefik/Docker — vérifie la connectivité MongoDB."""
    try:
        from core.db import db
        await db.command("ping")
        return {"status": "ok", "mongo": "up"}
    except Exception as e:
        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=503, content={"status": "error", "mongo": "down", "detail": str(e)})


app.include_router(api)

# WebSocket: registered on the app (not the /api APIRouter, since k8s ingress already
# forwards /api/* to this service). The path stays /api/ws/auction/{transfer_id}.
transfers.register_websocket(app)


@app.on_event("startup")
async def on_startup():
    await seed_demo_data()


@app.on_event("shutdown")
async def on_shutdown():
    from core.db import mongo
    mongo.close()
