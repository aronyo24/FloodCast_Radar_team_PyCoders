"""
FloodCast Radar - Django settings.

Every value that differs between a laptop demo and a server comes from the
environment (see `.env.example`). Nothing secret is committed.
"""

import os
from pathlib import Path

import dj_database_url
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")


def env_bool(name: str, default: bool = False) -> bool:
    return os.getenv(name, str(default)).strip().lower() in {"1", "true", "yes", "on"}


def env_list(name: str, default: str = "") -> list[str]:
    return [item.strip() for item in os.getenv(name, default).split(",") if item.strip()]


DEBUG = env_bool("DEBUG", False)

SECRET_KEY = os.getenv("SECRET_KEY", "")
if not SECRET_KEY:
    if not DEBUG:
        raise RuntimeError("SECRET_KEY must be set when DEBUG is False. See .env.example.")
    # Development only: a fixed, obviously-insecure key so `runserver` works
    # out of the box. Production refuses to start without a real one (above).
    SECRET_KEY = "django-insecure-dev-only-floodwatch-key"

# Heroku sets DYNO on every dyno; there the app answers on *.herokuapp.com.
ON_HEROKU = "DYNO" in os.environ

ALLOWED_HOSTS = env_list("ALLOWED_HOSTS", "localhost,127.0.0.1")
if ON_HEROKU and ".herokuapp.com" not in ALLOWED_HOSTS:
    ALLOWED_HOSTS.append(".herokuapp.com")

INSTALLED_APPS = [
    "floods.apps.FloodWatchAdminConfig",  # django.contrib.admin + FloodCast Radar dashboard
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.humanize",
    "whitenoise.runserver_nostatic",
    "django.contrib.staticfiles",
    "corsheaders",
    "rest_framework",
    "rest_framework.authtoken",
    "floods",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

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

WSGI_APPLICATION = "config.wsgi.application"

# DATABASE_URL (set automatically by the Heroku Postgres add-on) wins;
# otherwise a local SQLite file, which is fine for development.
if os.getenv("DATABASE_URL"):
    DATABASES = {
        "default": dj_database_url.config(
            conn_max_age=600,
            conn_health_checks=True,
            ssl_require=env_bool("DATABASE_SSL_REQUIRE", ON_HEROKU),
        )
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": Path(os.getenv("DATABASE_PATH", BASE_DIR / "db.sqlite3")),
            # The importer and the scheduler can overlap a page request; give
            # SQLite a moment to wait for the write lock instead of failing.
            "OPTIONS": {"timeout": 20},
        }
    }

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "Asia/Dhaka"
USE_I18N = True
USE_TZ = True

# ---- static and media -----------------------------------------------------

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {
        "BACKEND": (
            "django.contrib.staticfiles.storage.StaticFilesStorage"
            if DEBUG
            else "whitenoise.storage.CompressedManifestStaticFilesStorage"
        )
    },
}

MEDIA_URL = "/media/"
MEDIA_ROOT = Path(os.getenv("MEDIA_ROOT", BASE_DIR / "media"))
# Overlay PNGs are user-visible at /media/. They are small (hundreds of KB),
# so Django serves them itself; set SERVE_MEDIA=False when nginx does it.
SERVE_MEDIA = env_bool("SERVE_MEDIA", True)

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ---- REST framework -------------------------------------------------------

REST_FRAMEWORK = {
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"]
    + (["rest_framework.renderers.BrowsableAPIRenderer"] if DEBUG else []),
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.SessionAuthentication",
        "rest_framework.authentication.TokenAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.AllowAny"],
    # The frontend uses `?format=list` and `?format=csv` as part of its API
    # contract. DRF would otherwise treat `format` as a renderer override and
    # answer 404 for both.
    "URL_FORMAT_OVERRIDE": None,
    "UNAUTHENTICATED_USER": "django.contrib.auth.models.AnonymousUser",
    "EXCEPTION_HANDLER": "floods.api.api_exception_handler",
    # Only the public sign-up form is throttled (see SubscribeView).
    "DEFAULT_THROTTLE_RATES": {
        "subscribe": os.getenv("SUBSCRIBE_RATE", "20/hour"),
        # BMD portal sign-in and registration (per IP): slows password guessing.
        "bmd_auth": os.getenv("BMD_AUTH_RATE", "30/hour"),
    },
}

