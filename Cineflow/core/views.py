from django.http import JsonResponse, HttpResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def secure_view(request):
    return Response({"message": "You are authenticated!", "user": request.user.username})

def home(request):
    return HttpResponse("Cineflow Django API is running")

def ping(request):
    return JsonResponse({"status": "ok", "app": "Cineflow"})