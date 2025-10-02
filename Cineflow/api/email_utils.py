from django.conf import settings
from django.core.mail import EmailMessage, get_connection
from django.urls import reverse
from .tokens import make_email_token

def build_verify_url(request, token):
    path = reverse("auth_verify_email")
    base = f"{request.scheme}://{request.get_host()}"
    return f"{base}{path}?token={token}"

def send_verification_email(user, request):
    token = make_email_token(user)
    url = build_verify_url(request, token)

    subject = "Verify your Cineflow email"
    sender = getattr(settings, "DEFAULT_FROM_EMAIL", "Cineflow <no-reply@cineflow.app>")
    body = (
        f"Hi {user.username},\n\n"
        "Welcome to Cineflow! Please confirm your email to activate your account:\n\n"
        f"{url}\n\n"
        "If you didn’t sign up, you can ignore this message.\n"
    )

    conn = get_connection(timeout=getattr(settings, "EMAIL_TIMEOUT", 10))
    EmailMessage(subject, body, sender, [user.email], connection=conn).send(fail_silently=False)
    return token, url