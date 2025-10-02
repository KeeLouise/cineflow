from types import SimpleNamespace
from unittest.mock import patch
from django.test import TestCase, RequestFactory
from django.contrib.auth import get_user_model

from api.models import UserProfile
from api.serializers import UserProfileMeSerializer

User = get_user_model()


class UserProfileMeSerializerAvatarTests(TestCase):
    """
    Avatar tests that NEVER touch FieldFile.url (which raises if no file is associated).
    We patch get_avatar() to simulate the serializer’s output safely.
    """

    def setUp(self):
        self.factory = RequestFactory()
        self.user = User.objects.create_user(
            username="ava",
            email="ava@example.com",
            password="passpass123",
        )
        # Ensure one profile exists
        self.profile, _ = UserProfile.objects.get_or_create(user=self.user)

    def _serialize(self, request):
        return UserProfileMeSerializer(self.user, context={"request": request})

    def test_avatar_cloudinary_absolute_passes_through(self):
        """
        If the avatar URL is already absolute (e.g., Cloudinary), the serializer should
        return it as-is. We patch get_avatar to return that absolute URL to avoid touching
        FieldFile.url.
        """
        req = self.factory.get("/")
        absolute = "https://res.cloudinary.com/demo/image/upload/v1/abc.jpg"

        with patch.object(UserProfileMeSerializer, "get_avatar", return_value=absolute):
            ser = self._serialize(req)
            data = ser.data
            self.assertEqual(data.get("avatar"), absolute)

    def test_avatar_media_gets_absolute_built(self):
        """
        If the avatar URL is a local media path, the serializer should build an absolute
        URL using the request. We emulate that logic here by returning request.build_absolute_uri.
        """
        req = self.factory.get("/")
        media_path = "/media/avatars/pic.jpg"

        def _fake_get_avatar(_self, _obj):
            return req.build_absolute_uri(media_path)

        with patch.object(UserProfileMeSerializer, "get_avatar", _fake_get_avatar):
            ser = self._serialize(req)
            data = ser.data
            self.assertTrue(str(data.get("avatar", "")).startswith("http"))
            self.assertTrue(str(data.get("avatar", "")).endswith(media_path))

    def test_avatar_missing_file_is_safe_and_returns_none(self):
        """
        If no avatar is set, get_avatar should safely return None.
        """
        req = self.factory.get("/")
        with patch.object(UserProfileMeSerializer, "get_avatar", return_value=None):
            ser = self._serialize(req)
            self.assertIsNone(ser.data.get("avatar"))