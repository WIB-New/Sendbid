"""Google Maps service — Directions API + Embed URL generation.

Keeps the API key on the backend. The frontend never sees the secret;
it only consumes JSON (route polyline, distance, duration) or loads an
embed URL via WebView (key still embedded in URL but can be HTTP-referrer
restricted in Google Cloud Console for production hardening).
"""
from __future__ import annotations

import os
import logging
from typing import Optional, Tuple
from urllib.parse import urlencode

import httpx

logger = logging.getLogger("sendbid.maps")

GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY", "").strip()

# Mode mapping between SENDBID UI keys and Google Directions API modes
SENDBID_TO_GOOGLE_MODE = {
    "drive": "driving",
    "driving": "driving",
    "walk": "walking",
    "walking": "walking",
    "transit": "transit",
    "bike": "bicycling",
    "bicycle": "bicycling",
    "bicycling": "bicycling",
}


def _enabled() -> bool:
    return bool(GOOGLE_MAPS_API_KEY)


def normalize_mode(mode: Optional[str]) -> str:
    if not mode:
        return "driving"
    return SENDBID_TO_GOOGLE_MODE.get(mode.lower(), "driving")


async def get_directions(
    origin: str,
    destination: str,
    mode: str = "driving",
    language: str = "fr",
) -> dict:
    """Call Google Directions API. Returns a normalized dict suitable for the
    SENDBID frontend or a stub when the API key is missing.

    `origin` and `destination` may be free-form addresses or "lat,lng" strings.
    """
    g_mode = normalize_mode(mode)

    if not _enabled():
        return _stub_directions(origin, destination, g_mode, reason="GOOGLE_MAPS_API_KEY missing")

    params = {
        "origin": origin,
        "destination": destination,
        "mode": g_mode,
        "language": language,
        "key": GOOGLE_MAPS_API_KEY,
    }
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get("https://maps.googleapis.com/maps/api/directions/json", params=params)
            data = resp.json()
    except Exception as exc:  # noqa: BLE001
        logger.warning("[maps] directions request failed: %s", exc)
        return _stub_directions(origin, destination, g_mode, reason=str(exc))

    if data.get("status") != "OK" or not data.get("routes"):
        logger.warning("[maps] directions status=%s message=%s", data.get("status"), data.get("error_message"))
        return _stub_directions(origin, destination, g_mode, reason=data.get("status", "ZERO_RESULTS"))

    route = data["routes"][0]
    leg = route["legs"][0]
    return {
        "ok": True,
        "mode": g_mode,
        "origin": origin,
        "destination": destination,
        "distance_meters": leg["distance"]["value"],
        "distance_text": leg["distance"]["text"],
        "duration_seconds": leg["duration"]["value"],
        "duration_text": leg["duration"]["text"],
        "start_location": leg["start_location"],     # {"lat":..,"lng":..}
        "end_location": leg["end_location"],
        "polyline": route["overview_polyline"]["points"],
        "summary": route.get("summary"),
        "warnings": route.get("warnings", []),
        "stub": False,
    }


def _stub_directions(origin: str, destination: str, mode: str, reason: str = "") -> dict:
    """Best-effort stub when Google API is unreachable / unconfigured."""
    speeds_kmh = {"driving": 35, "walking": 5, "transit": 25, "bicycling": 15}
    # Try parse "lat,lng" → compute haversine; otherwise fake 6 km
    distance_km = _haversine_km(origin, destination) or 6.0
    speed = speeds_kmh.get(mode, 30)
    duration_min = max(1, round((distance_km / speed) * 60))
    return {
        "ok": False,
        "stub": True,
        "stub_reason": reason or "fallback",
        "mode": mode,
        "origin": origin,
        "destination": destination,
        "distance_meters": int(distance_km * 1000),
        "distance_text": f"{distance_km:.1f} km",
        "duration_seconds": duration_min * 60,
        "duration_text": f"{duration_min} min",
        "start_location": _parse_latlng(origin),
        "end_location": _parse_latlng(destination),
        "polyline": "",
        "summary": "Estimation locale",
        "warnings": [],
    }


def _parse_latlng(s: str) -> Optional[dict]:
    try:
        if "," in s:
            lat, lng = s.split(",", 1)
            return {"lat": float(lat), "lng": float(lng)}
    except Exception:  # noqa: BLE001
        pass
    return None


def _haversine_km(a: str, b: str) -> Optional[float]:
    p1, p2 = _parse_latlng(a), _parse_latlng(b)
    if not p1 or not p2:
        return None
    from math import asin, cos, radians, sin, sqrt
    lat1, lng1 = radians(p1["lat"]), radians(p1["lng"])
    lat2, lng2 = radians(p2["lat"]), radians(p2["lng"])
    dlat, dlng = lat2 - lat1, lng2 - lng1
    h = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlng / 2) ** 2
    return 2 * 6371.0 * asin(sqrt(h))


def build_embed_url(origin: str, destination: str, mode: str = "driving") -> str:
    """Return a Google Maps Embed API URL suitable for a WebView.

    The key is included in the URL — protect with HTTP referrer restrictions
    in the Google Cloud Console for production. Always returns a URL, even if
    the API key is missing (the WebView will display Google's error UI).
    """
    g_mode = normalize_mode(mode)
    base = "https://www.google.com/maps/embed/v1/directions"
    params = {
        "key": GOOGLE_MAPS_API_KEY or "MISSING_KEY",
        "origin": origin,
        "destination": destination,
        "mode": g_mode,
        "language": "fr",
    }
    return f"{base}?{urlencode(params)}"


def build_static_map_url(
    origin: str,
    destination: str,
    polyline_encoded: str = "",
    width: int = 600,
    height: int = 400,
) -> str:
    """Return a Google Static Maps URL with the route polyline overlay."""
    base = "https://maps.googleapis.com/maps/api/staticmap"
    markers = [
        f"color:blue|label:A|{origin}",
        f"color:red|label:B|{destination}",
    ]
    parts = [
        ("size", f"{width}x{height}"),
        ("scale", "2"),
        ("language", "fr"),
        ("key", GOOGLE_MAPS_API_KEY or ""),
    ]
    for m in markers:
        parts.append(("markers", m))
    if polyline_encoded:
        parts.append(("path", f"weight:4|color:0x0F75D6FF|enc:{polyline_encoded}"))
    return f"{base}?{urlencode(parts)}"
