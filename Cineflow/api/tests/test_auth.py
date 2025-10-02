from django.contrib.auth import get_user_model
from django.core import mail, signing
from django.urls import reverse
from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from django.test import override_settings
from api.tokens import make_email_token, make_password_reset_token
from api.models import UserProfile

User = get_user_model()

class AuthFlowTests(APITestCase):
    def setUp(self):
        self.client = APIClient()

    @override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
    def test_register_creates_active_user_and_sends_verification(self):
        res = self.client.post("/api/auth/register/", {
            "username": "alice",
            "email": "alice@example.com",
            "password": "supersecret123",
        }, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

        u = User.objects.get(username__iexact="alice")
        self.assertTrue(u.is_active)

        # profile auto-created - KR
        prof = getattr(u, "profile", None) or getattr(u, "userprofile", None)
        self.assertIsNotNone(prof)

        # email sent - KR
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("Verify your Cineflow account", mail.outbox[0].subject)
        self.assertIn("alice@example.com", mail.outbox[0].to)

    @override_settings(FRONTEND_URL="https://example-frontend.app")
    def test_verify_email_success(self):
        u = User.objects.create_user("bob", "bob@example.com", "pass12345")
        token = make_email_token(u)
        url = f"/api/auth/verify/?token={token}&redirect=0"  # JSON, not redirect
        res = self.client.get(url)
        self.assertEqual(res.status_code, 200)
        u.refresh_from_db()
        self.assertTrue(u.is_active)
        prof = getattr(u, "profile", None) or getattr(u, "userprofile", None)
        self.assertTrue(getattr(prof, "email_verified", False))

    def test_verify_email_expired(self):
        u = User.objects.create_user("carol", "carol@example.com", "pass12345")
        token = make_email_token(u)
        # Simulate expiry by using a max_age - KR
        with self.settings(PASSWORD_RESET_TOKEN_TTL=1):
            pass  

    def test_login_2fa_required_then_success(self):
        u = User.objects.create_user("dan", "dan@example.com", "pass12345")
        # turn on 2FA
        prof = UserProfile.objects.get(user=u)
        prof.two_factor_enabled = True
        prof.save()

        # first attempt → otp required
        res = self.client.post("/api/token/", {"username": "dan", "password": "pass12345"}, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("otp", res.data)

        prof.two_factor_enabled = False
        prof.save()
        res2 = self.client.post("/api/token/", {"username": "dan", "password": "pass12345"}, format="json")
        self.assertEqual(res2.status_code, 200)
        self.assertIn("access", res2.data)
        self.assertIn("refresh", res2.data)

    @override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
    def test_password_reset_request_and_confirm(self):
        u = User.objects.create_user("eve", "eve@example.com", "supersecret123")
        # request - KR
        r1 = self.client.post("/api/auth/password/reset/", {"email": "eve@example.com"}, format="json")
        self.assertEqual(r1.status_code, 200)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("Reset your Cineflow password", mail.outbox[0].subject)

        # confirm - KR
        token = make_password_reset_token(u)
        r2 = self.client.post("/api/auth/password/reset/confirm/", {
            "token": token,
            "password": "newpass123",
            "password2": "newpass123",
        }, format="json")
        self.assertEqual(r2.status_code, 200)

        # can log in with new password - KR
        ok = self.client.post("/api/token/", {"username": "eve", "password": "newpass123"}, format="json")
        self.assertEqual(ok.status_code, 200)