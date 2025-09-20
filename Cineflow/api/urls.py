# api/urls.py

from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

# Health/secure checks live in core - KR 21/08/2025
from core.views import ping, secure_view

# Public + protected API views - KR 02/09/2025
from . import views

urlpatterns = [
    # --- Auth (JWT) --- KR 01/09/2025
    path("token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),

    # --- Health/secure checks --- KR 21/08/2025
    path("ping/", ping, name="api_ping"),
    path("secure/", secure_view, name="api_secure"),

    # --- Public endpoints --- KR 21/08/2025
    path("register/", views.register, name="api_register"),
    path("movies/trending/", views.trending_movies, name="movies_trending"),
    path("movies/search/", views.search_movies, name="movies_search"),
    path("movies/now_playing/", views.now_playing, name="movies_now_playing"),
    path("movies/streaming_trending/", views.streaming_trending, name="movies_streaming_trending"),
    path("movies/providers/", views.providers_movies, name="movies_providers"),
    path("movies/by_person/", views.person_movies, name="person_movies"),
    path("movies/<int:tmdb_id>/", views.movie_detail, name="api_movie_detail"),
    path("movies/poster_palette/", views.poster_palette, name="api_poster_palette"),

    # --- Mood endpoints (protected) --- KR 02/09/2025
    path("movies/mood/<str:mood_key>/", views.mood_discover, name="mood-discover"),
    path("moods/refresh/", views.mood_refresh_snapshot, name="mood-refresh"),

    # --- Admin mood config (protected) --- KR 03/09/2025
    path("moods/config/", views.moods_config, name="moods-config"),
    path("moods/pins/", views.mood_pins_mutate, name="mood-pins-mutate"),
    path("moods/keywords/", views.mood_keywords_mutate, name="mood-keywords-mutate"),
    path("moods/seed/", views.mood_seed_from_movie, name="mood-seed-from-movie"),

    # --- Admin util: clear snapshots (protected) --- KR 19/09/2025
    path("moods/clear_snapshots/", views.clear_all_snapshots, name="moods-clear-snapshots"),
]