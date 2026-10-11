#!/bin/sh
set -eu
# A stale service variable must not start the development settings on Railway.
export DJANGO_SETTINGS_MODULE=backend.production
python backend/manage.py check --deploy --fail-level WARNING
# Refuse to run against an outdated schema; migration is a separate reviewed step.
python backend/manage.py migrate --check
cd backend
exec gunicorn --config gunicorn.conf.py backend.wsgi:application
