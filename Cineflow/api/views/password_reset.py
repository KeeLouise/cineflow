from django.contrib.auth import get_user_model
from django.core import signing
from django.core.cache import cache
from django.utils.crypto import get_random_string
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from django.conf import settings

from ..tokens import read_password_reset_token
from ..email_utils import send_password_reset_email

User = get_user_model()

def _rate_key(email): return f"pwreset:rate:{(email or '').strip().lower()}"

@api_view(["POST"])
@permission_classes([AllowAny])
def password_reset_request(request):
    """
    POST {email}
    Always returns 200 (no user enumeration).
    Sends reset email if user with that email exists and rate limit passes.
    """
    email = (request.data.get("email") or "").strip()
    if not email:

        return Response({"detail": "If the address exists, we’ve emailed reset instructions."}, status=200)

    rk = _rate_key(email)
    if cache.get(rk):
        return Response({"detail": "If the address exists, we’ve emailed reset instructions."}, status=200)

    try:
        user = User.objects.get(email__iexact=email)
    except User.DoesNotExist:
        # generic response
        cache.set(rk, 1, 60)
        return Response({"detail": "If the address exists, we’ve emailed reset instructions."}, status=200)

    try:
        send_password_reset_email(user, request)
    except Exception as e:
    
        pass
    cache.set(rk, 1, 60)
    return Response({"detail": "If the address exists, we’ve emailed reset instructions."}, status=200)

@api_view(["POST"])
@permission_classes([AllowAny])
def password_reset_confirm(request):
    """
    POST {token, password, password2}
    Validates token and sets new password.
    """
    token = (request.data.get("token") or "").strip()
    pw1 = request.data.get("password") or ""
    pw2 = request.data.get("password2") or ""

    if not token:
        return Response({"detail": "Missing token."}, status=400)
    if not pw1 or not pw2:
        return Response({"detail": "Missing password fields."}, status=400)
    if pw1 != pw2:
        return Response({"password2": ["Passwords do not match."]}, status=400)
    if len(pw1) < 8:
        return Response({"password": ["Password must be at least 8 characters."]}, status=400)

    try:
        payload = read_password_reset_token(token)  # {uid, email}
    except signing.SignatureExpired:
        return Response({"detail": "Reset link expired. Request a new one."}, status=400)
    except signing.BadSignature:
        return Response({"detail": "Invalid reset link."}, status=400)

    try:
        user = User.objects.get(pk=payload["uid"], email__iexact=payload["email"])
    except User.DoesNotExist:
        return Response({"detail": "Invalid reset link."}, status=400)

    # set new password
    user.set_password(pw1)
    user.save(update_fields=["password"])

    return Response({"detail": "Password has been reset. You can now sign in."}, status=200)