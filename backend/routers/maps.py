"""Google Maps router — proxies Directions API and serves embed URLs.

The Google API key is kept server-side. Frontend consumers receive only:
- normalized route info (distance, duration, polyline, start/end coords)
- ready-to-load embed URLs (referrer-restricted in production)
- ready-to-load static map image URLs
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from core.db import db
from core.deps import get_current_user
from services import maps as maps_service

router = APIRouter(prefix="/maps", tags=["maps"])


# Geographic coordinates for known agent cities (used when seeded agents
# don't have an explicit lat/lng — keeps demo MVP visually accurate).
CITY_COORDS: dict[str, tuple[float, float]] = {
    "Dakar": (14.6928, -17.4467),
    "Abidjan": (5.3600, -4.0083),
    "Bamako": (12.6392, -8.0029),
    "Yaoundé": (3.8480, 11.5021),
    "Casablanca": (33.5731, -7.5898),
    "Lagos": (6.5244, 3.3792),
    "Accra": (5.6037, -0.1870),
    "Ouagadougou": (12.3714, -1.5197),
    "Paris": (48.8566, 2.3522),
    "Lyon": (45.7640, 4.8357),
    "Marseille": (43.2965, 5.3698),
}


class DirectionsIn(BaseModel):
    origin: str
    destination: str
    mode: Optional[str] = "driving"


@router.get("/config")
async def maps_config():
    """Frontend can call this to know whether real Google Maps is enabled."""
    return {
        "enabled": bool(maps_service.GOOGLE_MAPS_API_KEY),
        "supported_modes": ["drive", "walk", "transit", "bike"],
    }


@router.post("/directions")
async def directions(payload: DirectionsIn, user: dict = Depends(get_current_user)):
    return await maps_service.get_directions(
        origin=payload.origin,
        destination=payload.destination,
        mode=payload.mode or "driving",
    )


def _agent_coords(agent: Optional[dict]) -> Optional[str]:
    if not agent:
        return None
    if agent.get("lat") is not None and agent.get("lng") is not None:
        return f"{agent['lat']},{agent['lng']}"
    city = agent.get("city")
    if city and city in CITY_COORDS:
        lat, lng = CITY_COORDS[city]
        return f"{lat},{lng}"
    if city:
        return city
    return None


@router.get("/transfer/{transfer_id}/route")
async def transfer_route(
    transfer_id: str,
    mode: str = Query("drive"),
    origin_lat: Optional[float] = Query(None),
    origin_lng: Optional[float] = Query(None),
    user: dict = Depends(get_current_user),
):
    """Fetch a Google route for a SENDBID transfer.
    
    Origin is derived from optional client-supplied geolocation
    (Expo Location), otherwise falls back to Paris (demo default).
    Destination is the assigned agent's city/coordinates.

    BUSINESS RULE: the GPS map is only available when the transfer is in
    VIP delivery mode (express home delivery to the recipient). For
    classic cash pickup at the agent's branch, the map is not shown.
    """
    transfer = await db.transfers.find_one({"id": transfer_id, "user_id": user["id"]}, {"_id": 0})
    if not transfer:
        raise HTTPException(status_code=404, detail="Transfert introuvable")

    if not transfer.get("vip_delivery"):
        return {
            "ok": False,
            "stub": True,
            "stub_reason": "non_vip_transfer",
            "vip_delivery": False,
            "mode": maps_service.normalize_mode(mode),
            "message": "La carte n'est disponible que pour les transferts en mode VIP (livraison express).",
        }

    agent = transfer.get("agent_snapshot") or {}
    destination = _agent_coords(agent)
    if not destination:
        # No agent assigned yet → return a hint, frontend will keep the mock UI
        return {
            "ok": False,
            "stub": True,
            "stub_reason": "no_agent_assigned",
            "mode": maps_service.normalize_mode(mode),
            "agent": agent,
        }

    if origin_lat is not None and origin_lng is not None:
        origin = f"{origin_lat},{origin_lng}"
    else:
        # Fallback origin — Paris city center (demo)
        lat, lng = CITY_COORDS["Paris"]
        origin = f"{lat},{lng}"

    route = await maps_service.get_directions(origin, destination, mode=mode)

    embed_url = maps_service.build_embed_url(origin, destination, mode=mode)
    static_url = maps_service.build_static_map_url(
        origin=origin,
        destination=destination,
        polyline_encoded=route.get("polyline", ""),
    )
    return {
        **route,
        "embed_url": embed_url,
        "static_url": static_url,
        "agent": {
            "full_name": agent.get("full_name"),
            "city": agent.get("city"),
            "rating": agent.get("rating"),
            "avatar_url": agent.get("avatar_url"),
            "lat": agent.get("lat") or (CITY_COORDS.get(agent.get("city", ""), (None, None))[0]),
            "lng": agent.get("lng") or (CITY_COORDS.get(agent.get("city", ""), (None, None))[1]),
        },
    }
