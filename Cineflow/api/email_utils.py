from django.conf import settings
from django.core.mail import send_mail
from django.urls import reverse
from .tokens import make_email_token

def build_verify_url(request, token):
    
    fe = getattr(settings, "FRONTEND_URL", "") or ""
    if fe:
        fe = fe.rstrip("/")
        return f"{fe}/verify-email?token={token}"
    
    path = reverse("auth-verify-email")
    base = f"{request.scheme}://{request.get_host()}"
    return f"{base}{path}?token={token}"

def send_verification_email(user, request):
    token = make_email_token(user)
    url = build_verify_url(request, token)
    subject = "Verify your Cineflow email"
    sender = getattr(settings, "DEFAULT_FROM_EMAIL", "no-reply@cineflow")
    msg = (
        f"Hi {user.username},\n\n"
        "Welcome to Cineflow! Please confirm your email to activate your account:\n\n"
        f"{url}\n\n"
        "If you didn’t sign up, you can ignore this message.\n"
    )
    send_mail(subject, msg, sender, [user.email], fail_silently=False)
    return token, url