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

    if request.method == "GET":
        return Response(UserProfileSerializer(user).data, status=200)

    data = request.data.copy()
    remove_flag = str(data.get("remove_avatar", "")).lower() in ("1", "true", "yes", "on")

    ser = UserProfileSerializer(user, data=data, partial=True)
    ser.is_valid(raise_exception=True)
    instance = ser.save()

    if remove_flag:
        prof, _ = UserProfile.objects.get_or_create(user=instance)
        if prof.avatar:
            prof.avatar.delete(save=False)
        prof.avatar = None
        prof.save(update_fields=["avatar", "updated_at"])

    return Response(UserProfileSerializer(instance).data, status=200)