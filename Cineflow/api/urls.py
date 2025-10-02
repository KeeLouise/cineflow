from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views.profile import me_profile

from core.views import ping, secure_view

from api.views.mood_discover import mood_discover
from api.views.mood_admin import (
    moods_config,
    mood_pins_mutate,
    mood_keywords_mutate,
    mood_seed_from_movie,
    mood_refresh_snapshot,
    clear_all_snapshots,
)

from api.views.tmdb_public import (
    trending_movies, search_movies, now_playing, streaming_trending,
    providers_movies, person_movies, movie_detail, poster_palette,
)

from .views import watchlists as views
from .views import watchrooms as rooms

# auth views & custom JWT view
from api.views.auth_views import (
    register, verify_email,
    resend_verification_public, resend_verification_authenticated
)
from api.views.jwt_views import ActiveUserTokenObtainPairView


urlpatterns = [
    # --- Auth (JWT) ---
    path("token/", ActiveUserTokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("auth/register/", register, name="auth_register"),
    path("auth/verify/", verify_email, name="auth_verify_email"),
    path("auth/resend/", resend_verification_public, name="auth_resend_public"),
    path("auth/resend_me/", resend_verification_authenticated, name="auth_resend_me"),

    # Profile
    path("me/profile/", me_profile, name="me_profile"),

    # Health/secure
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

    # Mood (protected)
    path("movies/mood/<str:mood_key>/", mood_discover, name="mood-discover"),
    path("moods/refresh/", mood_refresh_snapshot, name="mood-refresh"),

    # Admin mood config (protected)
    path("moods/config/", moods_config, name="moods-config"),
    path("moods/pins/", mood_pins_mutate, name="mood-pins-mutate"),
    path("moods/keywords/", mood_keywords_mutate, name="mood-keywords-mutate"),
    path("moods/seed/", mood_seed_from_movie, name="mood-seed-from-movie"),

    # Admin util
    path("moods/clear_snapshots/", clear_all_snapshots, name="moods-clear-snapshots"),

    # Watchlists
    path("watchlists/", views.my_watchlists, name="my_watchlists"),
    path("watchlists/<int:pk>/", views.watchlist_detail, name="watchlist_detail"),
    path("watchlists/<int:list_id>/items/", views.add_item, name="add_item"),
    path("watchlists/<int:list_id>/items/<int:item_id>/", views.update_item, name="update_item"),
    path("watchlists/<int:list_id>/items/<int:item_id>/delete/", views.remove_item, name="remove_item"),
    path("watchlists/<int:list_id>/reorder/", views.reorder_items, name="reorder_items"),

    # Watchlist collaborators
    path("watchlists/<int:list_id>/collaborators/", rooms.watchlist_collaborators, name="watchlist_collaborators"),

    # Watch party rooms
    path("rooms/", rooms.my_rooms, name="my_rooms"),
    path("rooms/join/", rooms.room_join, name="room_join"),
    path("rooms/<int:room_id>/", rooms.room_detail, name="room_detail"),
    path("rooms/<int:room_id>/members/", rooms.room_members, name="room_members"),
    path("rooms/<int:room_id>/movies/", rooms.room_movies, name="room_movies"),
    path("rooms/<int:room_id>/movies/reorder/", rooms.room_movies_reorder, name="room_movies_reorder"),
    path("rooms/<int:room_id>/movies/<int:movie_id>/", rooms.room_movie_delete, name="room_movie_delete"),
    path("rooms/<int:room_id>/movies/<int:movie_id>/vote/", rooms.room_movie_vote, name="room_movie_vote"),

    # Auth Email

    path("auth/resend_me/", resend_verification_authenticated, name="auth_resend_me"),
]
