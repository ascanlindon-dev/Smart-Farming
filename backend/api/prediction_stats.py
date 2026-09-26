"""Account-scoped counters for the disease detection page."""
import re
from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from django.conf import settings
from django.db.models import Count
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Prediction


def _is_disease(label):
    normalized = re.sub(r'[\s_-]+', ' ', label).strip().casefold()
    return (
        normalized not in {'', 'healthy', 'healthy leaf', 'unknown', 'not leaf'}
        and re.fullmatch(r'(?:class )?\d+', normalized) is None
    )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def leaf_scan_stats(request):
    zone_name = request.query_params.get('timezone') or settings.TIME_ZONE
    try:
        zone = ZoneInfo(zone_name)
    except (ZoneInfoNotFoundError, ValueError):
        return Response({'error': 'Invalid timezone.'}, status=400)

    today = timezone.now().astimezone(zone).date()
    start = datetime.combine(today, time.min, tzinfo=zone)
    end = datetime.combine(today + timedelta(days=1), time.min, tzinfo=zone)
    scans = Prediction.objects.filter(user=request.user, prediction_type='leaf')

    # Group by label to avoid loading every saved scan. Repeated detections
    # count individually; healthy, rejected and unclassified scans are excluded.
    label_counts = scans.values('label').annotate(total=Count('pk')).order_by()
    diseases_tracked = sum(row['total'] for row in label_counts if _is_disease(row['label']))
    scans_today = scans.filter(created_at__gte=start, created_at__lt=end).count()
    return Response({
        'diseasesTracked': diseases_tracked,
        'scansToday': scans_today,
        'date': today.isoformat(),
        'timezone': zone_name,
    }, headers={'Cache-Control': 'no-store'})
