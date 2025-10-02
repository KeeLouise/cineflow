import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

@pytest.mark.django_db
def test_watchlist_create_and_add_items():
    U = get_user_model()
    u = U.objects.create_user("d", "d@example.com", "passpass")
    client = APIClient()
    from rest_framework_simplejwt.tokens import RefreshToken
    token = RefreshToken.for_user(u).access_token
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {str(token)}")

    r = client.post("/api/watchlists/", {"name": "My List"}, format="json")
    assert r.status_code == 201
    wid = r.json()["id"]

    r2 = client.post(f"/api/watchlists/{wid}/items/", {"tmdb_id": 550, "title": "Fight Club"}, format="json")
    assert r2.status_code == 201

    # duplicate should fail - KR 02/10/2025
    r3 = client.post(f"/api/watchlists/{wid}/items/", {"tmdb_id": 550, "title": "Fight Club"}, format="json")
    assert r3.status_code in (400, 409)