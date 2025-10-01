from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import RefreshToken

try:
    import pyotp
except Exception:
    pyotp = None


def _get_profile(user):
    return getattr(user, "profile", None)


class ActiveUserTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Login serializer
    """
    otp = serializers.CharField(required=False, allow_blank=True, write_only=True)

    @classmethod
    def get_token(cls, user):
        """
        Customize JWT claims if you want – helpful on the frontend.
        """
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
        if prof is not None and not getattr(prof, "email_verified", False):
            raise serializers.ValidationError("Please verify your email before logging in.")

        if prof is not None and getattr(prof, "two_factor_enabled", False):

            if pyotp is None:
                raise serializers.ValidationError(
                    "Two-factor auth is enabled for this account, but TOTP support is not installed on the server."
                )

            secret = (prof.two_factor_secret or "").strip()
            if not secret:
                # 2FA enabled but no secret seeded
                raise serializers.ValidationError("Two-factor authentication is misconfigured for this account.")

            if not otp_code:
                # Signal to the client that OTP is required
                raise serializers.ValidationError({"otp": ["OTP code required."]}, code="otp_required")

            totp = pyotp.TOTP(secret)
            if not totp.verify(str(otp_code).strip(), valid_window=1):
                raise serializers.ValidationError({"otp": ["Invalid or expired OTP."]})

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