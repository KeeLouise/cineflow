from django.conf import settings
from django.urls import reverse
from .tokens import make_email_token
from .email_theme import send_html_email, primary_button

def build_verify_url(request, token):
    """
    If FRONTEND_URL is set, point users to the frontend page /verify-email?token=...
    Otherwise, point to the backend endpoint /api/auth/verify/?token=...
    """
    fe = (getattr(settings, "FRONTEND_URL", "") or "").strip()
    if fe:
        return f"{fe.rstrip('/')}/verify-email?token={token}"

    path = reverse("auth_verify_email")  # /api/auth/verify/
    base = f"{request.scheme}://{request.get_host()}"
    return f"{base}{path}?token={token}"

def send_verification_email(user, request):
    token = make_email_token(user)
    url = build_verify_url(request, token)

    subject = "Verify your Cineflow account"
    text_body = (
        f"Hi {user.username},\n\n"
        f"Please verify your Cineflow account by opening this link:\n{url}\n\n"
        "If the button doesn’t work or you didn’t sign up, you can ignore this email."
    )

    inner = f"""
<p>Hi <b>{user.username}</b>,</p>
<p>Please confirm your email address to activate your account.</p>
{primary_button(url, "Verify Email")}
<p style="font-size:13px;color:#6b7280">If the button doesn’t work, copy and paste this link:</p>
<p style="word-break:break-all;font-size:13px;color:#374151">{url}</p>
"""

    send_html_email(subject, text_body, inner, [user.email])
    return token, url