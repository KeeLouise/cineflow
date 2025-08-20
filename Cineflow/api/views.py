from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from .serializers import RegisterSerializer

@api_view(["POST"])
@permission_classes([AllowAny])  # Anyone can sign up - KR 20/08/2025
def register(request):
    serializer = RegisterSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save()
        return Response({"message": "User created successfully!"}, status=status.HTTP_201_CREATED)
    # DRF will include per-field errors like {"username": ["This field must be unique."]} - KR 20/08/2025
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)