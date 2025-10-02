# api/twofa_email.py
import random
from django.core.cache import cache
from django.conf import settings
from .email_theme import send_html_email, code_block

CODE_TTL = int(getattr(settings, "EMAIL_2FA_CODE_TTL", 300))   
RATE_TTL = int(getattr(settings, "EMAIL_2FA_RATE_TTL", 60))   

def _otp_key(user_id):  return f"2fa:email:otp:{user_id}"
def _rate_key(user_id): return f"2fa:email:rate:{user_id}"

def has_active_code(user):
    return cache.get(_otp_key(user.id)) is not None

def generate_and_store_code(user, *, force=False):
    """
    Generate a 6-digit code and store it in cache.
    Rate-limited with cache.add so only one sender wins across workers.
    Overwrites the code value (fresh TTL) when allowed.
    Returns the code (str) or None if rate-limited.
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
    """Get & invalidate the code (single use)."""
    key = _otp_key(user.id)
    code = cache.get(key)
    if code:
        cache.delete(key)
    return code

def send_code_email(user, code):
    ttl_minutes = max(CODE_TTL // 60, 1)
    subject = "Your Cineflow login code"

    text_body = (
        f"Hi {user.username},\n\n"
        f"Your Cineflow verification code is: {code}\n\n"
        f"This code expires in {ttl_minutes} minutes.\n"
        "If you didn’t request this, you can ignore this email."
    )

    inner = f"""
<p>Hi <b>{user.username}</b>,</p>
<p>Use the code below to finish signing in:</p>
{code_block(code)}
<p>This code expires in <b>{ttl_minutes} minutes</b>.</p>
"""

    send_html_email(subject, text_body, inner, [user.email])