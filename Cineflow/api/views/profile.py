from django.db import transaction
from django.contrib.auth import get_user_model
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..serializers import UserProfileMeSerializer
from ..models import UserProfile
from ..email_utils import send_verification_email

UserModel = get_user_model()

@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def me_profile(request):
    user = request.user
    prof, _ = UserProfile.objects.get_or_create(user=user)

    if request.method == "GET":
        ser = UserProfileMeSerializer(user, context={"request": request})
        return Response(ser.data, status=200)

    # PATCH
    data = request.data.copy()
    remove_flag = str(data.get("remove_avatar", "")).lower() in ("1", "true", "yes", "on")
    avatar_file = request.FILES.get("avatar") if "avatar" in request.FILES else None

    old_email = (user.email or "").strip()

    with transaction.atomic():
        ser = UserProfileMeSerializer(user, data=data, partial=True, context={"request": request})
        ser.is_valid(raise_exception=True)
        ser.save()

        # If avatar changes
        if remove_flag:
            if prof.avatar:
                try:
                    prof.avatar.delete(save=False)
                except Exception:
                    pass
            prof.avatar = None
            prof.save(update_fields=["avatar", "updated_at"])
        elif avatar_file is not None:
            prof.avatar = avatar_file
            prof.save(update_fields=["avatar", "updated_at"])

        new_email = (user.email or "").strip()
        if new_email and new_email.lower() != old_email.lower():
            if hasattr(prof, "email_verified") and prof.email_verified:
                prof.email_verified = False
                prof.save(update_fields=["email_verified"])
            try:
                send_verification_email(user, request)
            except Exception as e:
                # log but don't fail the request
                print("Auto resend verify email failed:", repr(e))

    out = UserProfileMeSerializer(user, context={"request": request}).data
    return Response(out, status=200)