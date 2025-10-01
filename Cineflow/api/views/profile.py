from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from ..serializers import UserProfileSerializer
from ..models import UserProfile

@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def me_profile(request):
    user = request.user

    UserProfile.objects.get_or_create(user=user)

    if request.method == "GET":
        try:
            data = UserProfileSerializer(user, context={"request": request}).data
            return Response(data, status=status.HTTP_200_OK)
        except Exception as e:
            print("[me_profile GET] serialization error:", repr(e))
            return Response({"detail": "Failed to load profile."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    data = request.data.copy()
    remove_flag = str(data.get("remove_avatar", "")).lower() in ("1", "true", "yes", "on")

    ser = UserProfileSerializer(user, data=data, partial=True, context={"request": request})
    ser.is_valid(raise_exception=True)
    instance = ser.save()

    if remove_flag:
        prof, _ = UserProfile.objects.get_or_create(user=instance)
        try:
            if prof.avatar:
                prof.avatar.delete(save=False)
        except Exception:
            pass
        prof.avatar = None
        prof.save(update_fields=["avatar", "updated_at"])

    return Response(UserProfileSerializer(instance, context={"request": request}).data, status=status.HTTP_200_OK)