from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from io import BytesIO
from PIL import Image
from colorthief import ColorThief
import re

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
        # Perform GET request to TMDB
        r = requests.get(url, params=p, timeout=6)
        r.raise_for_status()     # Raise exception if status != 200
        return r.json(), None    # Return JSON data
    except requests.RequestException as e:
        # Catch network errors, bad status codes, etc. - KR 21/08/2025
        return None, Response(
            {"detail": "TMDB request failed", "error": str(e)}, 
            status=502
        ) 

# ---- API Endpoints ---- KR 21/08/2025


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

# --- EXTRA ENDPOINTS FOR HOME SECTIONS ---  - KR 21/08/2025

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
        cache.set(cache_key, data, 60 * 10)  # 10 mins
    return Response(data, status=200)


@api_view(["GET"])
@permission_classes([AllowAny])
def streaming_trending(request):
    """
    Trending on streaming (TMDB /discover/movie)
    Query params:
      - region (default "US") => watch_region
      - providers (pipe-separated TMDB provider IDs, optional) => with_watch_providers
      - types (default depends: flatrate if providers present, else flatrate,ads,free)
      - page (default "1")
      - broad (0/1) → when 1 and providers present, allow ads/free too
      - debug (1) → include _debug_params in the response
    Cached for 10 minutes.
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
        # Attach debug echo if requested
        if debug:
            data = dict(data)
            data["_debug_params"] = params
        cache.set(cache_key, data, 60 * 10)

    elif debug:
        # Ensure debug shows for cached responses too
        d = dict(data)
        d["_debug_params"] = params
        return Response(d, status=200)

    return Response(data, status=200)

def _tmdb_get(path, params=None):
    """
    Generic helper to call the TMDB API.
    - Builds the full URL with `TMDB_BASE` + endpoint path.
    - Adds the API key automatically to all requests.
    - Handles exceptions and timeouts.
    - Returns (data, None) on success OR (None, Response) on error.
    """

    if not TMDB_KEY:
        return None, Response({"detail": "TMDB_API_KEY not set on server"}, status=500)

    url = f"{TMDB_BASE}{path}"
    p = {"api_key": TMDB_KEY}
    if params:
        p.update(params)

    try:
        # Log the final URL including query params for debugging
        full_url = requests.Request('GET', url, params=p).prepare().url
        print("[TMDB GET]", full_url)

        r = requests.get(url, params=p, timeout=6)
        r.raise_for_status()
        return r.json(), None
    except requests.RequestException as e:
        return None, Response(
            {"detail": "TMDB request failed", "error": str(e)},
            status=502
        )

@api_view(["GET"])
@permission_classes([AllowAny])
def providers_movies(request):
    """
    List available streaming providers for movies in a region
    (TMDB /watch/providers/movie). Use to build a provider picker.
    Query: region (default "US"). Cached for 1 hour. - KR 21/08/2025
    """
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