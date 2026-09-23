"""Run regression tests without touching the configured farm database."""
from .settings import *  # noqa: F403

DATABASES = {'default': {'ENGINE': 'django.db.backends.sqlite3', 'NAME': ':memory:'}}
DATABASES['prediction_cloud'] = {'ENGINE': 'django.db.backends.sqlite3', 'NAME': ':memory:'}
PASSWORD_HASHERS = ['django.contrib.auth.hashers.MD5PasswordHasher']
PREDICTION_SYNC_DATABASE = ''
