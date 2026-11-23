"""Paginated prediction transactions belonging to the signed-in account."""
from django.core.paginator import EmptyPage, Paginator
from django.core.files.storage import default_storage
from django.db.models import Count, Q
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Prediction

MATURITY_IMAGE_PREFIX = 'maturity_assessments/'


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def prediction_transactions(request):
    prediction_type = request.query_params.get('prediction_type')
    if prediction_type not in (None, '', 'leaf', 'rambutan'):
        return Response({'error': 'Prediction type must be leaf or rambutan.'}, status=400)

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

    # Ownership comes exclusively from the authenticated session. Include all
    # dates and keep repeated scans as separate transactions.
    owned_predictions = Prediction.objects.filter(user=request.user)
    totals = owned_predictions.aggregate(
        leaf=Count('id', filter=Q(prediction_type='leaf')),
        fruit=Count('id', filter=Q(prediction_type='rambutan')),
        ripe=Count('id', filter=Q(
            prediction_type='rambutan',
            label__in=('mature', 'ripe', 'overripe'),
        )),
        unripe=Count('id', filter=Q(
            prediction_type='rambutan',
            label__in=('immature', 'unripe'),
        )),
    )
    filtered_predictions = owned_predictions
    if prediction_type:
        filtered_predictions = filtered_predictions.filter(prediction_type=prediction_type)
    predictions = filtered_predictions.order_by(
        '-created_at', '-id',
    ).values('id', 'prediction_type', 'label', 'confidence', 'image_name', 'created_at')
    paginator = Paginator(predictions, page_size)
    try:
        page = paginator.page(page_number)
    except EmptyPage:
        return Response({'error': 'Page not found.'}, status=404)

    results = []
    for row in page.object_list:
        image_url = None
        if (
            row['prediction_type'] == 'rambutan'
            and row['image_name'].startswith(MATURITY_IMAGE_PREFIX)
        ):
            image_url = f"/api/predictions/{row['id']}/image/"
        results.append({
            **row,
            'image_url': image_url,
            'created_at': row['created_at'].isoformat(),
        })

    return Response({
        'count': paginator.count,
        'total_count': owned_predictions.count(),
        'leaf_count': totals['leaf'],
        'fruit_count': totals['fruit'],
        'ripe_count': totals['ripe'],
        'unripe_count': totals['unripe'],
        'assessed_count': totals['ripe'] + totals['unripe'],
        'page': page.number,
        'page_size': paginator.per_page,
        'total_pages': paginator.num_pages,
        'results': results,
    }, headers={'Cache-Control': 'no-store'})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def prediction_image(request, prediction_id):
    prediction = get_object_or_404(
        Prediction,
        pk=prediction_id,
        user=request.user,
        prediction_type='rambutan',
    )
    if (
        not prediction.image_name.startswith(MATURITY_IMAGE_PREFIX)
        or '..' in prediction.image_name.split('/')
    ):
        return Response({'error': 'Assessment image not found.'}, status=404)

    try:
        image_file = default_storage.open(prediction.image_name, 'rb')
    except FileNotFoundError:
        return Response({'error': 'Assessment image not found.'}, status=404)

    response = FileResponse(image_file, content_type='image/jpeg')
    response['Cache-Control'] = 'private, no-store'
    response['X-Content-Type-Options'] = 'nosniff'
    return response
