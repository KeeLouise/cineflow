from django.urls import path
from .views import register, trending_movies, search_movies, now_playing, streaming_trending, providers_movies, person_movies, movie_detail
from core.views import ping, secure_view

urlpatterns = [
    path("register/", register, name="api_register"),
    path("ping/", ping, name="api_ping"),
    path("secure/", secure_view, name="api_secure"),
    path("movies/trending/", trending_movies, name="movies_trending"),
    path("movies/search/", search_movies, name="movies_search"),
    path("movies/now_playing/", now_playing, name="movies_now_playing"),
    path("movies/streaming_trending/", streaming_trending, name="movies_streaming_trending"),
    path("movies/providers/", providers_movies, name="movies_providers"),
    path("movies/by_person/", person_movies, name="person_movies"),
    path("movies/<int:tmdb_id>/", movie_detail, name="api_movie_detail"),  # KR 25/08/2025
]