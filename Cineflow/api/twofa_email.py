import random
from django.core.cache import cache
from django.core.mail import EmailMessage, get_connection
from django.conf import settings

CODE_TTL = int(getattr(settings, "EMAIL_2FA_CODE_TTL", 300))   # 5 minutes
RATE_TTL = int(getattr(settings, "EMAIL_2FA_RATE_TTL", 60))    # 60 seconds

def _otp_key(user_id):  return f"2fa:email:otp:{user_id}"
def _rate_key(user_id): return f"2fa:email:rate:{user_id}"

def generate_and_store_code(user, *, force=False):
    """
    Generate a 6-digit code and store it in cache.
    - Short rate-limit using cache.add() so only one sender wins across workers.
    - Overwrites the existing code value (fresh TTL) when allowed.
    Returns the code (string) or None if rate-limited.
    """
    rk = _rate_key(user.id)

    if not force:
        if not cache.add(rk, 1, RATE_TTL):
            return None
    else:
        cache.set(rk, 1, RATE_TTL)

    code = f"{random.randint(0, 999999):06d}"
    cache.set(_otp_key(user.id), code, CODE_TTL)
    return code

def pop_code(user):
    key = _otp_key(user.id)
    code = cache.get(key)
    if code:
        cache.delete(key)
    return code

def send_code_email(user, code):
    subject = "Your Cineflow login code"
    body = (
        f"Hi {user.username},\n\n"
        f"Your Cineflow verification code is: {code}\n\n"
        f"This code expires in {CODE_TTL // 60} minutes.\n"
        "If you didn’t request this, you can ignore this email."
    )
    sender = getattr(settings, "DEFAULT_FROM_EMAIL", "Cineflow <no-reply@cineflow.app>")
    conn = get_connection(timeout=getattr(settings, "EMAIL_TIMEOUT", 10))
    EmailMessage(subject, body, sender, [user.email], connection=conn).send(fail_silently=False)