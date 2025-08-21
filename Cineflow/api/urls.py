from django.urls import path
from .views import register, trending_movies, search_movies
from core.views import ping, secure_view

urlpatterns = [
    path("register/", register, name="api_register"),
    path("ping/", ping, name="api_ping"),
    path("secure/", secure_view, name="api_secure"),
    path("movies/trending/", trending_movies, name="movies_trending"),
    path("movies/search/", search_movies, name="movies_search"),
]