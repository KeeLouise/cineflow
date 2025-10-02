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

    with transaction.atomic():
        # Update basic user fields (username/first_name/last_name/email)
        ser = UserProfileMeSerializer(user, data=data, partial=True, context={"request": request})
        ser.is_valid(raise_exception=True)
        ser.save()

        # Update / remove avatar on the profile
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

    out = UserProfileMeSerializer(user, context={"request": request}).data
    return Response(out, status=status.HTTP_200_OK)