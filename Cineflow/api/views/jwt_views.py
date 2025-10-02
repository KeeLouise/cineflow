from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.exceptions import ValidationError

from ..jwt_serializers import ActiveUserTokenObtainPairSerializer

class ActiveUserTokenObtainPairView(TokenObtainPairView):
    serializer_class = ActiveUserTokenObtainPairSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        try:
            serializer.is_valid(raise_exception=True)
            return Response(serializer.validated_data, status=status.HTTP_200_OK)
        except ValidationError as exc:
            detail = exc.detail
            if isinstance(detail, dict) and "otp" in detail:
                return Response({"otp": detail.get("otp")}, status=status.HTTP_400_BAD_REQUEST)
            raise