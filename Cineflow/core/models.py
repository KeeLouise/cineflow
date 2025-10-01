
from __future__ import annotations

from django.conf import settings
from django.db import models
from django.utils import timezone
from django.utils.crypto import get_random_string


class EmailVerification(models.Model):
    """
    One-time email verification token for a user.
    - Create a row when you send a verification link.
    - Mark it as used once the user clicks the link successfully.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="email_verifications",
    )
    token = models.CharField(
        max_length=64,
        unique=True,
        db_index=True,
        help_text="Random URL-safe token embedded in the verify link.",
    )
    sent_to = models.EmailField(
        help_text="Email address this token was sent to (for audit).",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(
        help_text="After this timestamp the token becomes invalid.",
    )
    used_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["user", "expires_at"]),
        ]
        ordering = ["-created_at"]

    def __str__(self) -> str:
        status = "used" if self.used_at else "pending"
        return f"EmailVerification(user={self.user_id}, {status})"

    @property
    def is_used(self) -> bool:
        return bool(self.used_at)

    @property
    def is_expired(self) -> bool:
        return timezone.now() >= self.expires_at

    def mark_used(self) -> None:
        if not self.used_at:
            self.used_at = timezone.now()
            self.save(update_fields=["used_at"])

    @classmethod
    def mint(cls, user, *, email: str | None = None, lifetime_minutes: int = 60) -> "EmailVerification":
        """
        Create and return a fresh verification token for `user`.
        """
        token = get_random_string(48)
        token = token.replace("-", "").replace("_", "")
        if email is None:
            email = getattr(user, "email", "")
        return cls.objects.create(
            user=user,
            token=token,
            sent_to=email or "",
            expires_at=timezone.now() + timezone.timedelta(minutes=lifetime_minutes),
        )


class TwoFactorTOTP(models.Model):
    """
    Minimal TOTP device for optional 2FA.
    Store the shared secret (Base32), confirmation state, and a few scratch codes.
    You should not expose the secret after provisioning. Consider encrypting at rest
    if you have access to a key-management solution.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="totp_devices",
    )
    secret = models.CharField(max_length=64)
    is_confirmed = models.BooleanField(default=False)
    scratch_codes = models.TextField(blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)
    last_used_at = models.DateTimeField(null=True, blank=True)
    disabled_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["user", "is_confirmed"]),
        ]
        ordering = ["-created_at"]
        verbose_name = "TOTP device"
        verbose_name_plural = "TOTP devices"

    def __str__(self) -> str:
        state = "confirmed" if self.is_confirmed else "pending"
        return f"TwoFactorTOTP(user={self.user_id}, {state})"

    @property
    def is_active(self) -> bool:
        return self.disabled_at is None

    def disable(self) -> None:
        if not self.disabled_at:
            self.disabled_at = timezone.now()
            self.save(update_fields=["disabled_at"])

    def touch_used(self) -> None:
        self.last_used_at = timezone.now()
        self.save(update_fields=["last_used_at"])
