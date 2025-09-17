from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated, IsAdminUser
from rest_framework.response import Response
from io import BytesIO
from PIL import Image
from colorthief import ColorThief
import re
from datetime import datetime, timedelta

# Pre-validate the incoming TMDB path for safety - KR 26/08/2025
_TMDB_PATH_RE = re.compile(r"^/t/p/(original|w500|w780|w342|w154|w92)/[A-Za-z0-9._-]+$")

# Import user registration serializer - KR 21/08/2025
from .serializers import RegisterSerializer

# Standard Python + Django utilities - KR 21/08/2025
import os
import requests
from django.core.cache import cache

# ---- TMDB (The Movie Database) Configuration ---- KR 21/08/2025
TMDB_BASE = "https://api.themoviedb.org/3"
TMDB_KEY = os.environ.get("TMDB_API_KEY", "")

def _tmdb_get(path, params=None):
    """
    Generic helper to call the TMDB API.
    - Builds the full URL with `TMDB_BASE` + endpoint path.
    - Adds the API key automatically to all requests.
    - Handles exceptions and timeouts.
    - Returns (data, None) on success OR (None, Response) on error.
    """
    # If API key is missing, return a 500 response - KR 21/08/2025
    if not TMDB_KEY:
        return None, Response({"detail": "TMDB_API_KEY not set on server"}, status=500)

    url = f"{TMDB_BASE}{path}"
    p = {"api_key": TMDB_KEY}    # Always include API key - KR 21/08/2025
    if params:
        p.update(params)         # Merge in additional query params - KR 21/08/2025

    try:
        # Log the final URL including query params for debugging - KR 29/08/2025
        full_url = requests.Request('GET', url, params=p).prepare().url
        print("[TMDB GET]", full_url)

        # Perform GET request to TMDB
        r = requests.get(url, params=p, timeout=6)
        r.raise_for_status()   
        return r.json(), None    
    except requests.RequestException as e:
        # Catch network errors, bad status codes, etc. - KR 21/08/2025
        return None, Response(
            {"detail": "TMDB request failed", "error": str(e)},
            status=502
        )

#  Snapshot + pin helpers — KR 02/09/2025

def _midnight_ttl_seconds():
    """Cache until next UTC midnight for day-stable rails."""
    now = datetime.utcnow()
    tomorrow = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    return int((tomorrow - now).total_seconds())

def _collect_discover_pages(params, *, max_pages=5):
    """
    Pull several /discover pages once, dedupe, and sort deterministically.
    - Returns a single merged payload with all results in 'results'. - KR 02/09/2025
    """
    merged = []
    first, err = _tmdb_get("/discover/movie", params)
    if err or not first:
        return {"results": [], "page": 1, "total_pages": 1, "total_results": 0}
    merged.extend(first.get("results") or [])
    total_pages = max(1, int(first.get("total_pages") or 1))

    for p in range(2, min(max_pages, total_pages) + 1):
        more, e2 = _tmdb_get("/discover/movie", {**params, "page": p})
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

def _apply_pins(mood_key: str, items: list, *, region: str = "GB"):
    """
    Lift pinned IDs to the front if present - KR 02/09/2025
    """
    pins = _effective_pins_for(mood_key)
    if not pins:
        return items

    order = {mid: i for i, mid in enumerate(pins)}
    existing_ids = {m.get("id") for m in items if m.get("id")}
    missing = [mid for mid in pins if mid not in existing_ids]

    appended = []
    for mid in missing[:5]:  # cap to 5 detail fetches per request — KR 02/09/2025
        try:
            detail, err = _tmdb_get(f"/movie/{mid}", {"append_to_response": "watch/providers"})
            if err or not detail:
                continue
            wp = (detail.get("watch/providers") or {}).get("results", {})
            if region in wp or "US" in wp:
                appended.append(detail)
        except Exception:
            continue

    merged = items + appended

    def pin_key(m):
        return (order.get(m.get("id"), 10_000),)

    merged.sort(key=pin_key)

    # Dedupe after appends
    seen = set()
    out = []
    for m in merged:
        mid = m.get("id")
        if mid and mid not in seen:
            seen.add(mid)
            out.append(m)
    return out

# Filters — KR 17/09/2025

