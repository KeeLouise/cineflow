"""
Django settings for cineflow project.
"""
from pathlib import Path
import os
import dj_database_url

BASE_DIR = Path(__file__).resolve().parent.parent

# --- Core ---
DEBUG = os.getenv("DEBUG", "False").lower() == "true"
SECRET_KEY = os.getenv("SECRET_KEY", "unsafe-dev-key")

ALLOWED_HOSTS = [
    "localhost",
    "127.0.0.1",
    ".onrender.com",
    os.getenv("APP_DOMAIN", ""),
]

# App constants / external APIs
TMDB_API_KEY = os.getenv("TMDB_API_KEY")
SITE_NAME = "Cineflow"

# Single, canonical FRONTEND_URL (used for email links, CORS/CSRF below)
FRONTEND_URL = os.getenv("FRONTEND_URL")

#  CORS / CSRF
CSRF_TRUSTED_ORIGINS = [
    "http://localhost:5173",
    "https://*.onrender.com",
] + ([FRONTEND_URL] if FRONTEND_URL else [])

CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
] + ([FRONTEND_URL] if FRONTEND_URL else [])

# --- Apps ---
INSTALLED_APPS = [
    # Django
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",

    "api",
    "core",

    "rest_framework",
    "rest_framework_simplejwt",
    "corsheaders",
    "anymail",
]

# --- Middleware ---
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware", 
    "django.contrib.sessions.middleware.SessionMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "cineflow.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "cineflow.wsgi.application"

# --- Database ---
DATABASES = {
    "default": dj_database_url.config(
        env="DATABASE_URL",
        default=f"sqlite:///{BASE_DIR / 'db.sqlite3'}",
        conn_max_age=600,
    )
}

# --- DRF / JWT ---
SIMPLE_JWT = {
    "AUTH_HEADER_TYPES": ("Bearer",),
}
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.AllowAny",
    ),
    "DEFAULT_PARSER_CLASSES": [
        "rest_framework.parsers.JSONParser",
        "rest_framework.parsers.FormParser",
        "rest_framework.parsers.MultiPartParser",
    ],
}

# --- Email (SendGrid via Anymail) ---
DEFAULT_FROM_EMAIL = os.getenv("DEFAULT_FROM_EMAIL", "no.reply.cineflow@outlook.com")
SERVER_EMAIL = DEFAULT_FROM_EMAIL
EMAIL_TIMEOUT = int(os.getenv("EMAIL_TIMEOUT", "10"))

EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
EMAIL_HOST = "smtp.sendgrid.net"
EMAIL_PORT = 587
EMAIL_USE_TLS = True
EMAIL_HOST_USER = "apikey"
EMAIL_HOST_PASSWORD = os.getenv("SENDGRID_API_KEY", "")

if not EMAIL_HOST_PASSWORD:
    EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"

# 2FA / Password resets
EMAIL_2FA_CODE_TTL = 300   # 5 minutes
EMAIL_2FA_RATE_TTL = 60    # 1 min throttle for re-sends
PASSWORD_RESET_TOKEN_TTL = int(os.getenv("PASSWORD_RESET_TOKEN_TTL", "1800"))  # seconds

# --- Static & Media (Django 5.x style) ---
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

# Only include the project-root "static" dir if it exists
STATICFILES_DIRS = [BASE_DIR / "static"] if (BASE_DIR / "static").exists() else []

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

# WhiteNoise + Django 5 STORAGES API
STORAGES = {
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
    },
    # "default" (media) is decided below
}

# Back-compat for libs which still read STATICFILES_STORAGE
STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"

# Be tolerant if a CSS references a missing asset
WHITENOISE_MANIFEST_STRICT = False

# --- Cloudinary media storage (optional) ---
CLOUDINARY_URL = os.getenv("CLOUDINARY_URL", "").strip()

# Use Cloudinary for MEDIA *without* adding its Django apps, to avoid pulling in their static files
if CLOUDINARY_URL:
    STORAGES["default"] = {"BACKEND": "cloudinary_storage.storage.MediaCloudinaryStorage"}
else:
    STORAGES["default"] = {"BACKEND": "django.core.files.storage.FileSystemStorage"}
# --- Caching ---
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        "LOCATION": "cineflow-cache",
    }
}

# --- Security / Headers ---
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]