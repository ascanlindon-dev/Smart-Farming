"""Paginated prediction transactions belonging to the signed-in account."""
from django.core.paginator import EmptyPage, Paginator
from django.db.models import Count, Q
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Prediction


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def prediction_transactions(request):
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
    )
    predictions = owned_predictions.order_by(
        '-created_at', '-id',
    ).values('id', 'prediction_type', 'label', 'image_name', 'created_at')
    paginator = Paginator(predictions, page_size)
    try:
        page = paginator.page(page_number)
    except EmptyPage:
        return Response({'error': 'Page not found.'}, status=404)

    return Response({
        'count': paginator.count,
        'leaf_count': totals['leaf'],
        'fruit_count': totals['fruit'],
        'page': page.number,
        'page_size': paginator.per_page,
        'total_pages': paginator.num_pages,
        'results': [
            {**row, 'created_at': row['created_at'].isoformat()}
            for row in page.object_list
        ],
    }, headers={'Cache-Control': 'no-store'})
