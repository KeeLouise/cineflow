from django.urls import path
from . import views

urlpatterns = [
    path("", views.home, name="home"),
    path("api/ping/", views.ping, name="api_ping"),
]