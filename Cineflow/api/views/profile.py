# views/profile.py (or wherever you put it)
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import JSONParser, MultiPartParser, FormParser
from rest_framework.response import Response
from rest_framework import status
from ..serializers import UserProfileSerializer

@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def me_profile(request):
    user = request.user

    if request.method == "GET":
        ser = UserProfileSerializer(user, context={"request": request})
        return Response(ser.data)

    # PATCH
    ser = UserProfileSerializer(
        user,
        data=request.data,
        partial=True,
        context={"request": request}
    )
    ser.is_valid(raise_exception=True)
    ser.save()
    return Response(ser.data, status=status.HTTP_200_OK)