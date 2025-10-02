from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

def _get_profile(user):
    return getattr(user, "profile", None) or getattr(user, "userprofile", None)

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def email2fa_enable(request):
    prof = _get_profile(request.user)
    if not prof: return Response({"detail":"Profile not found."}, status=400)
    if not request.user.email:
        return Response({"detail":"Add an email to enable 2FA."}, status=400)
    if prof.two_factor_enabled:
        return Response({"detail":"2FA already enabled."}, status=200)
    prof.two_factor_enabled = True
    prof.save(update_fields=["two_factor_enabled"])
    return Response({"detail":"Email 2FA enabled."}, status=200)

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def email2fa_disable(request):
    prof = _get_profile(request.user)
    if not prof: return Response({"detail":"Profile not found."}, status=400)
    if not prof.two_factor_enabled:
        return Response({"detail":"2FA already disabled."}, status=200)
    prof.two_factor_enabled = False
    prof.save(update_fields=["two_factor_enabled"])
    return Response({"detail":"Email 2FA disabled."}, status=200)