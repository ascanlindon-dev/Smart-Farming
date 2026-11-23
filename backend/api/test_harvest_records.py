from datetime import timedelta
from zoneinfo import ZoneInfo

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from api.models import HarvestRecord, Prediction


class HarvestRecordApiTests(TestCase):
    farm_timezone = ZoneInfo('Asia/Manila')

    def setUp(self):
        self.user = User.objects.create_user('farmer@example.test')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_records_actual_harvest_and_optionally_links_owned_assessment(self):
        prediction = Prediction.objects.create(
            user=self.user,
            prediction_type='rambutan',
            label='mature',
            confidence=0.93,
            image_name='maturity_assessments/fruit.jpg',
        )
        response = self.client.post('/api/maturity/harvest-records/', {
            'harvest_date': '2026-09-20',
            'notes': 'Picked after checking the fruit.',
            'prediction_id': prediction.pk,
        }, format='json')

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['prediction']['id'], prediction.pk)
        self.assertEqual(response.data['harvest_date'], '2026-09-20')
        self.assertEqual(HarvestRecord.objects.get().user, self.user)

    def test_harvest_records_are_private_and_cross_account_links_are_rejected(self):
        other_user = User.objects.create_user('other@example.test')
        other_prediction = Prediction.objects.create(
            user=other_user,
            prediction_type='rambutan',
            label='mature',
            confidence=0.91,
        )
        response = self.client.post('/api/maturity/harvest-records/', {
            'harvest_date': '2026-09-20',
            'prediction_id': other_prediction.pk,
        }, format='json')
        self.assertEqual(response.status_code, 404)

        HarvestRecord.objects.create(
            user=other_user,
            harvest_date=timezone.localdate(timezone=self.farm_timezone),
        )
        self.assertEqual(self.client.get('/api/maturity/harvest-records/').data['results'], [])

    def test_future_or_invalid_harvest_dates_are_rejected(self):
        future_date = (
            timezone.localdate(timezone=self.farm_timezone) + timedelta(days=1)
        ).isoformat()
        future_response = self.client.post('/api/maturity/harvest-records/', {
            'harvest_date': future_date,
        }, format='json')
        invalid_response = self.client.post('/api/maturity/harvest-records/', {
            'harvest_date': '20-09-2026',
        }, format='json')
        invalid_body_response = self.client.post(
            '/api/maturity/harvest-records/',
            ['not', 'an', 'object'],
            format='json',
        )

        self.assertEqual(future_response.status_code, 400)
        self.assertEqual(invalid_response.status_code, 400)
        self.assertEqual(invalid_body_response.status_code, 400)
        self.assertEqual(HarvestRecord.objects.count(), 0)
