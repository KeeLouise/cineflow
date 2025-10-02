import pytest
from django.urls import reverse
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

User = get_user_model()

@pytest.mark.django_db
def test_login_otp_challenge(monkeypatch):
    u = User.objects.create_user(username="alice", email="a@example.com", password="passpass")
    # Simulate user flagged for 2FA - KR
    prof = getattr(u, "profile", None) or getattr(u, "userprofile", None)
    if prof:
        prof.two_factor_enabled = True
        prof.save()
    client = APIClient()
    r = client.post("/api/token/", {"username": "alice", "password": "passpass"}, format="json")
    assert r.status_code == 400
    assert "otp" in r.json()

@pytest.mark.django_db
def test_password_reset_happy_path(client, mailoutbox):
    u = User.objects.create_user(username="bob", email="b@example.com", password="passpass")
    r = client.post("/api/auth/password/reset/", {"email": "b@example.com"}, format="json")
    assert r.status_code == 200
    # One email sent with a token URL in the body - KR
    assert len(mailoutbox) == 1
    body = mailoutbox[0].body + (mailoutbox[0].alternatives[0][0] if mailoutbox[0].alternatives else "")
    assert "reset" in body.lower()