from django.conf import settings
from django.urls import reverse
from .tokens import make_email_token
from .email_theme import send_html_email, primary_button
from django.core.mail import EmailMultiAlternatives, get_connection
from django.utils.html import strip_tags
from .tokens import make_password_reset_token

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


def build_password_reset_url(request, token):
    fe = (getattr(settings, "FRONTEND_URL", "") or "").rstrip("/")
    return f"{fe}/reset-password?token={token}"

def send_password_reset_email(user, request):
    token = make_password_reset_token(user)
    url = build_password_reset_url(request, token)
    subject = "Reset your Cineflow password"
    sender = getattr(settings, "DEFAULT_FROM_EMAIL", "Cineflow <no-reply@cineflow.app>")

    html = f"""
    <div style="background:#0b0e13;padding:24px;font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
      <div style="max-width:560px;margin:0 auto;background:#0f1420;border:1px solid #1e2433;border-radius:12px;overflow:hidden">
        <div style="padding:20px 24px;border-bottom:1px solid #1e2433">
          <div style="color:#9fb7ff;font-weight:700;letter-spacing:.4px">CINEFLOW</div>
        </div>
        <div style="padding:24px">
          <h2 style="color:#e2e8f0;margin:0 0 8px">Reset your password</h2>
          <p style="color:#94a3b8;margin:0 0 16px">Click the button below to choose a new password. This link expires in {int(getattr(settings,'PASSWORD_RESET_TOKEN_TTL',1800))//60} minutes.</p>
          <p style="text-align:center;margin:24px 0">
            <a href="{url}" style="display:inline-block;background:#7c5cff;color:white;text-decoration:none;border-radius:10px;padding:12px 18px;font-weight:600">Choose new password</a>
          </p>
          <p style="color:#64748b;margin:0">If you didn’t request this, you can ignore this email.</p>
        </div>
        <div style="padding:16px 24px;border-top:1px solid #1e2433;color:#475569;font-size:12px;text-align:center">
          © {getattr(settings,'SITE_NAME','Cineflow')}
        </div>
      </div>
    </div>
    """
    text = strip_tags(html)
    conn = get_connection(timeout=getattr(settings, "EMAIL_TIMEOUT", 10))
    msg = EmailMultiAlternatives(subject, text, sender, [user.email], connection=conn)
    msg.attach_alternative(html, "text/html")
    msg.send(fail_silently=False)
    return token, url