# ---- CORS / CSRF ----------------------------------------------------------
# Only needed when the browser calls Django directly (NEXT_PUBLIC_API_BASE).
# When the Next.js server proxies /api/ (FLOODWATCH_API_URL), it is same-origin.

CORS_ALLOWED_ORIGINS = env_list("CORS_ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")
CORS_ALLOW_CREDENTIALS = True
CORS_URLS_REGEX = r"^/(api|media)/.*$"
CSRF_TRUSTED_ORIGINS = env_list("CSRF_TRUSTED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")

# The public website (the Next.js frontend). Its origin is trusted
# automatically, so on Heroku setting FLOODWATCH_SITE_URL is enough for the
# officer sign-in, report forms and the admin "update" button to pass CSRF.
FLOODWATCH_SITE_URL = os.getenv("FLOODWATCH_SITE_URL", "http://localhost:3000").rstrip("/")
for _origin in [FLOODWATCH_SITE_URL]:
    if _origin.startswith("http") and _origin not in CSRF_TRUSTED_ORIGINS:
        CSRF_TRUSTED_ORIGINS.append(_origin)
    if _origin.startswith("http") and _origin not in CORS_ALLOWED_ORIGINS:
        CORS_ALLOWED_ORIGINS.append(_origin)

if not DEBUG:
    SESSION_COOKIE_SECURE = env_bool("SECURE_COOKIES", True)
    CSRF_COOKIE_SECURE = env_bool("SECURE_COOKIES", True)
    SECURE_CONTENT_TYPE_NOSNIFF = True
    X_FRAME_OPTIONS = "DENY"
    # Heroku's router terminates HTTPS and forwards plain HTTP with this header.
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SECURE_SSL_REDIRECT = env_bool("SECURE_SSL_REDIRECT", False)
    SECURE_HSTS_SECONDS = int(os.getenv("SECURE_HSTS_SECONDS", 0))

# ---- FloodCast Radar -----------------------------------------------------------

EARTHDATA_TOKEN = os.getenv("EARTHDATA_TOKEN", "")

FLOOD_ALERTS = {
    # Orange: at least this share of the observed area is newly flooded...
    "ORANGE_PCT": float(os.getenv("ALERT_ORANGE_PCT", 10.0)),
    # Red: at least this share, OR a rise of RISE_PP points since last cycle.
    "RED_PCT": float(os.getenv("ALERT_RED_PCT", 25.0)),
    "RISE_PP": float(os.getenv("ALERT_RISE_PP", 10.0)),
    # ...but only if the radar actually saw at least this much of the district.
    "MIN_COVERAGE_PCT": float(os.getenv("ALERT_MIN_COVERAGE_PCT", 50.0)),
    # An open alert is closed once the share drops below this.
    "CLOSE_PCT": float(os.getenv("ALERT_CLOSE_PCT", 5.0)),
}

