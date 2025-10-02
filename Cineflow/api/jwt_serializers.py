from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import RefreshToken

try:
    import pyotp
except Exception:
    pyotp = None


def _get_profile(user):
    return getattr(user, "profile", None) or getattr(user, "userprofile", None)


class ActiveUserTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Login serializer (soft email verification).
    - Issues tokens even if email not verified.
    - Frontend can check `email_verified` field in returned payload.
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

        if not user.is_active:
            raise serializers.ValidationError("User account is inactive.")

        prof = _get_profile(user)

        # Handle 2FA if enabled
        if prof is not None and getattr(prof, "two_factor_enabled", False):
            if pyotp is None:
                raise serializers.ValidationError(
                    "Two-factor auth is enabled for this account, but TOTP support is not installed on the server."
                )

            secret = (prof.two_factor_secret or "").strip()
            if not secret:
                raise serializers.ValidationError("Two-factor authentication is misconfigured for this account.")

            if not otp_code:
                raise serializers.ValidationError({"otp": ["OTP code required."]}, code="otp_required")

            totp = pyotp.TOTP(secret)
            if not totp.verify(str(otp_code).strip(), valid_window=1):
                raise serializers.ValidationError({"otp": ["Invalid or expired OTP."]})

        # Normal JWT payload
        refresh = self.get_token(user)
        access = refresh.access_token

        data["refresh"] = str(refresh)
        data["access"] = str(access)
        data["user"] = {
            "id": user.id,
            "username": user.username,
            "email": user.email or "",
            "email_verified": bool(getattr(prof, "email_verified", False)),
            "two_factor_enabled": bool(getattr(prof, "two_factor_enabled", False)),
        }
        return data