from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.exceptions import ValidationError

from ..jwt_serializers import ActiveUserTokenObtainPairSerializer
from ..twofa_email import generate_and_store_code, send_code_email


class ActiveUserTokenObtainPairView(TokenObtainPairView):
    """
    POST /api/token/
    Success: returns access/refresh like normal.
    If user's Email 2FA is enabled and no/invalid OTP was provided:
      - generate (rate-limited) a 6-digit code
      - email it to the user's address
      - return 400 with {"otp": ["<message>"]} so the client shows the OTP input
    """
    serializer_class = ActiveUserTokenObtainPairSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)

        try:
            serializer.is_valid(raise_exception=True)
            # Normal success
            return Response(serializer.validated_data, status=status.HTTP_200_OK)

        except ValidationError as exc:
            detail = exc.detail

            if isinstance(detail, dict) and "otp" in detail:
                # 2FA case: try to send/re-send the code
                user = getattr(serializer, "user", None)
                if user is not None and getattr(user, "email", ""):
                    try:
                        code = generate_and_store_code(user)
                        if code:
                            send_code_email(user, code)
                    except Exception as mail_exc:
                        print("2FA email send failed:", repr(mail_exc))

                # Return the OTP hint so the frontend flips to OTP mode
                return Response({"otp": detail.get("otp")}, status=status.HTTP_400_BAD_REQUEST)
            raise