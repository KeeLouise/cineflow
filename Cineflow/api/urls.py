from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from core.views import ping, secure_view

# Public
from api.views.tmdb_public import (
    register,
    trending_movies,
    search_movies,
    now_playing,
    streaming_trending,
    providers_movies,
    person_movies,
    movie_detail,
    poster_palette,
)

# Mood (protected + admin)
from api.views.mood_discover import mood_discover
from api.views.mood_admin import (
    moods_config,
    mood_pins_mutate,
    mood_keywords_mutate,
    mood_seed_from_movie,
    mood_refresh_snapshot,
    clear_all_snapshots,
)

urlpatterns = [
    # --- Auth (JWT) --- KR 01/09/2025
    path("token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),

    # --- Health/secure checks --- KR 21/08/2025
    path("ping/", ping, name="api_ping"),
    path("secure/", secure_view, name="api_secure"),

    # --- Public endpoints --- KR 21/08/2025
    path("register/", register, name="api_register"),
    path("movies/trending/", trending_movies, name="movies_trending"),
    path("movies/search/", search_movies, name="movies_search"),
    path("movies/now_playing/", now_playing, name="movies_now_playing"),
    path("movies/streaming_trending/", streaming_trending, name="movies_streaming_trending"),
    path("movies/providers/", providers_movies, name="movies_providers"),
    path("movies/by_person/", person_movies, name="person_movies"),
    path("movies/<int:tmdb_id>/", movie_detail, name="api_movie_detail"),
    path("movies/poster_palette/", poster_palette, name="api_poster_palette"),

    # --- Mood endpoints (protected) --- KR 02/09/2025
    path("movies/mood/<str:mood_key>/", mood_discover, name="mood-discover"),
    path("moods/refresh/", mood_refresh_snapshot, name="mood-refresh"),

    # --- Admin mood config (protected) --- KR 03/09/2025
    path("moods/config/", moods_config, name="moods-config"),
    path("moods/pins/", mood_pins_mutate, name="mood-pins-mutate"),
    path("moods/keywords/", mood_keywords_mutate, name="mood-keywords-mutate"),
    path("moods/seed/", mood_seed_from_movie, name="mood-seed-from-movie"),

    # --- Admin util: clear snapshots (protected) --- KR 19/09/2025
    path("moods/clear_snapshots/", clear_all_snapshots, name="moods-clear-snapshots"),
]