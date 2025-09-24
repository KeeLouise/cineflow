from io import BytesIO
import re
from PIL import Image
from colorthief import ColorThief

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from api.services.tmdb import tmdb_get, cache_get, cache_set

# Pre-validate the incoming TMDB path for safety - KR 26/08/2025
_TMDB_PATH_RE = re.compile(r"^/t/p/(original|w500|w780|w342|w154|w92)/[A-Za-z0-9._-]+$")

# poster palette
@api_view(["GET"])
@permission_classes([AllowAny])
def poster_palette(request):
    """
    Extract a small color palette (3 swatches) from a TMDB poster image.
    Query: ?path=/t/p/w500/abcdef.jpg
    Returns: {"palette": [[r,g,b],[r,g,b],[r,g,b]]}  - KR 26/08/2025
    """
    import requests

    path = request.query_params.get("path", "")
    if not path or not _TMDB_PATH_RE.match(path):
        return Response({"detail": "Invalid or missing TMDB path"}, status=400)

    url = f"https://image.tmdb.org{path}"
    try:
        r = requests.get(url, timeout=8)
        r.raise_for_status()
        ctype = r.headers.get("Content-Type", "")
        if "image" not in ctype:
            return Response({"detail": "TMDB did not return an image", "ctype": ctype}, status=502)

        img = Image.open(BytesIO(r.content)).convert("RGB")
        bio = BytesIO(); img.save(bio, format="PNG"); bio.seek(0)

        ct = ColorThief(bio)
        palette = ct.get_palette(color_count=3, quality=10) or []
        palette = [list(s) for s in palette][:3]
        while len(palette) < 2:
            palette.append([20, 20, 20])

        return Response({"palette": palette}, status=200)
    except Exception as e:
        return Response({"detail": "Palette extraction failed", "error": str(e)}, status=500)

# trending
@api_view(["GET"])
@permission_classes([AllowAny])
def trending_movies(request):
    """
    Returns trending movies of the week from TMDB.
    """
    cache_key = "tmdb:trending:movie:week"
    data = cache_get(cache_key)
    if not data:
        data, err = tmdb_get("/trending/movie/week")
        if err:
            return err
        cache_set(cache_key, data, 60 * 10)
    return Response(data, status=200)

# search by title
@api_view(["GET"])
@permission_classes([AllowAny])
def search_movies(request):
    """
    Search movies by title.
    """
    q = request.query_params.get("q", "").strip()
    if not q:
        return Response({"results": []}, status=200)

    data, err = tmdb_get("/search/movie", {"query": q})
    if err:
        return err
    return Response(data, status=200)

# now playing
@api_view(["GET"])
@permission_classes([AllowAny])
def now_playing(request):
    """
    What's on in cinemas (TMDB /movie/now_playing)
    Cached for 10 minutes to reduce TMDB calls. - KR 21/08/2025
    """
    region = request.query_params.get("region", "US")
    page = request.query_params.get("page", "1")

    cache_key = f"tmdb:now_playing:{region}:p{page}"
    data = cache_get(cache_key)
    if not data:
        data, err = tmdb_get("/movie/now_playing", {"region": region, "page": page})
        if err:
            return err
        cache_set(cache_key, data, 60 * 10)
    return Response(data, status=200)

# streaming discover
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
        params["with_watch_providers"] = providers

    cache_key = f"tmdb:streaming:{region}:{providers}:{types}:p{page}"
    data = cache_get(cache_key)
    if not data:
        data, err = tmdb_get("/discover/movie", params)
        if err:
            return err
        if debug:
            data = dict(data)
            data["_debug_params"] = params
        cache_set(cache_key, data, 60 * 10)
    elif debug:
        d = dict(data)
        d["_debug_params"] = params
        return Response(d, status=200)

    return Response(data, status=200)

# providers catalog
@api_view(["GET"])
@permission_classes([AllowAny])
def providers_movies(request):
    region = request.query_params.get("region", "US")
    cache_key = f"tmdb:providers:movie:{region}"
    data = cache_get(cache_key)
    if not data:
        data, err = tmdb_get("/watch/providers/movie", {"watch_region": region})
        if err:
            return err
        cache_set(cache_key, data, 60 * 60)  # 1 hour
    return Response(data, status=200)

# people -> credits
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
    data = cache_get(cache_key)
    if data:
        return Response(data, status=200)

    person_data, err = tmdb_get("/search/person", {"query": q})
    if err:
        return err

    results = (person_data or {}).get("results", [])
    if not results:
        return Response({"results": []}, status=200)

    person_id = results[0].get("id")
    if not person_id:
        return Response({"results": []}, status=200)

    credits, err2 = tmdb_get(f"/person/{person_id}/movie_credits")
    if err2:
        return err2

    movies = (credits or {}).get("cast", [])
    seen = set()
    cleaned = []
    for m in sorted(movies, key=lambda x: x.get("popularity", 0), reverse=True):
        mid = m.get("id")
        if mid and mid not in seen:
            seen.add(mid)
            cleaned.append(m)

    payload = {"results": cleaned}
    cache_set(cache_key, payload, 60 * 10)
    return Response(payload, status=200)

# single movie detail
@api_view(["GET"])
@permission_classes([AllowAny])
def movie_detail(request, tmdb_id: int):
    """
    Return a single movie's detail and credits merged into one payload.
    Cached for 30 minutes to reduce API calls. - KR 26/08/2025
    Now includes trailers and watch/providers via append_to_response. - KR 26/08/2025
    """
    region = request.query_params.get("region", "IE").upper()

    cache_key = f"tmdb:movie:{tmdb_id}:detail+credits+videos+providers:{region}"
    data = cache_get(cache_key)
    if data:
        return Response(data, status=200)

    params = {"append_to_response": "videos,credits,watch/providers"}
    details, err = tmdb_get(f"/movie/{tmdb_id}", params)
    if err:
        return err

    merged = details or {}
    merged["credits"] = (merged.get("credits") or {"cast": [], "crew": []})

    wp = merged.get("watch/providers") or {}
    try:
        region_block = (wp.get("results", {}) or {}).get(region) \
                       or (wp.get("results", {}) or {}).get("US") \
                       or {}
    except Exception:
        region_block = {}
    merged["providers"] = region_block

    cache_set(cache_key, merged, 60 * 30)
    return Response(merged, status=200)

# registration passthrough
from rest_framework import serializers
from django.contrib.auth import get_user_model

class RegisterSerializer(serializers.ModelSerializer):
    # Import user registration serializer - KR 21/08/2025
    password = serializers.CharField(write_only=True)
    class Meta:
        model = get_user_model()
        fields = ("username", "password",)

    def create(self, validated_data):
        User = get_user_model()
        return User.objects.create_user(
            username=validated_data["username"],
            password=validated_data["password"],
        )

@api_view(["POST"])
@permission_classes([AllowAny])
def register(request):
    """
    Register a new user in Django via API.  KR 21/08/2025
    """
    serializer = RegisterSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save()
        return Response({"message": "User created successfully!"}, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)