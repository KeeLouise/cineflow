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
    """
    GET    -> return current user's profile (ensures row exists)
    PATCH  -> update first_name/last_name (on User) and avatar (on profile)
              send remove_avatar=true to clear image
    """
    user = request.user
    profile, _ = UserProfile.objects.get_or_create(user=user)

    if request.method == "GET":
        data = UserProfileSerializer(profile, context={"request": request}).data
        return Response(data, status=200)

    data = request.data.copy()
    remove_flag = str(data.get("remove_avatar", "")).lower() in ("1", "true", "yes", "on")

    ser = UserProfileSerializer(profile, data=data, partial=True, context={"request": request})
    ser.is_valid(raise_exception=True)
    instance = ser.save()

    if remove_flag:
        if instance.avatar:
            try:
                instance.avatar.delete(save=False)
            except Exception:
                pass
        instance.avatar = None
        instance.save(update_fields=["avatar", "updated_at"])

    return Response(UserProfileSerializer(instance, context={"request": request}).data, status=200)