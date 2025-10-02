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

User = get_user_model()

@api_view(["POST"])
@permission_classes([AllowAny])
def register(request):
    """
    POST {username, email, password}
    -> creates INACTIVE user + emails verification link
    """
    ser = RegisterSerializer(data=request.data)
    if not ser.is_valid():
        return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)

    user = ser.save()
    # If email set, send verification link
    if user.email:
        send_verification_email(user, request)

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
    Optionally redirect to FRONTEND_URL with status flag.
    """
    token = request.query_params.get("token", "")
    redirect_ok = request.query_params.get("redirect", "1")  # default redirect
    fe = getattr(settings, "FRONTEND_URL", None)

    if not token:
        return Response({"detail": "Missing token."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        payload = read_email_token(token)  # {'uid':..., 'email':...}
        user = get_object_or_404(User, pk=payload["uid"], email=payload["email"])
    except signing.SignatureExpired:
        if fe and redirect_ok == "1":
            return redirect(f"{fe.rstrip('/')}/verify?ok=0&reason=expired")
        return Response({"detail": "Token expired. Please request a new verification email."}, status=status.HTTP_400_BAD_REQUEST)
    except signing.BadSignature:
        if fe and redirect_ok == "1":
            return redirect(f"{fe.rstrip('/')}/verify?ok=0&reason=invalid")
        return Response({"detail": "Invalid token."}, status=status.HTTP_400_BAD_REQUEST)

    if not user.is_active:
        user.is_active = True
        user.save(update_fields=["is_active"])

    if fe and redirect_ok == "1":
        return redirect(f"{fe.rstrip('/')}/verify?ok=1")

    return Response({"detail": "Email verified. You can now sign in."}, status=status.HTTP_200_OK)

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
            # swallow errors to keep response generic
            pass

    # Generic response either way
    return Response({"detail": "If your account exists and needs verification, an email has been sent."}, status=status.HTTP_200_OK)

import threading

def _send_async(user, request):
    try:
        send_verification_email(user, request)
    except Exception as e:
        print("Async verification failed:", repr(e))

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def resend_verification_authenticated(request):
    user = request.user
    prof = getattr(user, "userprofile", None) or getattr(user, "profile", None)
    if not user.email:
        return Response({"detail":"No email on this account."}, status=400)
    if prof and getattr(prof, "email_verified", False):
        return Response({"detail":"Email already verified."}, status=400)
    threading.Thread(target=_send_async, args=(user, request), daemon=True).start()
    return Response({"detail":"Verification email is on the way."}, status=200)