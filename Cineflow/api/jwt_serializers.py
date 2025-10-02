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
    otp_code = attrs.pop("otp", None)
    data = super().validate(attrs)
    user = self.user
    prof = _get_profile(user)

    if prof and getattr(prof, "two_factor_enabled", False):
        # if no code provided → send new OTP + raise ValidationError
        if not otp_code:
            code = generate_and_store_code(user)
            if code:
                try:
                    send_code_email(user, code)
                except Exception:
                    pass
            raise serializers.ValidationError(
                {"otp": ["We’ve sent a code to your email. Please enter it."]}
            )

        # if code provided → verify
        expected = pop_code(user)
        if not expected:
            raise serializers.ValidationError({"otp": ["Code expired. Request a new one."]})
        if str(otp_code).strip() != str(expected):
            raise serializers.ValidationError({"otp": ["Invalid code."]})

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