FLOODWATCH = {
    # Where `update_floods` looks for processed output: a web_data directory
    # or a .zip. FLOODWATCH_WEB_DATA_URL (a .zip, e.g. a GitHub Actions
    # release asset) is downloaded first when set.
    "WEB_DATA_PATH": os.getenv("FLOODWATCH_WEB_DATA", str(BASE_DIR / "web_data")),
    "WEB_DATA_URL": os.getenv("FLOODWATCH_WEB_DATA_URL", ""),
    # Optional shell command that runs the external processing pipeline and
    # writes WEB_DATA_PATH. Left empty, the backend never processes imagery.
    "PIPELINE_COMMAND": os.getenv("FLOODWATCH_PIPELINE_COMMAND", ""),
    "PIPELINE_TIMEOUT_S": int(os.getenv("FLOODWATCH_PIPELINE_TIMEOUT_S", 3600)),
    # In-process daily scheduler (hackathon option). Off by default.
    "SCHEDULER_ENABLED": env_bool("FLOODWATCH_SCHEDULER", False),
    "SCHEDULE_HOUR": int(os.getenv("FLOODWATCH_SCHEDULE_HOUR", 6)),
    "SCHEDULE_MINUTE": int(os.getenv("FLOODWATCH_SCHEDULE_MINUTE", 0)),
    "CYCLE_LENGTH_DAYS": 12,
    # Import safety limits.
    "MAX_ZIP_BYTES": int(os.getenv("FLOODWATCH_MAX_ZIP_MB", 500)) * 1024 * 1024,
    "MAX_OVERLAY_BYTES": int(os.getenv("FLOODWATCH_MAX_OVERLAY_MB", 25)) * 1024 * 1024,
    # Defaults for /api/meta/. `meta.json` in web_data overrides any of these.
    "META_DEFAULTS": {
        "mission": "NASA-ISRO NISAR",
        "instrument": "L-band SAR, 12-day repeat",
        "distributor": "ASF DAAC",
        "product": "Provisional NISAR L-band amplitude, water/no-water threshold",
        "provisional": True,
        # Safe default: anything not explicitly marked as real is not real.
        "demo_data": True,
        "demo_note": (
            "This dataset has not been marked as measured NISAR output "
            "(meta.json demo_data=false). Treat the flood figures as a demo."
        ),
        "boundaries": {
            "name": "geoBoundaries gbOpen BGD ADM2",
            "release": "",
            "year_represented": 2020,
            "licence": "CC BY 3.0 IGO",
            "source": "data.humdata.org/dataset/administrative-boundaries-of-bangladesh-as-of-2015",
            "url": "https://www.geoboundaries.org/",
        },
    },
}

# ---- BMD field portal --------------------------------------------------------
# When True, officers cannot file reports until an admin marks them verified.
# When False (default) they can, and their reports show "Unverified" until then.
BMD_REQUIRE_VERIFICATION = env_bool("BMD_REQUIRE_VERIFICATION", False)
SESSION_COOKIE_AGE = 60 * 60 * 24 * 14  # officers stay signed in for two weeks

# ---- E-mail notifications ---------------------------------------------------
# With no EMAIL_HOST the console backend prints every e-mail to the server log,
# so subscriptions work in a demo with no SMTP account. For real delivery, e.g.
# Gmail: EMAIL_HOST=smtp.gmail.com, EMAIL_PORT=587, EMAIL_USE_TLS=True,
# EMAIL_HOST_USER=<address>, EMAIL_HOST_PASSWORD=<16-char app password>.

EMAIL_HOST = os.getenv("EMAIL_HOST", "")
EMAIL_PORT = int(os.getenv("EMAIL_PORT", 587))
EMAIL_HOST_USER = os.getenv("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.getenv("EMAIL_HOST_PASSWORD", "")
EMAIL_USE_TLS = env_bool("EMAIL_USE_TLS", True)
EMAIL_USE_SSL = env_bool("EMAIL_USE_SSL", False)
EMAIL_TIMEOUT = 20
EMAIL_BACKEND = os.getenv(
    "EMAIL_BACKEND",
    "django.core.mail.backends.smtp.EmailBackend" if EMAIL_HOST
    else "django.core.mail.backends.console.EmailBackend",
)
DEFAULT_FROM_EMAIL = os.getenv("DEFAULT_FROM_EMAIL", EMAIL_HOST_USER or "FloodCast Radar <alerts@floodcast.local>")
# FLOODWATCH_SITE_URL (the public website, used for links in e-mails) is set
# in the CORS / CSRF section above.
# Send alert e-mails automatically after each successful data import.
FLOODWATCH_AUTO_NOTIFY = env_bool("FLOODWATCH_AUTO_NOTIFY", True)

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {"plain": {"format": "%(asctime)s %(levelname)s %(name)s: %(message)s"}},
    "handlers": {"console": {"class": "logging.StreamHandler", "formatter": "plain"}},
    "loggers": {
        "floods": {"handlers": ["console"], "level": os.getenv("LOG_LEVEL", "INFO")},
        # Request errors (500s with tracebacks) go to stdout, i.e. `heroku logs`.
        "django": {"handlers": ["console"], "level": os.getenv("DJANGO_LOG_LEVEL", "WARNING")},
    },
}