def _parse_filters_from_request(request):
    """
    Parse optional filters from query params.
    Aliases supported for your frontend:
      - with_decade -> maps to year_from/year_to (e.g., "1990s")
      - tmdb_min    -> vote_average.gte
    Optional:
      - min_votes, runtime_gte/lte, lang (original language), sort_by
    """
    q = request.query_params

    # decade → years (accepts with_decade or decade)
    decade = (q.get("with_decade") or q.get("decade") or "").strip()
    y_from = q.get("year_from")
    y_to   = q.get("year_to")
    decade_map = {
        "2020s": (2020, 2029),
        "2010s": (2010, 2019),
        "2000s": (2000, 2009),
        "1990s": (1990, 1999),
        "1980s": (1980, 1989),
        "1970s": (1970, 1979),
        "1960s": (1960, 1969),
    }
    year_from = int(y_from) if y_from and y_from.isdigit() else None
    year_to   = int(y_to)   if y_to   and y_to.isdigit()   else None
    if decade in decade_map and (year_from is None and year_to is None):
        year_from, year_to = decade_map[decade]

    # TMDB rating lower bound (accept tmdb_min or vote_average_gte)
    vote_avg_gte = q.get("tmdb_min", q.get("vote_average_gte"))
    try:
        vote_avg_gte = float(vote_avg_gte) if vote_avg_gte not in (None, "", "null") else None
    except Exception:
        vote_avg_gte = None

    # Optional helpers to keep results sane when rating is high
    min_votes = q.get("min_votes")
    try:
        min_votes = int(min_votes) if min_votes not in (None, "", "null") else None
    except Exception:
        min_votes = None
    if min_votes is None and vote_avg_gte is not None and vote_avg_gte >= 7:
        min_votes = 50

    # Misc
    def _int(name, lo=None, hi=None):
        val = q.get(name)
        if val is None or val == "": return None
        try:
            iv = int(val)
            if lo is not None: iv = max(lo, iv)
            if hi is not None: iv = min(hi, iv)
            return iv
        except Exception:
            return None

    runtime_gte = _int("runtime_gte", lo=40)
    runtime_lte = _int("runtime_lte", hi=240)
    lang        = (q.get("lang") or "").strip()[:5] or None
    sort_by     = (q.get("sort_by") or "").strip() or None

    return {
        "year_from": year_from,
        "year_to": year_to,
        "vote_average_gte": vote_avg_gte,
        "min_votes": min_votes,
        "runtime_gte": runtime_gte,
        "runtime_lte": runtime_lte,
        "lang": lang,
        "sort_by": sort_by,
    }

# API Endpoints - KR 21/08/2025

@api_view(["GET"])
@permission_classes([AllowAny])
def poster_palette(request):
    """
    Extract a small color palette (3 swatches) from a TMDB poster image.
    Query: ?path=/t/p/w500/abcdef.jpg
    Returns: {"palette": [[r,g,b],[r,g,b],[r,g,b]]}  - KR 26/08/2025
    """
    path = request.query_params.get("path", "")
    if not path or not _TMDB_PATH_RE.match(path):
        return Response({"detail": "Invalid or missing TMDB path"}, status=400)

    # Build the full TMDB image URL - KR 26/08/2025
    url = f"https://image.tmdb.org{path}"

    try:
        r = requests.get(url, timeout=8)
        r.raise_for_status()
        # Ensure image retrieved- KR 26/08/2025
        ctype = r.headers.get("Content-Type", "")
        if "image" not in ctype:
            return Response({"detail": "TMDB did not return an image", "ctype": ctype}, status=502)

        # Load image into PIL, force RGB for ColorThief - KR 26/08/2025
        img = Image.open(BytesIO(r.content)).convert("RGB")

        bio = BytesIO()
        img.save(bio, format="PNG")
        bio.seek(0)

        ct = ColorThief(bio)
        palette = ct.get_palette(color_count=3, quality=10) or []

        # Normalize to lists - KR 26/08/2025
        palette = [list(swatch) for swatch in palette][:3]

        # Fallback if palette too short - KR 26/08/2025
        while len(palette) < 2:
            palette.append([20, 20, 20])

        return Response({"palette": palette}, status=200)

    except requests.RequestException as e:
        # Network/HTTP errors - KR 26/08/2025
        return Response({"detail": "Failed to fetch poster", "error": str(e)}, status=502)
    except Exception as e:
        # Color extraction / PIL errors - KR 26/08/2025
        return Response({"detail": "Palette extraction failed", "error": str(e)}, status=500)

@api_view(["GET"])
@permission_classes([AllowAny])
def trending_movies(request):
    """
    Returns trending movies of the week from TMDB.
    - Uses TMDB `/trending/movie/week` endpoint.
    - Caches results in Redis/memory for 10 minutes to reduce API calls.
    """
    cache_key = "tmdb:trending:movie:week"
    data = cache.get(cache_key)
    if not data:  # If cache empty, fetch from TMDB
        data, err = _tmdb_get("/trending/movie/week")
        if err:
            return err
        cache.set(cache_key, data, 60 * 10)  # Cache for 10 minutes
    return Response(data, status=200)

@api_view(["GET"])
@permission_classes([AllowAny])
def search_movies(request):
    """
    Search movies by title.
    Example usage:
        /api/movies/search/?q=barbie

    - If no query string, returns empty list.
    - Otherwise, calls TMDB `/search/movie`.
    """
    q = request.query_params.get("q", "").strip()
    if not q:  # Return empty if query missing
        return Response({"results": []}, status=200)

    data, err = _tmdb_get("/search/movie", {"query": q})
    if err:
        return err
    return Response(data, status=200)

# EXTRA ENDPOINTS FOR HOME SECTIONS - KR 21/08/2025

@api_view(["GET"])
@permission_classes([AllowAny])
def now_playing(request):
    """
    What's on in cinemas (TMDB /movie/now_playing)
    Optional query params:
      - region (default: "US"), e.g., "IE"
      - page (default: "1")
    Cached for 10 minutes to reduce TMDB calls. - KR 21/08/2025
    """
    region = request.query_params.get("region", "US")
    page = request.query_params.get("page", "1")

    cache_key = f"tmdb:now_playing:{region}:p{page}"
    data = cache.get(cache_key)
    if not data:
        data, err = _tmdb_get("/movie/now_playing", {"region": region, "page": page})
        if err:
            return err
        cache.set(cache_key, data, 60 * 10) 
    return Response(data, status=200)

