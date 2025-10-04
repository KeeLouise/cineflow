from django.db import transaction
from django.contrib.auth import get_user_model
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from ..serializers import UserProfileMeSerializer
from ..models import UserProfile

UserModel = get_user_model()

MAX_AVATAR_BYTES = 5 * 1024 * 1024 
ALLOWED_IMAGE_CT = {"image/jpeg", "image/png", "image/webp", "image/gif"}

@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def me_profile(request):
    user = request.user

    prof, _ = UserProfile.objects.get_or_create(user=user)

    if request.method == "GET":
        ser = UserProfileMeSerializer(user, context={"request": request})
        return Response(ser.data, status=status.HTTP_200_OK)

    # PATCH
    data = request.data.copy()
    remove_flag = str(data.get("remove_avatar", "")).lower() in ("1", "true", "yes", "on")
    avatar_file = request.FILES.get("avatar") if "avatar" in request.FILES else None

    if avatar_file is not None:
        size = getattr(avatar_file, "size", 0) or 0
        ct = (getattr(avatar_file, "content_type", "") or "").lower()
        if MAX_AVATAR_BYTES and size > MAX_AVATAR_BYTES:
            return Response(
                {"detail": f"Avatar is too large (max {MAX_AVATAR_BYTES // (1024*1024)}MB)."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if ALLOWED_IMAGE_CT and ct and ct not in ALLOWED_IMAGE_CT:
            return Response(
                {"detail": "Unsupported image type. Use JPG, PNG, WEBP or GIF."},
                status=status.HTTP_400_BAD_REQUEST,
            )

    try:
        with transaction.atomic():
            ser = UserProfileMeSerializer(user, data=data, partial=True, context={"request": request})
            ser.is_valid(raise_exception=True)
            ser.save()

            if remove_flag:
                try:
                    if prof.avatar:
                        prof.avatar.delete(save=False)
                    prof.avatar = None
                    prof.save(update_fields=["avatar", "updated_at"])
                except Exception as e:
                    return Response(
                        {"detail": f"Avatar removal failed: {e}"},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
            elif avatar_file is not None:
                try:
                    prof.avatar = avatar_file
                    prof.save(update_fields=["avatar", "updated_at"])
                except Exception as e:
                    return Response(
                        {"detail": f"Avatar upload failed: {e}"},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

    except Exception as e:
        return Response(
            {"detail": str(getattr(e, "detail", e))},
            status=status.HTTP_400_BAD_REQUEST,
        )

    out = UserProfileMeSerializer(user, context={"request": request}).data
    return Response(out, status=status.HTTP_200_OK)