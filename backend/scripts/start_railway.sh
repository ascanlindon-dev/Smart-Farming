#!/bin/sh
set -eu
python backend/manage.py check --deploy --fail-level WARNING
# Refuse to run against an outdated schema; migration is a separate reviewed step.
python backend/manage.py migrate --check
cd backend
exec gunicorn --config gunicorn.conf.py backend.wsgi:application
