from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from django.core.files.uploadedfile import SimpleUploadedFile
from core.test_utils import temp_media
from django.core.files.uploadedfile import SimpleUploadedFile
import base64

# 1x1 transparent PNG
_ONE_PX_PNG_B64 = (
    b"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGMA"
    b"AQAABQABDQottAAAAABJRU5ErkJggg=="
)

def _tiny_png_file(name="test.png"):
    raw = base64.b64decode(_ONE_PX_PNG_B64)
    return SimpleUploadedFile(name, raw, content_type="image/png")

User = get_user_model()

class ProfileTests(APITestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user("zoe", "zoe@example.com", "passw0rdzz")
        # login to get tokens
        r = self.client.post("/api/token/", {"username": "zoe", "password": "passw0rdzz"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {r.data['access']}")
        prof = getattr(self.user, "profile", None) or getattr(self.user, "userprofile", None)
        if prof is not None:
           prof.avatar = _tiny_png_file()
           prof.save(update_fields=["avatar"])

    def test_me_profile_get(self):
        r = self.client.get("/api/me/profile/")
        self.assertEqual(r.status_code, 200)
        self.assertIn("username", r.data)
        self.assertIn("email", r.data)
        self.assertIn("avatar", r.data)

    def test_me_profile_patch_fields(self):
        r = self.client.patch("/api/me/profile/", {
            "first_name": "Zoe",
            "last_name": "B",
            "email": "zoe+new@example.com",
        }, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["first_name"], "Zoe")
        self.assertEqual(r.data["email"], "zoe+new@example.com")

    def test_me_profile_upload_avatar(self):
        with temp_media():
            small_png = SimpleUploadedFile("a.png", b"\x89PNG\r\n\x1a\n\x00\x00\x00", content_type="image/png")
            r = self.client.patch("/api/me/profile/", {"avatar": small_png}, format="multipart")
            self.assertEqual(r.status_code, 200)
            self.assertTrue(r.data.get("avatar"))