import os
import requests
from datetime import datetime, timedelta
from django.core.cache import cache
from rest_framework.response import Response

# ---- TMDB (The Movie Database) Configuration ---- KR 21/08/2025
TMDB_BASE = "https://api.themoviedb.org/3"
TMDB_KEY = os.environ.get("TMDB_API_KEY", "")
TMDB_BEARER = os.environ.get("TMDB_BEARER", "")

def tmdb_get(path, params=None):
    """
    Generic helper to call the TMDB API.
    Returns (data, err_response). On success: (dict, None). On error: (None, Response)
    """
    # If API key is missing, return a 500 response - KR 21/08/2025
    if not TMDB_KEY and not TMDB_BEARER:
        return None, Response({"detail": "TMDB_API_KEY not set on server"}, status=500)

    url = f"{TMDB_BASE}{path}"
    p = {}
    headers = {}
    if TMDB_BEARER:
        headers["Authorization"] = f"Bearer {TMDB_BEARER}"
    else:
        p["api_key"] = TMDB_KEY
    if params:
        p.update(params)

    try:
        full_url = requests.Request('GET', url, params=p).prepare().url
        print("[TMDB GET]", full_url)

        r = requests.get(url, params=p, headers=headers, timeout=6)
        r.raise_for_status()
        return r.json(), None
    except requests.RequestException as e:
        return None, Response(
            {"detail": "TMDB request failed", "error": str(e)},
            status=502
        )

# cache helpers
def cache_get(key):
    return cache.get(key)

def cache_set(key, value, ttl):
    cache.set(key, value, ttl)

def midnight_ttl_seconds():
    """Cache until next UTC midnight for day-stable rails.  KR 02/09/2025"""
    now = datetime.utcnow()
    tomorrow = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    return int((tomorrow - now).total_seconds())

def collect_discover_pages(params, *, max_pages=5):
    """
    Pull several /discover pages once, dedupe, and sort deterministically.
    - Returns a single merged payload with all results in 'results'. - KR 02/09/2025
    """
    from .tmdb import tmdb_get  # local import ok

    merged = []
    first, err = tmdb_get("/discover/movie", params)
    if err or not first:
        return {"results": [], "page": 1, "total_pages": 1, "total_results": 0}
    merged.extend(first.get("results") or [])
    total_pages = max(1, int(first.get("total_pages") or 1))

    for p in range(2, min(max_pages, total_pages) + 1):
        more, e2 = tmdb_get("/discover/movie", {**params, "page": p})
        if e2 or not more:
            break
        merged.extend(more.get("results") or [])

    seen = set()
    unique = []
    for m in merged:
        mid = m.get("id")
        if mid and mid not in seen:
            seen.add(mid)
            unique.append(m)
    unique.sort(key=lambda m: (-float(m.get("popularity") or 0), int(m.get("id") or 0)))

    return {
        "results": unique,
        "page": 1,
        "total_pages": 1,
        "total_results": len(unique),
    }