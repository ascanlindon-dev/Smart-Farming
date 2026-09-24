"""Serve the built frontend and a small Railway readiness endpoint."""
from pathlib import Path

from django.conf import settings
from django.db import connections, DatabaseError
from django.http import FileResponse, JsonResponse
from django.views.decorators.cache import never_cache
from django.views.decorators.http import require_GET


@require_GET
@never_cache
def frontend(request):
    index = Path(settings.FRONTEND_BUILD_DIR) / 'index.html'
    if not index.is_file():
        return JsonResponse({'error': 'Frontend build is unavailable.'}, status=503)
    return FileResponse(index.open('rb'), content_type='text/html')


@require_GET
@never_cache
def health(request):
    from image_verifier import WEIGHTS

    if not WEIGHTS.is_file() or not (Path(settings.FRONTEND_BUILD_DIR) / 'index.html').is_file():
        return JsonResponse({'status': 'unavailable'}, status=503)
    try:
        with connections['default'].cursor() as cursor:
            cursor.execute('SELECT 1')
    except DatabaseError:
        return JsonResponse({'status': 'unavailable'}, status=503)
    return JsonResponse({'status': 'ok'})
