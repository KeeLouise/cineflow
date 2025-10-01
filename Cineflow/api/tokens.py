from django.core import signing

MAX_AGE = 60 * 60 * 24 * 3

def make_email_token(user):
    payload = {"uid": user.pk, "email": user.email}
    return signing.TimestampSigner().sign_object(payload)

def read_email_token(token, max_age=MAX_AGE):
    return signing.TimestampSigner().unsign_object(token, max_age=max_age)