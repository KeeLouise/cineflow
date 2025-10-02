from django.core import signing
from django.contrib.auth import get_user_model
from unittest.mock import patch
from rest_framework.test import APITestCase

User = get_user_model()


class PasswordResetTests(APITestCase):
    def setUp(self):
        self.u = User.objects.create_user("zoe", email="zoe@example.com", password="oldpass123")

    def test_request_always_200_even_when_email_unknown(self):
        r1 = self.client.post("/api/auth/password/reset/", {"email": "zoe@example.com"})
        r2 = self.client.post("/api/auth/password/reset/", {"email": "nobody@example.com"})
        self.assertEqual(r1.status_code, 200)
        self.assertEqual(r2.status_code, 200)

    def test_confirm_missing_and_mismatch(self):
        r = self.client.post("/api/auth/password/reset/confirm/", {})
        self.assertEqual(r.status_code, 400)
        self.assertIn("Missing token", str(r.data))

        tok = signing.dumps({"uid": self.u.pk, "email": self.u.email})
        r2 = self.client.post("/api/auth/password/reset/confirm/", {
            "token": tok,
            "password": "abcdefgh",
            "password2": "ABCDxxxx",  # mismatch
        })
        self.assertEqual(r2.status_code, 400)
        self.assertIn("Passwords do not match", str(r2.data))

    def test_confirm_too_short(self):
        tok = signing.dumps({"uid": self.u.pk, "email": self.u.email})
        r = self.client.post("/api/auth/password/reset/confirm/", {
            "token": tok,
            "password": "short",
            "password2": "short",
        })
        self.assertEqual(r.status_code, 400)
        self.assertIn("at least 8", str(r.data))

class PasswordResetTests(APITestCase):
    def setUp(self):
        self.u = User.objects.create_user("pw", email="pw@ex.com", password="passpass")

    @patch("api.tokens.read_password_reset_token")
    def test_confirm_expired_or_bad_token(self, mock_read):
        mock_read.side_effect = signing.SignatureExpired("expired")
        r1 = self.client.post("/api/auth/password/reset/confirm/", {
            "token": "x", "password": "abcdefgh", "password2": "abcdefgh"
        })
        self.assertEqual(r1.status_code, 400)
        self.assertTrue("expired" in str(r1.data).lower() or "invalid reset link" in str(r1.data).lower())

        mock_read.side_effect = signing.BadSignature("bad")
        r2 = self.client.post("/api/auth/password/reset/confirm/", {
            "token": "y", "password": "abcdefgh", "password2": "abcdefgh"
        })
        self.assertEqual(r2.status_code, 400)
        self.assertIn("invalid", str(r2.data).lower())

    def test_confirm_happy_path(self):
        tok = signing.dumps({"uid": self.u.pk, "email": self.u.email})
        r = self.client.post("/api/auth/password/reset/confirm/", {
            "token": tok, "password": "abcdefgh", "password2": "abcdefgh"
        })
        self.assertEqual(r.status_code, 200)