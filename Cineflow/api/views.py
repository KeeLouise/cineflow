from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from .serializers import RegisterSerializer
import os
import requests
from django.core.cache import cache

TMDB_BASE = "https://api.themoviedb.org/3"
TMDB_KEY = os.environ.get("TMDB_API_KEY", "")

def _tmdb_get(path, params=None):
    if not TMDB_KEY:
        return None, Response({"detail": "TMBD_API_KEY ot set on server"}, status=500)
    
    url = f"{TMDB_BASE}{path}"
    p = {"api_key": TMDB_KEY}
    if params:
        p.update(params)

    try:
        r = requests.get(url, params=p, timeout=6)
        r.raise_for_status()
        return r.json(), None
    except requests.RequestException as e:
        return None, Response({"detail": "TMBD request failed", "error": str(e)}, status=502) 


@api_view(["GET"])
@permission_classes([AllowAny])
def trending_movies(request):
    """Return trending movies of the week (cached for 10 min)."""
    cache_key = "tmdb:trending:movie:week"
    data = cache.get(cache_key)
    if not data:
        data, err = _tmdb_get("/trending/movie/week")
        if err:
            return err
        cache.set(cache_key, data, 60 * 10)
    return Response(data, status=200)

@api_view(["GET"])
@permission_classes([AllowAny])
def search_movies(request):
    """Search movies by title. Usage: /api/movies/search/?q=barbie"""
    q = request.query_params.get("q", "").strip()
    if not q:
        return Response({"results": []}, status=200)
    data, err = _tmdb_get("/search/movie", {"query": q})
    if err:
        return err
    return Response(data, status=200)

@api_view(["POST"])
@permission_classes([AllowAny])  # Anyone can sign up - KR 20/08/2025
def register(request):
    serializer = RegisterSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save()
        return Response({"message": "User created successfully!"}, status=status.HTTP_201_CREATED)
    # DRF will include per-field errors like {"username": ["This field must be unique."]} - KR 20/08/2025
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)