@api_view(["GET"])
@permission_classes([AllowAny])
def streaming_trending(request):
    """
    Trending on streaming (TMDB /discover/movie) - KR
    """
    region = request.query_params.get("region", "US")
    providers = request.query_params.get("providers", "")
    page = request.query_params.get("page", "1")
    broad = request.query_params.get("broad") in ("1", "true", "yes")
    debug = request.query_params.get("debug") in ("1", "true", "yes")

    # If providers are selected, default to stricter catalog (subscription only) - KR 29/08/2025
    if providers:
        types = request.query_params.get("types", "flatrate" if not broad else "flatrate,ads,free")
    else:
        types = request.query_params.get("types", "flatrate,ads,free")

    params = {
        "watch_region": region,
        "with_watch_monetization_types": types,
        "sort_by": "popularity.desc",
        "page": page,
    }
    if providers:
        params["with_watch_providers"] = providers  # TMDB wants pipe-separated IDs

    cache_key = f"tmdb:streaming:{region}:{providers}:{types}:p{page}"
    data = cache.get(cache_key)
    if not data:
        data, err = _tmdb_get("/discover/movie", params)
        if err:
            return err
        # Attach debug echo if requested - KR 29/08/2025
        if debug:
            data = dict(data)
            data["_debug_params"] = params
        cache.set(cache_key, data, 60 * 10)
    elif debug:
        # Ensure debug shows for cached responses too - KR 29/08/2025
        d = dict(data)
        d["_debug_params"] = params
        return Response(d, status=200)

    return Response(data, status=200)

@api_view(["GET"])
@permission_classes([AllowAny])
def providers_movies(request):
    region = request.query_params.get("region", "US")
    cache_key = f"tmdb:providers:movie:{region}"
    data = cache.get(cache_key)
    if not data:
        data, err = _tmdb_get("/watch/providers/movie", {"watch_region": region})
        if err:
            return err
        cache.set(cache_key, data, 60 * 60)  # 1 hour
    return Response(data, status=200)

# People search -> movies by actor - KR 25/08/2025
@api_view(["GET"])
@permission_classes([AllowAny])
def person_movies(request):
    """
    Given a person name (e.g., 'Anne Hathaway'), return their movie credits.
    Steps:
      1) /search/person -> pick top match to get person_id
      2) /person/{id}/movie_credits -> return 'cast' list
    Cached per query for 10 minutes. - KR 25/08/2025
    """
    q = request.query_params.get("q", "").strip()
    if not q:
        return Response({"results": []}, status=200)

    cache_key = f"tmdb:person_movies:{q.lower()}"
    data = cache.get(cache_key)
    if data:
        return Response(data, status=200)

    # 1) find the person id
    person_data, err = _tmdb_get("/search/person", {"query": q})
    if err:
        return err

    results = (person_data or {}).get("results", [])
    if not results:
        return Response({"results": []}, status=200)

    person_id = results[0].get("id")
    if not person_id:
        return Response({"results": []}, status=200)

    # 2) fetch movie credits for that person
    credits, err2 = _tmdb_get(f"/person/{person_id}/movie_credits")
    if err2:
        return err2

    movies = (credits or {}).get("cast", [])

    # sort by popularity desc, drop duplicates - KR 25/08/2025
    seen = set()
    cleaned = []
    for m in sorted(movies, key=lambda x: x.get("popularity", 0), reverse=True):
        mid = m.get("id")
        if mid and mid not in seen:
            seen.add(mid)
            cleaned.append(m)

    payload = {"results": cleaned}
    cache.set(cache_key, payload, 60 * 10)
    return Response(payload, status=200)

@api_view(["POST"])
@permission_classes([AllowAny])
def register(request):
    """
    Register a new user in Django via API.
    - Accepts POST body with username, password, etc.
    - Uses RegisterSerializer to validate + save user.
    - Returns success message or error details.
    """
    serializer = RegisterSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save()
        return Response(
            {"message": "User created successfully!"},
            status=status.HTTP_201_CREATED
        )

    # Return field-specific validation errors
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(["GET"])
@permission_classes([AllowAny])
def movie_detail(request, tmdb_id: int):
    """
    Return a single movie's detail and credits merged into one payload.
    Cached for 30 minutes to reduce API calls. - KR 26/08/2025
    Now includes trailers and watch/providers via append_to_response. - KR 26/08/2025
    """

    region = request.query_params.get("region", "IE").upper()

    # include region in cache key so it won't cross-contaminate provider blocks - KR 26/08/2025
    cache_key = f"tmdb:movie:{tmdb_id}:detail+credits+videos+providers:{region}"
    data = cache.get(cache_key)
    if data:
        return Response(data, status=200)

    # fetch core details + credits + videos + providers in one call - KR 26/08/2025
    params = {"append_to_response": "videos,credits,watch/providers"}
    details, err = _tmdb_get(f"/movie/{tmdb_id}", params)
    if err:
        return err

    merged = details or {}

    merged["credits"] = (merged.get("credits") or {"cast": [], "crew": []})

    # normalise providers to the requested region (fallback to US, else empty) - KR 26/08/2025
    wp = merged.get("watch/providers") or {}
    region_block = {}
    try:
        region_block = (wp.get("results", {}) or {}).get(region) \
                       or (wp.get("results", {}) or {}).get("US") \
                       or {}
    except Exception:
        region_block = {}
    # expose a simple `providers` object the frontend can read (flatrate/ads/free/rent/buy) - KR 26/08/2025
    merged["providers"] = region_block

    # cache for 30 mins - KR 26/08/2025
    cache.set(cache_key, merged, 60 * 30)
    return Response(merged, status=200)

# Mood mapping for logged in users - KR 01/09/2025 + expanded 02/09/2025

