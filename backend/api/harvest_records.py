"""Account-scoped harvest date records for maturity monitoring."""
from datetime import date
from zoneinfo import ZoneInfo

from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import HarvestRecord, Prediction

FARM_TIME_ZONE = ZoneInfo('Asia/Manila')


def serialize_harvest_record(record):
    prediction = record.prediction
    return {
        'id': record.pk,
        'harvest_date': record.harvest_date.isoformat(),
        'notes': record.notes,
        'created_at': record.created_at.isoformat(),
        'prediction': {
            'id': prediction.pk,
            'label': prediction.label,
            'confidence': prediction.confidence,
            'created_at': prediction.created_at.isoformat(),
        } if prediction else None,
    }


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def harvest_records(request):
    if request.method == 'GET':
        records = HarvestRecord.objects.filter(user=request.user).select_related(
            'prediction',
        )
        return Response({
            'results': [serialize_harvest_record(record) for record in records],
        }, headers={'Cache-Control': 'no-store'})

    if not isinstance(request.data, dict):
        return Response({'error': 'A JSON object is required.'}, status=400)
    value = request.data.get('harvest_date')
    if not isinstance(value, str):
        return Response({'error': 'Harvest date is required in YYYY-MM-DD format.'}, status=400)
    try:
        harvest_date = date.fromisoformat(value)
    except ValueError:
        return Response({'error': 'Harvest date must use YYYY-MM-DD format.'}, status=400)
    if harvest_date.isoformat() != value:
        return Response({'error': 'Harvest date must use YYYY-MM-DD format.'}, status=400)
    if harvest_date > timezone.localdate(timezone=FARM_TIME_ZONE):
        return Response({'error': 'An actual harvest date cannot be in the future.'}, status=400)

    notes = request.data.get('notes', '')
    if not isinstance(notes, str) or len(notes.strip()) > 500:
        return Response({'error': 'Notes must be 500 characters or fewer.'}, status=400)

    prediction = None
    prediction_id = request.data.get('prediction_id')
    if prediction_id not in (None, ''):
        try:
            if isinstance(prediction_id, bool):
                raise ValueError
            prediction_id = int(prediction_id)
            if prediction_id < 1:
                raise ValueError
        except (TypeError, ValueError):
            return Response({'error': 'Prediction ID must be a positive integer.'}, status=400)
        prediction = get_object_or_404(
            Prediction,
            pk=prediction_id,
            user=request.user,
            prediction_type='rambutan',
        )

    record = HarvestRecord.objects.create(
        user=request.user,
        prediction=prediction,
        harvest_date=harvest_date,
        notes=notes.strip(),
    )
    return Response(serialize_harvest_record(record), status=201)
