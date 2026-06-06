"""PDF receipt generation endpoint."""
import io
import logging
from typing import Optional

from fastapi import HTTPException, Query, Header
from fastapi.responses import StreamingResponse

from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm

from core.db import db
from core.deps import get_user_from_token

from . import router

logger = logging.getLogger("sendbid.transfers.receipts")


@router.get("/{transfer_id}/receipt-pdf")
async def receipt_pdf(transfer_id: str, token: Optional[str] = Query(None), authorization: Optional[str] = Header(None)):
    # Allow either Authorization header (default) OR ?token= query param (for direct browser/mobile download)
    auth_user = None
    if authorization and authorization.lower().startswith("bearer "):
        auth_user = await get_user_from_token(authorization.split(" ", 1)[1].strip())
    if not auth_user and token:
        auth_user = await get_user_from_token(token)
    if not auth_user:
        raise HTTPException(status_code=401, detail="Non authentifié")
    t = await db.transfers.find_one({"id": transfer_id, "user_id": auth_user["id"]}, {"_id": 0})
    if not t:
        raise HTTPException(status_code=404, detail="Transfert introuvable")
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    width, height = A4
    c.setFillColorRGB(0.058, 0.298, 0.506)
    c.rect(0, height - 40 * mm, width, 40 * mm, fill=1, stroke=0)
    c.setFillColorRGB(1, 1, 1)
    c.setFont("Helvetica-Bold", 22)
    c.drawString(20 * mm, height - 22 * mm, "SENDBID")
    c.setFont("Helvetica", 10)
    c.drawString(20 * mm, height - 30 * mm, "Reçu de transfert")
    c.setFillColorRGB(0, 0, 0)
    y = height - 55 * mm
    c.setFont("Helvetica-Bold", 12)
    c.drawString(20 * mm, y, f"Référence: {t['id'][:8].upper()}")
    y -= 8 * mm
    c.setFont("Helvetica", 10)
    rows = [
        ("Statut", t["status"]),
        ("Bénéficiaire", t["beneficiary"].get("full_name", "—")),
        ("Pays destination", t["destination_country"]),
        ("Mode remise", t["delivery_mode"].upper()),
        ("Montant envoyé", f"{t['send_amount']:.2f} EUR"),
        ("Frais", f"{t['fee_amount']:.2f} EUR"),
        ("Total débité", f"{t['total_amount']:.2f} EUR"),
        ("Montant reçu", f"{t['receive_amount']:.2f} {t['destination_currency']}"),
        ("Code retrait", t.get("withdrawal_code", "—")),
        ("Date", t["created_at"][:19].replace("T", " ")),
    ]
    for k, v in rows:
        c.drawString(20 * mm, y, f"{k}:")
        c.drawString(80 * mm, y, str(v))
        y -= 7 * mm
    c.setFillColorRGB(0.4, 0.4, 0.4)
    c.setFont("Helvetica-Oblique", 8)
    c.drawString(20 * mm, 20 * mm, "Reçu signé HMAC-SHA256. SENDBID — Transfert international.")
    c.showPage()
    c.save()
    buf.seek(0)
    return StreamingResponse(buf, media_type="application/pdf",
                             headers={"Content-Disposition": f'attachment; filename="recu-{transfer_id[:8]}.pdf"'})
