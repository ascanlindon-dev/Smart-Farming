"""Railway: one HTTPS origin for the built frontend and Django API."""
from .settings import *  # noqa: F403

from django.core.exceptions import ImproperlyConfigured

DEBUG = False
ROOT_URLCONF = 'backend.production_urls'
if os.environ.get('DJANGO_DEBUG', 'false').lower() != 'false':
    raise ImproperlyConfigured('DJANGO_DEBUG must be false when using production settings.')
if len(SECRET_KEY) < 50 or len(set(SECRET_KEY)) < 5 or SECRET_KEY.startswith('django-insecure-'):
    raise ImproperlyConfigured('Set a strong, random DJANGO_SECRET_KEY for production.')

if DATABASES['default']['ENGINE'] != 'django.db.backends.postgresql':
    raise ImproperlyConfigured('Set DATABASE_URL to a persistent PostgreSQL database for hosting.')
if 'sensors' in DATABASES or PREDICTION_SYNC_DATABASE:
    raise ImproperlyConfigured(
        'Hosting uses DATABASE_URL for all records. Leave SENSOR_DB_ENGINE and '
        'PREDICTION_SYNC_DATABASE unset; review existing account migration separately.'
    )
DATABASES['default']['OPTIONS'].update(connect_timeout=10)
DATABASES['default']['DISABLE_SERVER_SIDE_CURSORS'] = True
DATABASES['default']['CONN_MAX_AGE'] = 60
DATABASES['default']['CONN_HEALTH_CHECKS'] = True

ALLOWED_HOSTS = [value.strip() for value in os.environ.get('DJANGO_ALLOWED_HOSTS', '').split(',') if value.strip()]
railway_domain = os.environ.get('RAILWAY_PUBLIC_DOMAIN', '').strip()
if railway_domain:
    ALLOWED_HOSTS.append(railway_domain)
if not ALLOWED_HOSTS or any('*' in host or '/' in host or host.startswith('.') for host in ALLOWED_HOSTS):
    raise ImproperlyConfigured('Set DJANGO_ALLOWED_HOSTS to the public hostname, without a scheme or wildcard.')
ALLOWED_HOSTS.append('healthcheck.railway.app')
# Browser requests use this service's HTTPS origin. Do not inherit development
# CORS/CSRF origins from an old service variable.
CSRF_TRUSTED_ORIGINS = list(dict.fromkeys(
    f'https://{host}' for host in ALLOWED_HOSTS if host != 'healthcheck.railway.app'
))
CORS_ALLOW_ALL_ORIGINS = False
CORS_ALLOWED_ORIGINS = CSRF_TRUSTED_ORIGINS
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
SECURE_SSL_REDIRECT = True
SECURE_REDIRECT_EXEMPT = [r'^healthz/$']
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = 3600
SECURE_HSTS_INCLUDE_SUBDOMAINS = False
SECURE_HSTS_PRELOAD = False
# These opt-in recommendations need a domain owner's decision. This app uses
# short HSTS on its exact host and does not enroll subdomains in browser preload.
SILENCED_SYSTEM_CHECKS = ['security.W005', 'security.W021']

TELEMETRY_API_KEY = os.environ.get('TELEMETRY_API_KEY', '').strip()
if len(TELEMETRY_API_KEY) < 32:
    raise ImproperlyConfigured('Set a random TELEMETRY_API_KEY of at least 32 characters for device uploads.')
TELEMETRY_REQUIRE_AUTH = True
API_REQUIRE_LOGIN = True
PREDICTIONS_STORED_IN_CLOUD = True
REST_FRAMEWORK = {
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {'anon': '60/minute', 'user': '180/minute'},
}

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
] + [item for item in MIDDLEWARE if item not in (
    'django.middleware.security.SecurityMiddleware', 'corsheaders.middleware.CorsMiddleware',
)]
FRONTEND_BUILD_DIR = BASE_DIR.parent / 'build'
STATIC_ROOT = BASE_DIR / 'staticfiles'
WHITENOISE_ROOT = FRONTEND_BUILD_DIR
STORAGES = {
    'default': {'BACKEND': 'django.core.files.storage.FileSystemStorage'},
    'staticfiles': {'BACKEND': 'whitenoise.storage.CompressedManifestStaticFilesStorage'},
}
