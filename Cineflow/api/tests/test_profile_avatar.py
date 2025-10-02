import io
from PIL import Image
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient
import pytest

def _png_bytes():
    im = Image.new("RGB", (8, 8), color=(200, 50, 50))
    buf = io.BytesIO()
    im.save(buf, format="PNG")
    return buf.getvalue()

@pytest.mark.django_db
def test_avatar_upload_and_remove(django_user_model):
    user = django_user_model.objects.create_user("cathy", "c@example.com", "passpass")
    client = APIClient()
    # Authenticate - KR
    from rest_framework_simplejwt.tokens import RefreshToken
    token = RefreshToken.for_user(user).access_token
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {str(token)}")

    # Upload - KR
    png = SimpleUploadedFile("avatar.png", _png_bytes(), content_type="image/png")
    r = client.patch("/api/me/profile/", {"avatar": png}, format="multipart")
    assert r.status_code == 200
    url = r.json().get("avatar")
    assert url and (url.startswith("http://") or url.startswith("https://") or url.startswith("/"))

    # Remove - KR
    r2 = client.patch("/api/me/profile/", {"remove_avatar": "1"}, format="multipart")
    assert r2.status_code == 200
    assert r2.json().get("avatar") in (None, "",)