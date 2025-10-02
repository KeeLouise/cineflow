from django.urls import path
from . import views

urlpatterns = [
    path("api/ping/", views.ping, name="api_ping"),
    path("api/secure/", views.secure_view, name="api_secure"),
]