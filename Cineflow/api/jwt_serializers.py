from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import RefreshToken
from django.core.exceptions import ValidationError

from .twofa_email import generate_and_store_code, pop_code, send_code_email

def _get_profile(user):
    return getattr(user, "profile", None) or getattr(user, "userprofile", None)

class ActiveUserTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Login serializer with email 2FA:
    - If profile.two_factor_enabled and no otp provided: generate+email code, raise otp_required.
    - If otp provided: verify against cached code, then issue tokens.
    """
    otp = serializers.CharField(required=False, allow_blank=True, write_only=True)

    @classmethod
    def get_token(cls, user):
        token = RefreshToken.for_user(user)
        prof = _get_profile(user)
        token["username"] = user.username
        token["email"] = user.email or ""
        token["email_verified"] = bool(getattr(prof, "email_verified", False))
        token["two_factor_enabled"] = bool(getattr(prof, "two_factor_enabled", False))
        return token

    def validate(self, attrs):
        otp_code = (attrs.pop("otp", None) or "").strip()
        data = super().validate(attrs)         # authenticates username/password - KR 02/10/2025
        user = self.user

        if not user.is_active:
            raise serializers.ValidationError("User account is inactive.")

        prof = _get_profile(user)
        tfa_on = bool(getattr(prof, "two_factor_enabled", False))

        if tfa_on:
            if not otp_code:
                # No code provided → send code then prompt for OTP - KR 02/10/2025
                if not user.email:
                    raise serializers.ValidationError({"otp": ["No email on account to receive a code."]})
                code = generate_and_store_code(user)
                if code is not None:
                    try:
                        send_code_email(user, code)
                    except Exception:
                        pass
                # Tell client to ask for OTP - - KR 02/10/2025
                raise serializers.ValidationError({"otp": ["OTP code required. We've sent a code to your email."]}, code="otp_required")

            # Code provided → verify
            cached = pop_code(user)  # single-use
            if (not cached) or (otp_code != cached):
                raise serializers.ValidationError({"otp": ["Invalid or expired OTP."]})

        # Normal JWT payload - - KR 02/10/2025
        refresh = self.get_token(user)
        access = refresh.access_token

        data["refresh"] = str(refresh)
        data["access"] = str(access)
        data["user"] = {
            "id": user.id,
            "username": user.username,
            "email": user.email or "",
            "email_verified": bool(getattr(prof, "email_verified", False)),
            "two_factor_enabled": bool(tfa_on),
        }
        return data