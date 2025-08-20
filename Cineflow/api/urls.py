from django.urls import path
from .views import register
from core.views import ping, secure_view

urlpatterns = [
    path("register/", register, name="api_register"),
    path("ping/", ping, name="api_ping"),
    path("secure/", secure_view, name="api_secure"),
]