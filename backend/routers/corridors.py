"""Corridors router — dynamic destination ("receiving") AND sending countries.

Business rule (clarified by the product owner):
- By DEFAULT every ISO 3166-1 country (~250) is BOTH a sending AND a receiving
  country. The 250-country master list ships with the app and is loaded at
  startup from `/app/backend/data/countries.json`.
- A country can be flagged out of the receiving set (`is_receiver=false`) by
  ops, e.g. for sanctions or temporary outages. Same for senders.
- Each corridor exposes its capital + a list of major cities for the UI
  (beneficiary city picker).
- Receiving capability flags (`agents_count`, `bank_partner`, `momo_partner`,
  `has_cash_payout`) are kept for analytics and to drive the per-mode payout
  routing — they no longer gate visibility.
"""
from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from core.db import db
from core.deps import get_current_user

router = APIRouter(tags=["corridors"])


def _capabilities(corridor: dict) -> List[str]:
    """Modes de remise disponibles pour ce corridor.

    Politique produit : par défaut **les 3 modes (cash, bank, momo) sont
    disponibles** sur tous les corridors. La présence ou non d'un partenaire
    dédié (`bank_partner`, `momo_partner`) ne sert qu'à orienter le routage
    interne au moment de la confirmation, pas à masquer les choix UI.

    Un mode peut être explicitement désactivé via `disabled_modes: ["bank"]`
    sur le document corridor (ops/back-office).
    """
    disabled = set(corridor.get("disabled_modes") or [])
    caps: List[str] = []
    for m in ("cash", "bank", "momo"):
        if m not in disabled:
            caps.append(m)
    if not caps:
        caps = ["cash"]
    return caps


def _serialize(corridor: dict) -> dict:
    return {
        "country_code": corridor["country_code"],
        "country_name": corridor["country_name"],
        "flag": corridor.get("flag", ""),
        "currency": corridor["currency"],
        "fx_rate_eur": corridor.get("fx_rate_eur", 1.0),
        "fx_margin_percent": corridor.get("fx_margin_percent", 1.5),
        "fx_fixed": corridor.get("fx_fixed", False),
        "fee_percent_min": corridor.get("fee_percent_min", 1.0),
        "fee_percent_max": corridor.get("fee_percent_max", 5.0),
        "delivery_modes": _capabilities(corridor),
        "agents_count": corridor.get("agents_count", 0),
        "bank_partner": corridor.get("bank_partner"),
        "momo_partner": corridor.get("momo_partner"),
        "capital": corridor.get("capital"),
        "cities": corridor.get("cities") or ([corridor.get("capital")] if corridor.get("capital") else []),
        "is_receiver": corridor.get("is_receiver", True),
        "is_sender": corridor.get("is_sender", True),
    }


@router.get("/corridors")
async def list_corridors(
    user: dict = Depends(get_current_user),
    search: Optional[str] = Query(None, description="Filtre par nom (substring, insensible à la casse)"),
    only_receivers: bool = Query(True, description="Limiter aux pays récepteurs (par défaut true)"),
):
    """All countries available as a destination.

    By default returns the receiving subset (~250 — every country is a
    receiver by default unless ops disabled it). Pass `only_receivers=false`
    to also include any country marked sender-only.
    """
    q: dict = {"active": True}
    if only_receivers:
        q["is_receiver"] = True
    if search:
        q["country_name"] = {"$regex": search, "$options": "i"}
    rows = await db.corridors.find(q, {"_id": 0}).sort("country_name", 1).to_list(500)
    out = [_serialize(c) for c in rows]
    return {"corridors": out, "count": len(out)}


@router.get("/corridors/{country_code}")
async def get_corridor(country_code: str, user: dict = Depends(get_current_user)):
    c = await db.corridors.find_one({"country_code": country_code.upper(), "active": True}, {"_id": 0})
    if not c:
        raise HTTPException(status_code=404, detail="Corridor non disponible pour ce pays")
    return _serialize(c)


@router.get("/countries/sending")
async def list_sending_countries(
    search: Optional[str] = Query(None),
):
    """Public endpoint — all countries open for client registration."""
    q: dict = {"active": True, "is_sender": True}
    if search:
        q["country_name"] = {"$regex": search, "$options": "i"}
    rows = await db.corridors.find(
        q,
        {"_id": 0, "country_code": 1, "country_name": 1, "flag": 1, "currency": 1,
         "is_receiver": 1, "capital": 1, "cities": 1},
    ).sort("country_name", 1).to_list(500)
    out = [{
        "country_code": r["country_code"],
        "country_name": r["country_name"],
        "flag": r.get("flag", ""),
        "currency": r["currency"],
        "is_receiver": r.get("is_receiver", True),
        "capital": r.get("capital"),
        "cities": r.get("cities") or ([r.get("capital")] if r.get("capital") else []),
    } for r in rows]
    return {"countries": out, "count": len(out)}


@router.get("/corridors/{country_code}/cities")
async def list_cities(country_code: str, user: dict = Depends(get_current_user)):
    c = await db.corridors.find_one(
        {"country_code": country_code.upper(), "active": True},
        {"_id": 0, "capital": 1, "cities": 1, "country_name": 1, "country_code": 1},
    )
    if not c:
        raise HTTPException(status_code=404, detail="Pays inconnu")
    cities = c.get("cities") or ([c.get("capital")] if c.get("capital") else [])
    return {
        "country_code": c["country_code"],
        "country_name": c["country_name"],
        "capital": c.get("capital"),
        "cities": cities,
    }
