from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db import transaction

from django.contrib.auth.models import User
from ..serializers import UserProfileMeSerializer
from ..models import UserProfile

@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def me_profile(request):
    user: User = request.user
    # Ensure a profile row exists
    prof, _ = UserProfile.objects.get_or_create(user=user)

    if request.method == "GET":
        ser = UserProfileMeSerializer(user, context={"request": request})
        return Response(ser.data, status=200)

    # PATCH:
    data = request.data.copy()
    remove_flag = str(data.get("remove_avatar", "")).lower() in ("1", "true", "yes", "on")
    avatar_file = request.FILES.get("avatar", None) if "avatar" in request.FILES or "avatar" in data else None

    with transaction.atomic():
        # Update user fields
        ser = UserProfileMeSerializer(user, data=data, partial=True, context={"request": request})
        ser.is_valid(raise_exception=True)
        ser.save()

        # Update avatar on profile
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
    return Response(out, status=200)