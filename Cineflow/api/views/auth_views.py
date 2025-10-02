from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404, redirect
from django.core import signing
from django.conf import settings

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from ..serializers import RegisterSerializer
from ..tokens import read_email_token
from ..email_utils import send_verification_email

import threading

User = get_user_model()


# Helpers
def _frontend_base() -> str | None:
    fe = getattr(settings, "FRONTEND_URL", None)
    return fe.rstrip("/") if fe else None


def _redirect_or_json(ok: bool, reason: str | None = None):
    """
    Redirect to frontend /verify-email with flags if FRONTEND_URL exists and redirect=1 (default).
    Otherwise return a JSON Response.
    """
    fe = _frontend_base()
    redirect_ok = True
    if fe and redirect_ok:
        if ok:
            return redirect(f"{fe}/verify-email?ok=1")
        else:
            reason_q = f"&reason={reason}" if reason else ""
            return redirect(f"{fe}/verify-email?ok=0{reason_q}")

    if ok:
        return Response({"detail": "Email verified. You can now sign in."}, status=status.HTTP_200_OK)
    else:
        if reason == "expired":
            return Response({"detail": "Token expired. Please request a new verification email."}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"detail": "Invalid token."}, status=status.HTTP_400_BAD_REQUEST)


# Registration
@api_view(["POST"])
@permission_classes([AllowAny])
def register(request):
    """
    POST {username, email, password}
    -> creates INACTIVE user + emails verification link (if email present)
    """
    ser = RegisterSerializer(data=request.data)
    if not ser.is_valid():
        return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)

    user = ser.save()

    # If email set, send verification link
    if user.email:
        try:
            send_verification_email(user, request)
        except Exception:
            # keep response generic; don't leak SMTP/provider errors
            pass

    # Generic response to avoid leaking user existence rules
    return Response(
        {"detail": "Account created. Please check your email to verify."},
        status=status.HTTP_201_CREATED
    )


@api_view(["GET"])
@permission_classes([AllowAny])
def verify_email(request):
    """
    GET /api/auth/verify/?token=...
    Validates token. On success, activates user and marks profile.email_verified=True (if present).
    Redirects to FRONTEND_URL/verify-email?ok=1 (or ...?ok=0&reason=expired|invalid) when FRONTEND_URL is set,
    unless redirect=0 is passed in the querystring.
    """
    token = request.query_params.get("token", "")
    redirect_param = request.query_params.get("redirect", "1")
    redirect_ok = (redirect_param != "0")
    fe = (getattr(settings, "FRONTEND_URL", None) or "").rstrip("/")

    if not token:
        return Response({"detail": "Missing token."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        payload = read_email_token(token)  # e.g. {'uid': 1, 'email': 'user@example.com'}
        user = get_object_or_404(User, pk=payload["uid"], email=payload["email"])
    except signing.SignatureExpired:
        if fe and redirect_ok:
            return redirect(f"{fe}/verify-email?ok=0&reason=expired")
        return Response(
            {"detail": "Token expired. Please request a new verification email."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    except signing.BadSignature:
        if fe and redirect_ok:
            return redirect(f"{fe}/verify-email?ok=0&reason=invalid")
        return Response({"detail": "Invalid token."}, status=status.HTTP_400_BAD_REQUEST)

    # Activate account if needed
    if not user.is_active:
        user.is_active = True
        user.save(update_fields=["is_active"])

    # Also mark profile.email_verified = True when that field exists
    prof = getattr(user, "userprofile", None) or getattr(user, "profile", None)
    if prof and hasattr(prof, "email_verified") and not getattr(prof, "email_verified", False):
        try:
            prof.email_verified = True
            prof.save(update_fields=["email_verified"])
        except Exception:
            # Non-fatal; verification succeeded for the account regardless
            pass

    if fe and redirect_ok:
        return redirect(f"{fe}/verify-email?ok=1")

    return Response({"detail": "Email verified. You can now sign in."}, status=status.HTTP_200_OK)

# Resend endpoints
@api_view(["POST"])
@permission_classes([AllowAny])
def resend_verification_public(request):
    """
    POST {email}  OR  {username}
    -> Always return 200 (generic) to avoid user enumeration.
    -> If user exists AND inactive AND has email, send verification email.
    """
    email = (request.data.get("email") or "").strip()
    username = (request.data.get("username") or "").strip()

    user = None
    if email:
        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            user = None
    elif username:
        try:
            user = User.objects.get(username__iexact=username)
        except User.DoesNotExist:
            user = None

    if user and not user.is_active and user.email:
        try:
            send_verification_email(user, request)
        except Exception:
            pass

    return Response({"detail": "If your account exists and needs verification, an email has been sent."}, status=status.HTTP_200_OK)


def _send_async(user, request):
    try:
        send_verification_email(user, request)
    except Exception as e:
        # log to stdout so Render logs capture it
        print("Async verification failed:", repr(e))


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def resend_verification_authenticated(request):
    """
    POST (auth required)
    -> Sends verification to the authenticated user's email unless already verified.
    """
    user = request.user
    prof = getattr(user, "userprofile", None) or getattr(user, "profile", None)

    if not user.email:
        return Response({"detail": "No email on this account."}, status=status.HTTP_400_BAD_REQUEST)

    if prof and getattr(prof, "email_verified", False):
        return Response({"detail": "Email already verified."}, status=status.HTTP_400_BAD_REQUEST)

    threading.Thread(target=_send_async, args=(user, request), daemon=True).start()
    return Response({"detail": "Verification email is on the way."}, status=status.HTTP_200_OK)