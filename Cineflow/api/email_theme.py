from django.core.mail import EmailMultiAlternatives, get_connection
from django.conf import settings
from datetime import datetime

BRAND_NAME = getattr(settings, "SITE_NAME", "Cineflow")
BRAND_COLOR = "#3b82f6"   
TEXT_COLOR = "#111827"    
MUTED = "#6b7280"        
CARD_BG = "#f9fafb"       
BORDER = "#e5e7eb"        

def wrap_html(title: str, inner_html: str) -> str:
    year = datetime.utcnow().year
    return f"""
<div style="font-family:Arial,Segoe UI,Helvetica,sans-serif;max-width:640px;margin:auto;padding:24px;background:{CARD_BG};border:1px solid {BORDER};border-radius:10px;">
  <div style="text-align:center;margin-bottom:16px;">
    <div style="font-size:22px;font-weight:700;color:{BRAND_COLOR};letter-spacing:.3px">{BRAND_NAME}</div>
  </div>
  <h2 style="margin:0 0 12px;color:{TEXT_COLOR};font-size:20px;line-height:1.4">{title}</h2>
  <div style="color:{TEXT_COLOR};font-size:15px;line-height:1.6">{inner_html}</div>
  <hr style="border:none;border-top:1px solid {BORDER};margin:24px 0" />
  <p style="font-size:12px;color:{MUTED};margin:0">
    © {year} {BRAND_NAME}. If you didn’t request this, you can ignore this email.
  </p>
</div>
""".strip()

def primary_button(href: str, label: str) -> str:
    return f"""
<p style="text-align:center;margin:24px 0">
  <a href="{href}" style="background:{BRAND_COLOR};color:#fff;text-decoration:none;padding:12px 22px;border-radius:6px;display:inline-block;font-weight:600">
    {label}
  </a>
</p>
""".strip()

def code_block(code: str) -> str:
    return f"""
<div style="text-align:center;margin:18px 0">
  <div style="display:inline-block;background:#fff;color:{TEXT_COLOR};border:1px dashed {BRAND_COLOR};padding:14px 22px;border-radius:8px;font-size:28px;letter-spacing:6px;font-weight:700">
    {code}
  </div>
</div>
""".strip()

def send_html_email(subject: str, text_body: str, html_inner: str, to: list[str]):
    sender = getattr(settings, "DEFAULT_FROM_EMAIL", f"{BRAND_NAME} <no-reply@{BRAND_NAME.lower()}.app>")
    conn = get_connection(timeout=getattr(settings, "EMAIL_TIMEOUT", 10))
    html_body = wrap_html(subject, html_inner)
    msg = EmailMultiAlternatives(subject, text_body, sender, to, connection=conn)
    msg.attach_alternative(html_body, "text/html")
    msg.send(fail_silently=False)