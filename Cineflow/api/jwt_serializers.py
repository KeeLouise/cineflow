from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import RefreshToken

from .twofa_email import generate_and_store_code, pop_code, send_code_email


def _get_profile(user):
    return getattr(user, "profile", None) or getattr(user, "userprofile", None)


class ActiveUserTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Email-based 2FA flow:

    - If profile.two_factor_enabled is True and no 'otp' provided:
        * Credentials are correct (super().validate passes)
        * Generate+email a code (rate-limited)
        * Raise ValidationError({"otp": ["..."]}) so frontend prompts for OTP

    - If 'otp' provided:
        * Verify against cached code (single-use)
        * On success, return tokens + user payload

    - If 2FA disabled:
        * Return tokens + user payload normally
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
        # Grab and remove OTP from attrs before base validation
        otp_code = attrs.pop("otp", None)

        # Validate username/password (sets self.user). Returns {"refresh","access"} by default
        data = super().validate(attrs)
        user = self.user
        prof = _get_profile(user)
        twofa_on = bool(getattr(prof, "two_factor_enabled", False))

        if twofa_on:
            # No OTP provided -> send
            if not otp_code:
                code = generate_and_store_code(user)
                if code:
                    try:
                        send_code_email(user, code)
                    except Exception:
                        
                        pass
                raise serializers.ValidationError(
                    {"otp": ["We’ve sent a 6-digit code to your email. Please enter it."]}
                )

            # OTP provided -> verify (single-use)
            expected = pop_code(user)
            if not expected:
                raise serializers.ValidationError({"otp": ["Code expired. Request a new one."]})
            if str(otp_code).strip() != str(expected):
                raise serializers.ValidationError({"otp": ["Invalid code."]})

        # Attach consistent user payload for frontend
        data["user"] = {
            "id": user.id,
            "username": user.username,
            "email": user.email or "",
            "email_verified": bool(getattr(prof, "email_verified", False)) if prof else False,
            "two_factor_enabled": twofa_on,
        }
        return data