# Genre constants (TMDB IDs) - (not currently used in rules, kept for future) - KR 01/09/2025
_GENRE = {
    "comedy": 35, "drama": 18, "romance": 10749, "family": 10751,
    "thriller": 53, "horror": 27, "mystery": 9648, "action": 28,
    "adventure": 12, "scifi": 878, "animation": 16, "crime": 80
}

# Pinned TMDB IDs per mood  — KR 02/09/2025
PINNED_BASE = {
    "feelgood":     [260513, 398181, 210577, 496243],          
    "heartwarming": [10193, 109445, 19404],                    
    "high_energy":  [497698, 353081, 324857, 299536],
    "chill":        [97630, 490132, 19404],
    "mind_bending": [62, 27205, 1124, 419430],
    "romantic":     [194, 13, 744, 19913],
    "family":       [862, 150540, 260513],
    "scary":        [381288, 631843, 346364],
    "tearjerker":   [598, 4922, 77338, 730154],
    "dark_gritty":  [680, 155, 807, 500],                    
}

# Keyword groups per mood (TMDB keyword IDs) — fill with real IDs over time — KR 02/09/2025
KEYWORDS_BASE = {
    "feelgood":     ["180547", "3370", "211029"],       
    "heartwarming": ["180547", "9826", "207317"],       
    "high_energy":  ["9715", "616", "15060"],           
    "chill":        ["158718", "179431", "195970"],     
    "mind_bending": ["4565", "804", "11109"],           
    "romantic":     ["9856", "1599", "210024"],         
    "family":       ["9713", "9714", "158718"],         
    "scary":        ["9719", "9718", "9717"],           
    "tearjerker":   ["4344", "179430", "287501"],       
    "dark_gritty":  ["9716", "9710", "9824"],           
}

#  Admin-configurable overrides (cache) — KR 17/09/2025

# cache keys
_OVR_PINS_KEY     = "mood:pins:overrides"     
_OVR_KEYWORDS_KEY = "mood:keywords:overrides"

def _get_overrides(cache_key: str) -> dict:
    return cache.get(cache_key) or {}

def _set_overrides(cache_key: str, data: dict):
    cache.set(cache_key, data, 60 * 60 * 24 * 30) 

def _effective_pins_for(mood: str) -> list[int]:
    base = PINNED_BASE.get(mood, [])[:]
    ov = _get_overrides(_OVR_PINS_KEY).get(mood) or []
    seen = set()
    out = []
    for mid in ov + base:
        if mid not in seen:
            seen.add(mid)
            out.append(mid)
    return out

def _effective_keywords_for(mood: str) -> list[str]:
    base = KEYWORDS_BASE.get(mood, [])[:]
    ov = _get_overrides(_OVR_KEYWORDS_KEY).get(mood) or []
    seen = set()
    out = []
    for kw in ov + base:
        if kw not in seen:
            seen.add(kw)
            out.append(kw)
    return out

# Added light gating toggles to enforce mood tone while keeping volume. — KR 17/09/2025
MOOD_RULES = {
    "feelgood": {
        "include_genres_any": ["35", "10751", "10402", "10749", "16", "12"], 
        "exclude_genres": ["27", "53", "80", "9648"],  # keep dark genres out
        "sort_by": "popularity.desc",
        "enforce_genre_gate": True,
    },
    "heartwarming": {
        "include_genres_any": ["18", "10751", "10749"],
        "exclude_genres": ["27", "53"],
        "sort_by": "popularity.desc",
        "enforce_genre_gate": True,
    },
    "high_energy": {
        "include_genres_any": ["28", "12", "53", "878"],
        "exclude_genres": [],
        "sort_by": "popularity.desc",
    },
    "chill": {
        "include_genres_any": ["35", "18"],
        "exclude_genres": ["27", "53"],
        "sort_by": "popularity.desc",
    },
    "mind_bending": {
        "include_genres_any": ["9648", "878", "53"],
        "exclude_genres": ["10751"],
        "sort_by": "popularity.desc",
    },
    "romantic": {
        "include_genres_any": ["10749", "35", "18"],
        "exclude_genres": ["27", "53"],
        "sort_by": "popularity.desc",
        "enforce_genre_gate": True,
    },
    "family": {
        "include_genres_any": ["10751", "16", "12"],
        "exclude_genres": ["27", "53", "80"],
        "sort_by": "popularity.desc",
        "enforce_genre_gate": True,
    },
    "scary": {
        "include_genres_any": ["27", "53"],
        "exclude_genres": [],
        "sort_by": "popularity.desc",
    },
    "tearjerker": {
        "include_genres_any": ["18", "10749"],
        "exclude_genres": ["27", "53"],
        "sort_by": "popularity.desc",
        "enforce_genre_gate": True,
    },
    "dark_gritty": {
        "include_genres_any": ["80", "53", "18"],
        "exclude_genres": ["10751", "16", "10402", "10749"], 
        "sort_by": "popularity.desc",
    },
}

def _extract_genre_id_strings(movie: dict) -> set[str]:
    ids = set()
    if isinstance(movie.get("genre_ids"), list):
        for g in movie["genre_ids"]:
            try:
                ids.add(str(int(g)))
            except Exception:
                pass
    elif isinstance(movie.get("genres"), list):
        for g in movie["genres"]:
            try:
                ids.add(str(int(g.get("id"))))
            except Exception:
                pass
    return ids

