"""Paginated raw readings from the configured sensor database."""
from django.core.paginator import EmptyPage, Paginator
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import SensorReading


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def sensor_readings(request):
    try:
        page_number = int(request.query_params.get('page', '1'))
        if page_number < 1:
            raise ValueError
    except (TypeError, ValueError):
        return Response({'error': 'Page must be a positive integer.'}, status=400)

    try:
        page_size = int(request.query_params.get('page_size', '20'))
        if not 1 <= page_size <= 50:
            raise ValueError
    except (TypeError, ValueError):
        return Response({'error': 'Page size must be an integer between 1 and 50.'}, status=400)

    # The model's database router selects local or configured sensor storage.
    # Sensor readings are shared; this table has no per-user ownership field.
    readings = SensorReading.objects.exclude(device_id='temporary-simulator').order_by('-received_at', '-id').values(
        'id', 'temperature', 'humidity', 'rain', 'received_at',
    )
    paginator = Paginator(readings, page_size)
    try:
        page = paginator.page(page_number)
    except EmptyPage:
        return Response({'error': 'Page not found.'}, status=404)

    return Response({
        'count': paginator.count,
        'page': page.number,
        'page_size': paginator.per_page,
        'total_pages': paginator.num_pages,
        'results': [
            {**row, 'received_at': row['received_at'].isoformat()}
            for row in page.object_list
        ],
    }, headers={'Cache-Control': 'no-store'})
