from rest_framework.views import exception_handler as drf_handler

def api_exception_handler(exc, context):
    resp = drf_handler(exc, context)
    if resp is None:
        return resp
    detail = resp.data.get("detail") if isinstance(resp.data, dict) else None
    resp.data = {
        "ok": False,
        "status_code": resp.status_code,
        "detail": detail or "Request failed.",
    }
    return resp