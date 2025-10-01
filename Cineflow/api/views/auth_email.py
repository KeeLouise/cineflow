from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.conf import settings
from django.urls import reverse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def resend_email_verification(request):
    user = request.user
    prof = getattr(user, "userprofile", None)
    if prof and getattr(prof, "email_verified", False):
        return Response({"detail": "Email already verified."}, status=400)

    token = default_token_generator.make_token(user)
    path = reverse("verify-email") 
    verify_url = f"{request.scheme}://{request.get_host()}{path}?uid={user.pk}&token={token}"

    subject = f"Verify your email for {getattr(settings, 'SITE_NAME', 'Cineflow')}"
    body = f"Hi {user.username},\n\nVerify your email:\n{verify_url}\n"
    send_mail(subject, body, settings.DEFAULT_FROM_EMAIL, [user.email], fail_silently=False)
    return Response({"sent": True})