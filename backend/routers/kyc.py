"""KYC tier 1 (form) and tier 2 (Didit hosted verification)."""
import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from core.db import db, now_utc, iso
from core.deps import get_current_user
from core.security import gen_id
from routers.notifications import create_notification
from services import didit as didit_service

logger = logging.getLogger("sendbid.kyc")

router = APIRouter(prefix="/kyc", tags=["kyc"])


class KycTier1In(BaseModel):
    full_name: str
    date_of_birth: str
    nationality: str
    address: str
    city: str
    country: str
    id_type: str
    id_number: str


@router.get("")
async def get_kyc(user: dict = Depends(get_current_user)):
    return await db.kyc.find_one({"user_id": user["id"]}, {"_id": 0}) or {
        "tier": user.get("kyc_tier", 0), "status": user.get("kyc_status", "none"),
    }


@router.post("/tier1")
async def kyc_tier1(payload: KycTier1In, user: dict = Depends(get_current_user)):
    await db.kyc.update_one(
        {"user_id": user["id"]},
        {"$set": {"user_id": user["id"], **payload.model_dump(), "tier": 1, "status": "verified",
                  "submitted_at": iso(now_utc())}},
        upsert=True,
    )
    await db.users.update_one({"id": user["id"]}, {"$set": {"kyc_tier": 1, "kyc_status": "verified", "loyalty_level": "Silver"}})
    await create_notification(user["id"], "KYC Tier 1 validé", "Vos limites ont été augmentées.")
    return {"ok": True, "tier": 1}


@router.post("/tier2/start")
async def kyc_tier2_start(request: Request, user: dict = Depends(get_current_user)):
    """Create a Didit verification session (or local mock) and return its hosted URL."""
    # Progression KYC stricte : Tier 2 nécessite que Tier 1 soit déjà validé.
    if (user.get("kyc_tier") or 0) < 1:
        raise HTTPException(
            status_code=403,
            detail="Vous devez d'abord compléter le KYC Tier 1 (Bronze) avant de passer au Tier 2.",
        )
    base = str(request.base_url).rstrip("/")
    callback_url = f"{base}/api/kyc/tier2/webhook"
    try:
        session = await didit_service.create_session(
            user_id=user["id"],
            user_email=user.get("email"),
            user_phone=user.get("phone"),
            user_full_name=user.get("full_name"),
            callback_url=callback_url,
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("[kyc] tier2 start failed: %s", exc)
        raise HTTPException(status_code=502, detail="Service de vérification indisponible")

    await db.kyc_sessions.insert_one({
        "id": session["session_id"],
        "user_id": user["id"],
        "status": "pending",
        "provider": session.get("provider", "didit"),
        "verification_url": session["verification_url"],
        "raw": session.get("raw"),
        "created_at": iso(now_utc()),
    })
    return {
        "session_id": session["session_id"],
        "verification_url": session["verification_url"],
        "status": session.get("status", "Not Started"),
        "provider": session.get("provider", "didit"),
    }


@router.get("/tier2/status/{session_id}")
async def kyc_tier2_status(session_id: str, user: dict = Depends(get_current_user)):
    """Poll Didit for session result and apply tier-2 if approved (idempotent)."""
    sess = await db.kyc_sessions.find_one({"id": session_id, "user_id": user["id"]}, {"_id": 0})
    if not sess:
        raise HTTPException(status_code=404, detail="Session introuvable")

    provider = sess.get("provider", "didit")
    status_label = sess.get("status", "pending")
    decision = sess.get("decision")

    if provider == "didit":
        try:
            res = await didit_service.get_session(session_id)
            status_label = res.get("status") or status_label
            decision = res.get("decision") or decision
            await db.kyc_sessions.update_one(
                {"id": session_id},
                {"$set": {"status": status_label, "decision": decision, "raw": res.get("raw"),
                          "updated_at": iso(now_utc())}},
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning("[kyc] tier2 status poll failed: %s", exc)
            # Fall through with persisted state

    approved = didit_service.is_approved(status_label) or didit_service.is_approved(decision or "")
    promoted = False
    if approved and user.get("kyc_tier", 0) < 2:
        await db.users.update_one(
            {"id": user["id"]},
            {"$set": {"kyc_tier": 2, "kyc_status": "verified", "loyalty_level": "Gold"}},
        )
        await db.kyc.update_one(
            {"user_id": user["id"]},
            {"$set": {"tier": 2, "status": "verified", "verified_at": iso(now_utc())}},
            upsert=True,
        )
        await db.kyc_sessions.update_one(
            {"id": session_id}, {"$set": {"completed_at": iso(now_utc())}},
        )
        await create_notification(user["id"], "KYC Tier 2 validé", "Niveau Gold débloqué.")
        promoted = True

    return {
        "session_id": session_id,
        "status": status_label,
        "decision": decision,
        "approved": approved,
        "promoted": promoted,
        "provider": provider,
    }


@router.post("/tier2/complete")
async def kyc_tier2_complete(body: dict, user: dict = Depends(get_current_user)):
    """Backwards-compat endpoint kept for the demo mock-validation flow.

    For the real Didit integration, prefer GET /tier2/status/{session_id}.
    """
    session_id = body.get("session_id")
    sess = await db.kyc_sessions.find_one({"id": session_id, "user_id": user["id"]})
    if not sess:
        raise HTTPException(status_code=404, detail="Session introuvable")
    if sess.get("provider", "didit") == "didit":
        # Force a real status check via Didit
        return await kyc_tier2_status(session_id, user)
    # Mock provider — just promote
    await db.kyc_sessions.update_one({"id": session_id}, {"$set": {"status": "verified", "completed_at": iso(now_utc())}})
    await db.users.update_one({"id": user["id"]}, {"$set": {"kyc_tier": 2, "kyc_status": "verified", "loyalty_level": "Gold"}})
    await db.kyc.update_one({"user_id": user["id"]}, {"$set": {"tier": 2, "status": "verified"}}, upsert=True)
    await create_notification(user["id"], "KYC Tier 2 validé", "Niveau Gold débloqué.")
    return {"ok": True, "tier": 2}


@router.post("/tier2/webhook")
async def kyc_tier2_webhook(request: Request):
    """Didit webhook receiver. Updates the kyc_sessions doc and promotes the user
    to Tier 2 if the decision is approved."""
    try:
        payload = await request.json()
    except Exception:  # noqa: BLE001
        raise HTTPException(status_code=400, detail="Payload invalide")

    session_id = payload.get("session_id") or payload.get("id")
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id manquant")

    sess = await db.kyc_sessions.find_one({"id": session_id})
    if not sess:
        # Unknown session — silently accept to avoid 4xx storm from Didit retries
        return {"ok": True, "ignored": True}

    status_label = payload.get("status") or (payload.get("decision") or {}).get("status")
    await db.kyc_sessions.update_one(
        {"id": session_id},
        {"$set": {"status": status_label, "raw_webhook": payload, "updated_at": iso(now_utc())}},
    )

    if didit_service.is_approved(status_label or ""):
        await db.users.update_one(
            {"id": sess["user_id"]},
            {"$set": {"kyc_tier": 2, "kyc_status": "verified", "loyalty_level": "Gold"}},
        )
        await db.kyc.update_one(
            {"user_id": sess["user_id"]},
            {"$set": {"tier": 2, "status": "verified", "verified_at": iso(now_utc())}},
            upsert=True,
        )
        await create_notification(sess["user_id"], "KYC Tier 2 validé", "Niveau Gold débloqué.")
    return {"ok": True, "session_id": session_id, "status": status_label}
