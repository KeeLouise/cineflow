from django.urls import path
from .views import trending_movies, search_movies, now_playing, streaming_trending, providers_movies, person_movies, movie_detail, poster_palette, mood_discover, mood_refresh_snapshot
from core.views import ping, secure_view
from django.urls import path
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)


urlpatterns = [
    # Auth (JWT)
    path("token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),

    # checks
    path("ping/", ping, name="api_ping"),
    path("secure/", secure_view, name="api_secure"),

    # Public movie endpoints
    path("movies/trending/", trending_movies, name="movies_trending"),
    path("movies/search/", search_movies, name="movies_search"),
    path("movies/now_playing/", now_playing, name="movies_now_playing"),
    path("movies/streaming_trending/", streaming_trending, name="movies_streaming_trending"),
    path("movies/providers/", providers_movies, name="movies_providers"),
    path("movies/by_person/", person_movies, name="person_movies"),
    path("movies/<int:tmdb_id>/", movie_detail, name="api_movie_detail"),
    path("movies/poster_palette/", poster_palette, name="api_poster_palette"),

    # Protected mood endpoint (requires JWT)
    path("movies/mood/<str:mood_key>/", mood_discover, name="mood-discover"),
    path("moods/refresh/", mood_refresh_snapshot, name="mood-refresh"),
    
]