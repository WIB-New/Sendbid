"""Payment methods CRUD: card, Apple/Google Pay, PayPal, MoMo."""
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from core.db import db, now_utc, iso, clean_doc
from core.deps import get_current_user
from core.security import gen_id

router = APIRouter(prefix="/payment-methods", tags=["payment-methods"])


class PaymentMethodIn(BaseModel):
    type: str
    label: Optional[str] = None
    last4: Optional[str] = None
    operator: Optional[str] = None
    provider: Optional[str] = None
    brand: Optional[str] = None
    holder: Optional[str] = None
    exp_month: Optional[int] = None
    exp_year: Optional[int] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    save: Optional[bool] = True


@router.get("")
async def list_pm(user: dict = Depends(get_current_user)):
    return await db.payment_methods.find({"user_id": user["id"]}, {"_id": 0}).to_list(50)


@router.post("")
async def add_pm(payload: PaymentMethodIn, user: dict = Depends(get_current_user)):
    body = payload.model_dump(exclude_none=True)
    # v6 — auto-derive label si le frontend n'en fournit pas
    if not body.get("label"):
        brand = body.get("brand") or body.get("type") or "Carte"
        last4 = body.get("last4") or "****"
        body["label"] = f"{brand.title()} •••• {last4}"
    doc = {"id": gen_id(), "user_id": user["id"], **body, "created_at": iso(now_utc())}
    await db.payment_methods.insert_one(dict(doc))
    return clean_doc(dict(doc))


@router.delete("/{pid}")
async def del_pm(pid: str, user: dict = Depends(get_current_user)):
    await db.payment_methods.delete_one({"id": pid, "user_id": user["id"]})
    return {"ok": True}