def _passes_genre_gate(mood_key: str, movie: dict) -> bool:
    rules = MOOD_RULES.get(mood_key) or {}
    if not rules.get("enforce_genre_gate"):
        # Always respect excludes even when gate is off
        exc = set(rules.get("exclude_genres") or [])
        return not (_extract_genre_id_strings(movie) & exc)
    inc = set(rules.get("include_genres_any") or [])
    exc = set(rules.get("exclude_genres") or [])
    gids = _extract_genre_id_strings(movie)
    if not gids:
        return False
    if inc and not (gids & inc):
        return False
    if exc and (gids & exc):
        return False
    return True

def build_discover_params(
    mood_key: str, *, region="GB", providers="", types="flatrate,ads,free", page=1, filters: dict | None = None
):
    """
    Build TMDB /discover/movie params from MOOD_RULES.
    - Uses OR for include sets to broaden (pipe `|`).
    - Exclusions remain comma-joined (ANDed).
    - Keyword IDs use admin-augmented set. - KR 03/09/2025
    - Applies optional filters (decade/year range, rating, votes, runtime, lang, sort). - KR 10/09/2025
    """
    rules = MOOD_RULES.get(mood_key) or {}
    filters = filters or {}

    include_any = rules.get("include_genres_any") or []
    with_genres = "|".join(include_any) if include_any else None

    k_any = _effective_keywords_for(mood_key)  # include admin overrides - KR 02/09/2025
    with_keywords = "|".join(k_any) if k_any else None

    exclude = ",".join(rules.get("exclude_genres", [])) or None

    p = {
        "watch_region": region,
        "with_watch_monetization_types": types,
        "sort_by": rules.get("sort_by", "popularity.desc"),
        "page": page,
    }
    if with_genres:
        p["with_genres"] = with_genres
    if with_keywords:
        p["with_keywords"] = with_keywords
    if exclude:
        p["without_genres"] = exclude
    if providers:
        p["with_watch_providers"] = providers
    # --- Filters
    if filters.get("year_from"):
        p["primary_release_date.gte"] = f"{filters['year_from']}-01-01"
    if filters.get("year_to"):
        p["primary_release_date.lte"] = f"{filters['year_to']}-12-31"
    if filters.get("vote_average_gte") is not None:
        p["vote_average.gte"] = str(filters["vote_average_gte"])
    if filters.get("min_votes"):
        p["vote_count.gte"] = str(filters["min_votes"])
    if filters.get("runtime_gte"):
        p["with_runtime.gte"] = str(filters["runtime_gte"])
    if filters.get("runtime_lte"):
        p["with_runtime.lte"] = str(filters["runtime_lte"])
    if filters.get("lang"):
        p["with_original_language"] = filters["lang"]
    if filters.get("sort_by"):
        p["sort_by"] = filters["sort_by"]

    return p

