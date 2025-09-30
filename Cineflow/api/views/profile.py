from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..serializers import UserProfileSerializer
from ..models import UserProfile


@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def me_profile(request):
    user = request.user
    profile, _ = UserProfile.objects.get_or_create(user=user)

    if request.method == "GET":
        return Response(UserProfileSerializer(profile).data, status=200)

    data = request.data.copy()
    remove_flag = str(data.get("remove_avatar", "")).lower() in ("1", "true", "yes", "on")

    ser = UserProfileSerializer(profile, data=data, partial=True)
    ser.is_valid(raise_exception=True)
    instance = ser.save()

    if remove_flag:
        if instance.avatar:
            instance.avatar.delete(save=False)
        instance.avatar = None
        instance.save(update_fields=["avatar", "updated_at"])

    return Response(UserProfileSerializer(instance).data, status=200)