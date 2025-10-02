import io
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings, TestCase
from rest_framework.test import APIClient
from tempfile import TemporaryDirectory
from unittest.mock import patch
from api.models import UserProfile

User = get_user_model()

@override_settings(DEFAULT_FILE_STORAGE="django.core.files.storage.FileSystemStorage")
class ProfileAvatarFlowTests(TestCase):
    def setUp(self):
        self.tmp = TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        # per-test media root
        self.override = override_settings(MEDIA_ROOT=self.tmp.name)
        self.override.enable()
        self.addCleanup(self.override.disable)

        self.u = User.objects.create_user("ava", email="a@ex.com", password="pass")
        UserProfile.objects.get_or_create(user=self.u)
        self.client = APIClient()
        self.client.force_authenticate(self.u)

    def _fake_image(self, name="a.jpg"):
        return SimpleUploadedFile(name, b"\x47\x38\x39\x61fake", content_type="image/jpeg")

    def test_upload_avatar(self):
        img = self._fake_image()
        with patch("api.serializers.UserProfileMeSerializer.get_avatar", return_value="http://testserver/media/a.jpg"):
            r = self.client.patch("/api/me/profile/", {"avatar": img}, format="multipart")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertTrue("avatar" in r.data)

    def test_remove_avatar_without_existing(self):
        prof = UserProfile.objects.get(user=self.u)
        prof.avatar = None
        prof.save(update_fields=["avatar"])

        with patch("api.serializers.UserProfileMeSerializer.get_avatar", return_value=None):
            r = self.client.patch("/api/me/profile/", {"remove_avatar": "true"}, format="multipart")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertFalse(r.data.get("avatar"))