@api_view(["GET"])
@permission_classes([IsAuthenticated])  # mood is for logged in users only - KR 01/09/2025
def mood_discover(request, mood_key: str):
    """
    Mood-based discover with keyword enrichment, pins, and daily snapshot stability.
    """
    if mood_key not in MOOD_RULES:
        return Response({"detail": f"Unknown mood '{mood_key}'"}, status=400)

    region    = request.query_params.get("region", "GB")
    providers = request.query_params.get("providers", "")
    types_in  = request.query_params.get("types", "flatrate,ads,free")
    page      = max(1, int(request.query_params.get("page", "1") or 1))
    broad     = request.query_params.get("broad") in ("1", "true", "yes")
    debug     = request.query_params.get("debug") in ("1", "true", "yes")
    providers_selected = bool(providers)

    # Parse filters (decade/rating/etc.) - KR 17/09/2025
    filters = _parse_filters_from_request(request)

    # 1) Build base params
    base = build_discover_params(
        mood_key, region=region, providers=providers, types=types_in, page=1, filters=filters
    )

    # 2) Blend & score approach to keep lists on theme — KR 02/09/2025
    def _bucket_params(base_p: dict, *, which: str):
        p = dict(base_p)
        if which == "strict":
            pass
        elif which == "genre_only":
            p.pop("with_keywords", None)
        elif which == "keyword_only":
            p.pop("with_genres", None)
        return p

    def _maybe_widen_types(p: dict, do_widen: bool):
        if not do_widen:
            return p
        cur = {s.strip() for s in (p.get("with_watch_monetization_types") or "").split(",") if s.strip()}
        cur |= {"rent", "buy"}
        q = dict(p)
        q["with_watch_monetization_types"] = ",".join(sorted(cur))
        return q

    def _snapshot_key_for(bucket_name: str, par: dict):
        # include filters in key so cache variants don't bleed - KR 17/09/2025
        f = filters
        ftag = f"y{f.get('year_from','-')}-{f.get('year_to','-')}-rt{f.get('runtime_gte','-')}-{f.get('runtime_lte','-')}-mv{f.get('min_votes','-')}-lg{f.get('lang','-')}-sb{f.get('sort_by','-')}-va{f.get('vote_average_gte','-')}"
        return (
            f"snap2f:{bucket_name}:{mood_key}:{region}:"
            f"{par.get('with_watch_providers','-')}:"
            f"{par.get('with_watch_monetization_types','-')}:"
            f"ex{bool(par.get('without_genres'))}:"
            f"kw{bool(par.get('with_keywords'))}:{ftag}:v1"
        )

    def _get_snapshot(par: dict, bucket_name: str):
        k = _snapshot_key_for(bucket_name, par)
        snap = cache.get(k)
        if not snap:
            snap = _collect_discover_pages({**par, "page": 1}, max_pages=5)
            cache.set(k, snap, _midnight_ttl_seconds())
        return snap

    strict_p = dict(base)

    # If user selected a provider OR asked for broad, use wide monetization so catalogs are fuller - KR 17/09/2025
    if broad or providers_selected:
        strict_p["with_watch_monetization_types"] = "ads,buy,flatrate,free,rent"

    genre_p      = _bucket_params(strict_p, which="genre_only")
    keyword_p    = _bucket_params(strict_p, which="keyword_only")

    # Widened variants to avoid starvation
    strict_wide  = _maybe_widen_types(strict_p,  True)
    genre_wide   = _maybe_widen_types(genre_p,   True)
    keyword_wide = _maybe_widen_types(keyword_p, True)

    # Build snapshots — KR 02/09/2025
    snap_strict      = _get_snapshot(strict_p,     "strict")
    snap_strict_wide = _get_snapshot(strict_wide,  "strict_wide")
    snap_genre       = _get_snapshot(genre_p,      "genre")
    snap_genre_wide  = _get_snapshot(genre_wide,   "genre_wide")
    snap_kw          = _get_snapshot(keyword_p,    "kw")
    snap_kw_wide     = _get_snapshot(keyword_wide, "kw_wide")

    merged = []
    for snap in (snap_strict, snap_strict_wide, snap_genre, snap_genre_wide, snap_kw, snap_kw_wide):
        merged.extend(snap.get("results", []) or [])

    # Dedupe keeping earliest priority order — KR 02/09/2025
    seen = set()
    candidates = []
    for m in merged:
        mid = m.get("id")
        if mid and mid not in seen:
            seen.add(mid)
            candidates.append(m)

    strict_ids   = {m.get("id") for m in (snap_strict.get("results", []) or [])}
    kw_ids       = {m.get("id") for m in (snap_kw.get("results", []) or [])} \
                 | {m.get("id") for m in (snap_kw_wide.get("results", []) or [])}
    genre_ids    = {m.get("id") for m in (snap_genre.get("results", []) or [])} \
                 | {m.get("id") for m in (snap_genre_wide.get("results", []) or [])}

    # Apply mood gates - KR 17/09/2025
    candidates = [m for m in candidates if _passes_genre_gate(mood_key, m)]

    def _score(m):
        mid   = m.get("id")
        pop   = float(m.get("popularity") or 0.0)
        vcnt  = int(m.get("vote_count") or 0)
        s     = 0.0
        if mid in strict_ids: s += 2.0
        if mid in kw_ids:     s += 1.0
        if mid in genre_ids:  s += 1.0
        s += pop * 0.01                  
        if vcnt < 25: s -= 0.25          
        return (-s, -pop, mid or 0)     

    candidates.sort(key=_score)

    # 3) Apply pins (float anchors to the top) — KR 02/09/2025
    stable = _apply_pins(mood_key, candidates, region=region)

    # Provider-only fallback to increase volume but STILL mood-gated (genres). — KR 10/09/2025
    if providers_selected and len(stable) < 20:
        prov_only = {
            "watch_region": region,
            "with_watch_providers": providers,
            "with_watch_monetization_types": "ads,buy,flatrate,free,rent",
            "sort_by": "popularity.desc",
            "page": 1,
        }
        prov_snap = _collect_discover_pages(prov_only, max_pages=5)
        # Keep only items that pass the mood genre gate to preserve tone
        prov_items = [m for m in (prov_snap.get("results") or []) if _passes_genre_gate(mood_key, m)]
        seen_ids = {m.get("id") for m in stable}
        extras = [m for m in prov_items if m.get("id") not in seen_ids]
        stable.extend(extras[: max(0, 80 - len(stable))])  # allow up to ~80 items pre-pagination

    # 4) Paginate (20/page) — KR 02/09/2025
    PAGE_SIZE = 20
    start = (page - 1) * PAGE_SIZE
    end   = start + PAGE_SIZE
    total_results = len(stable)
    total_pages   = max(1, (total_results + PAGE_SIZE - 1) // PAGE_SIZE)

    payload = {
        "page": page,
        "results": stable[start:end],
        "total_pages": total_pages,
        "total_results": total_results,
    }

    if debug:
        payload["_mood"]           = mood_key
        payload["_filters"]        = filters
        payload["_snapshot_sizes"] = {
            "strict": len(snap_strict.get("results", []) or []),
            "strict_wide": len(snap_strict_wide.get("results", []) or []),
            "genre": len(snap_genre.get("results", []) or []),
            "genre_wide": len(snap_genre_wide.get("results", []) or []),
            "kw": len(snap_kw.get("results", []) or []),
            "kw_wide": len(snap_kw_wide.get("results", []) or []),
        }
        payload["_picked_examples"] = [r.get("id") for r in stable[:10]]
        payload["_keywords_any"] = _effective_keywords_for(mood_key)

    return Response(payload, status=200)

# Admin: refresh/purge snapshots — KR 02/09/2025

@api_view(["POST"])
@permission_classes([IsAdminUser])  # admin-only control surface - KR 02/09/2025
def mood_refresh_snapshot(request):
    """
    Force refresh (or purge) the daily snapshot for a mood.
    """
    mood_key = (request.data.get("mood") or request.query_params.get("mood") or "").strip()
    if mood_key not in MOOD_RULES:
        return Response({"detail": f"Unknown mood '{mood_key}'"}, status=400)

    region    = (request.data.get("region") or request.query_params.get("region") or "GB").strip()
    providers = (request.data.get("providers") or request.query_params.get("providers") or "").strip()
    types_in  = (request.data.get("types") or request.query_params.get("types") or "flatrate,ads,free").strip()
    broad     = (request.data.get("broad") or request.query_params.get("broad") or "").lower() in ("1", "true", "yes")
    purge     = (request.data.get("purge") or request.query_params.get("purge") or "").lower() in ("1", "true", "yes")

    # include filters to target the exact variant - KR 17/09/2025
    filters = _parse_filters_from_request(request)

    base = build_discover_params(mood_key, region=region, providers=providers, types=types_in, page=1, filters=filters)
    attempts = []

    def widen_types(tstr: str, add: set[str]):
        cur = {s.strip() for s in tstr.split(",") if s.strip()}
        cur |= set(add)
        return ",".join(sorted(cur))

    if broad:
        wide = dict(base)
        wide["with_watch_monetization_types"] = "ads,buy,flatrate,free,rent"
        attempts.append(wide)
    else:
        attempts.append(base)
        widened = dict(base)
        widened["with_watch_monetization_types"] = widen_types(
            base["with_watch_monetization_types"], {"rent", "buy"}
        )
        attempts.append(widened)

    no_providers = dict(attempts[-1]); no_providers.pop("with_watch_providers", None); attempts.append(no_providers)
    no_excludes  = dict(no_providers);  no_excludes.pop("without_genres", None);      attempts.append(no_excludes)

    def _key(bucket, p):
        f = filters
        ftag = f"y{f.get('year_from','-')}-{f.get('year_to','-')}-rt{f.get('runtime_gte','-')}-{f.get('runtime_lte','-')}-mv{f.get('min_votes','-')}-lg{f.get('lang','-')}-sb{f.get('sort_by','-')}-va{f.get('vote_average_gte','-')}"
        return (
            f"snap2f:{bucket}:{mood_key}:{region}:{p.get('with_watch_providers','-')}:"
            f"{p.get('with_watch_monetization_types','-')}:ex{bool(p.get('without_genres'))}:"
            f"kw{bool(p.get('with_keywords'))}:{ftag}:v1"
        )

    keys = []
    sizes = []
    for p in attempts:
        bucket = 'strict' if ('with_genres' in p and 'with_keywords' in p) else ('genre' if 'with_genres' in p else 'kw')
        for name, params in [(bucket, p),
                             (bucket + "_wide", dict(p, **({"with_watch_monetization_types": "ads,buy,flatrate,free,rent"})) if p.get("with_watch_monetization_types") != "ads,buy,flatrate,free,rent" else p)]:
            snap_key = _key(name, params)
            keys.append(snap_key)
            if purge:
                cache.delete(snap_key)
                sizes.append(0)
            else:
                snap = _collect_discover_pages({**params, "page": 1}, max_pages=5)
                cache.set(snap_key, snap, _midnight_ttl_seconds())
                sizes.append(len(snap.get("results", [])))

    return Response(
        {"refreshed": (not purge), "purged": purge, "keys": keys, "sizes": sizes, "mood": mood_key, "region": region},
        status=200,
    )

# --- Admin: view/update mood config (pins + keywords) — KR 02/09/2025

@api_view(["GET", "POST"])
@permission_classes([IsAdminUser])
def moods_config(request):

    if request.method == "GET":
        pins_ov = _get_overrides(_OVR_PINS_KEY)
        kw_ov   = _get_overrides(_OVR_KEYWORDS_KEY)
        moods = sorted(MOOD_RULES.keys())
        data = {
            "moods": moods,
            "pins": {
                m: {
                    "base": PINNED_BASE.get(m, []),
                    "override": pins_ov.get(m, []),
                    "effective": _effective_pins_for(m),
                } for m in moods
            },
            "keywords": {
                m: {
                    "base": KEYWORDS_BASE.get(m, []),
                    "override": kw_ov.get(m, []),
                    "effective": _effective_keywords_for(m),
                } for m in moods
            }
        }
        return Response(data, status=200)

    # POST (update)
    pins_patch = request.data.get("pins") or {}
    kw_patch   = request.data.get("keywords") or {}

    if not isinstance(pins_patch, dict) or not isinstance(kw_patch, dict):
        return Response({"detail": "pins and keywords must be objects"}, status=400)

    pins_ov = _get_overrides(_OVR_PINS_KEY)
    kw_ov   = _get_overrides(_OVR_KEYWORDS_KEY)

    for mood, ids in pins_patch.items():
        if mood not in MOOD_RULES:
            return Response({"detail": f"Unknown mood '{mood}' in pins"}, status=400)
        # Replace override list completely
        pins_ov[mood] = [int(x) for x in (ids or [])]

    for mood, kws in kw_patch.items():
        if mood not in MOOD_RULES:
            return Response({"detail": f"Unknown mood '{mood}' in keywords"}, status=400)
        kw_ov[mood] = [str(x) for x in (kws or [])]

    _set_overrides(_OVR_PINS_KEY, pins_ov)
    _set_overrides(_OVR_KEYWORDS_KEY, kw_ov)

    return Response({"ok": True}, status=200)

#  Admin: quick pin add/remove — KR 03/09/2025

@api_view(["POST"])
@permission_classes([IsAdminUser])
def mood_pins_mutate(request):
    """
    Add/remove a single pinned movie ID for a mood.
    Body: { "mood": "feelgood", "add": 123 }  OR  { "mood": "feelgood", "remove": 123 }
    """
    mood = (request.data.get("mood") or "").strip()
    if mood not in MOOD_RULES:
        return Response({"detail": f"Unknown mood '{mood}'"}, status=400)

    add = request.data.get("add")
    rem = request.data.get("remove")

    pins_ov = _get_overrides(_OVR_PINS_KEY)
    cur = pins_ov.get(mood, [])[:]

    if add is not None:
        add = int(add)
        if add not in cur:
            cur.insert(0, add)  # new pins float to front of override list
    if rem is not None:
        rem = int(rem)
        cur = [x for x in cur if x != rem]

    pins_ov[mood] = cur
    _set_overrides(_OVR_PINS_KEY, pins_ov)
    return Response({"effective": _effective_pins_for(mood), "override": cur}, status=200)

#  Admin: keywords add/remove/list — KR 02/09/2025

@api_view(["GET", "POST"])
@permission_classes([IsAdminUser])
def mood_keywords_mutate(request):
    """
    GET  ?mood=feelgood           -> returns base/override/effective lists
    POST { "mood":"feelgood", "add":["123","456"] } OR { "mood":"feelgood", "remove":["123"] }
    """
    if request.method == "GET":
        mood = (request.query_params.get("mood") or "").strip()
        if mood not in MOOD_RULES:
            return Response({"detail": f"Unknown mood '{mood}'"}, status=400)
        return Response({
            "mood": mood,
            "base": KEYWORDS_BASE.get(mood, []),
            "override": _get_overrides(_OVR_KEYWORDS_KEY).get(mood, []),
            "effective": _effective_keywords_for(mood),
        }, status=200)

    mood = (request.data.get("mood") or "").strip()
    if mood not in MOOD_RULES:
        return Response({"detail": f"Unknown mood '{mood}'"}, status=400)

    add = request.data.get("add") or []
    rem = request.data.get("remove") or []

    kw_ov = _get_overrides(_OVR_KEYWORDS_KEY)
    cur = [str(x) for x in kw_ov.get(mood, [])]

    if add:
        for kw in add:
            kw = str(kw)
            if kw not in cur:
                cur.insert(0, kw)
    if rem:
        rem_set = {str(x) for x in rem}
        cur = [x for x in cur if x not in rem_set]

    kw_ov[mood] = cur
    _set_overrides(_OVR_KEYWORDS_KEY, kw_ov)

    return Response({"effective": _effective_keywords_for(mood), "override": cur}, status=200)

# --- Admin: seed keywords from a TMDB movie — KR 02/09/2025

@api_view(["POST"])
@permission_classes([IsAdminUser])
def mood_seed_from_movie(request):
    """
    Seed a mood's keyword overrides from a TMDB movie's keywords.
    """
    mood = (request.data.get("mood") or "").strip()
    if mood not in MOOD_RULES:
        return Response({"detail": f"Unknown mood '{mood}'"}, status=400)

    tmdb_id = request.data.get("tmdb_id")
    title   = (request.data.get("title") or "").strip()
    limit   = int(request.data.get("limit") or 15)
    region  = (request.data.get("region") or "GB").strip()

    if not tmdb_id and not title:
        return Response({"detail": "Provide tmdb_id or title"}, status=400)

    # Resolve title to id if needed - KR 17/09/2025
    if not tmdb_id:
        srch, err = _tmdb_get("/search/movie", {"query": title})
        if err:
            return err
        top = ((srch or {}).get("results") or [])
        if not top:
            return Response({"detail": f"No TMDB results for title '{title}'"}, status=404)
        tmdb_id = top[0].get("id")

    # Fetch keywords for that movie - KR 17/09/2025
    kw_data, err2 = _tmdb_get(f"/movie/{tmdb_id}/keywords")
    if err2:
        return err2

    kws = (kw_data or {}).get("keywords") or []
    picked_ids = [str(k.get("id")) for k in kws if k.get("id")][:max(1, limit)]

    if not picked_ids:
        return Response({"detail": f"No keywords found for movie id {tmdb_id}"}, status=404)

    # Merge into overrides - KR 17/09/2025
    kw_ov = _get_overrides(_OVR_KEYWORDS_KEY)
    cur = [str(x) for x in kw_ov.get(mood, [])]
    for kw in picked_ids[::-1]:
        if kw in cur:
            continue
        cur.insert(0, kw)
    kw_ov[mood] = cur
    _set_overrides(_OVR_KEYWORDS_KEY, kw_ov)

    # Purge today's snapshots for this mood so next fetch picks them up quickly - KR 10/09/2025
    def _purge_snapshots_for_mood(mood_key: str, region_key: str):
        deleted = []
        buckets = ["strict", "strict_wide", "genre", "genre_wide", "kw", "kw_wide"]
        for bucket in buckets:
            key = f"snap2f:{bucket}:{mood_key}:{region_key}:-:flatrate,ads,free:exTrue:kwTrue:y- --rt- -mv- -lg- -sb- -va-:v1"
            cache.delete(key)
            deleted.append(key)
        return deleted

    deleted_keys = _purge_snapshots_for_mood(mood, region)

    return Response({
        "mood": mood,
        "tmdb_id": tmdb_id,
        "added_keywords": picked_ids,
        "effective_keywords": _effective_keywords_for(mood),
        "purged_count": len(deleted_keys)
    }, status=200)