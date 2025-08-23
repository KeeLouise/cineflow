from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

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
        return None, Response({"detail": "TMBD_API_KEY not set on server"}, status=500)
    
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
            {"detail": "TMBD request failed", "error": str(e)}, 
            status=502
        ) 

# ---- API Endpoints ---- KR 21/08/2025

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