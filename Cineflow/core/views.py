from django.http import JsonResponse, HttpResponse

def home(request):
    return HttpResponse("Cineflow Django API is running")

def ping(request):
    return JsonResponse({"status": "ok", "app": "Cineflow"})