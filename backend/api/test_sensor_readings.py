from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from api.models import SensorReading


class SensorReadingsTests(TestCase):
    databases = {'default', 'prediction_cloud'}
    endpoint = '/api/sensors/readings/'

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user('sensor-table-farmer')
        self.client.force_authenticate(self.user)

    def test_requires_login(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(self.endpoint).status_code, 403)

    def test_empty_history_and_no_caching(self):
        response = self.client.get(self.endpoint)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {
            'count': 0, 'page': 1, 'page_size': 20, 'total_pages': 1, 'results': [],
        })
        self.assertEqual(response['Cache-Control'], 'no-store')

    def test_returns_requested_fields_and_preserves_zeroes_raw_rain_and_nulls(self):
        zero = SensorReading.objects.create(temperature=0, humidity=0, rain=0)
        missing = SensorReading.objects.create(temperature=None, humidity=None, rain=None)
        raw = SensorReading.objects.create(temperature=27.35, humidity=81.2, rain=1023)
        rows = {row['id']: row for row in self.client.get(self.endpoint).json()['results']}
        self.assertEqual(rows[zero.pk], {
            'id': zero.pk, 'temperature': 0, 'humidity': 0, 'rain': 0,
            'received_at': zero.received_at.isoformat(),
        })
        for field in ('temperature', 'humidity', 'rain'):
            self.assertIsNone(rows[missing.pk][field])
        self.assertEqual(rows[raw.pk]['temperature'], 27.35)
        self.assertEqual(rows[raw.pk]['humidity'], 81.2)
        self.assertEqual(rows[raw.pk]['rain'], 1023)

    def test_all_dates_are_included_newest_first(self):
        old = SensorReading.objects.create(temperature=22)
        old_time = timezone.now() - timedelta(days=800)
        SensorReading.objects.filter(pk=old.pk).update(received_at=old_time)
        recent = SensorReading.objects.create(temperature=30)
        response = self.client.get(self.endpoint).json()
        self.assertEqual([row['id'] for row in response['results']], [recent.pk, old.pk])
        self.assertEqual(response['results'][-1]['received_at'], old_time.isoformat())

    def test_pagination_includes_every_reading_even_with_identical_timestamps(self):
        readings = [SensorReading.objects.create(temperature=25) for _ in range(23)]
        SensorReading.objects.update(received_at=timezone.now())
        first = self.client.get(self.endpoint).json()
        second = self.client.get(self.endpoint, {'page': 2}).json()
        self.assertEqual(first['count'], 23)
        self.assertEqual(first['total_pages'], 2)
        self.assertEqual(len(first['results']), 20)
        self.assertEqual(second['page'], 2)
        self.assertEqual(len(second['results']), 3)
        self.assertEqual(
            [row['id'] for row in first['results'] + second['results']],
            [reading.pk for reading in reversed(readings)],
        )

    def test_expanded_overview_returns_only_the_latest_50_readings(self):
        readings = [SensorReading.objects.create(temperature=25) for _ in range(55)]
        SensorReading.objects.update(received_at=timezone.now())
        data = self.client.get(self.endpoint, {'page_size': 50}).json()
        self.assertEqual(data['page_size'], 50)
        self.assertEqual(data['count'], 55)
        self.assertEqual(
            [row['id'] for row in data['results']],
            [reading.pk for reading in reversed(readings)][:50],
        )

    def test_invalid_page_sizes_are_rejected(self):
        for size in ['0', '-1', '51', 'abc', '1.5', '']:
            with self.subTest(page_size=size):
                self.assertEqual(self.client.get(self.endpoint, {'page_size': size}).status_code, 400)

    def test_invalid_and_missing_pages_are_rejected(self):
        for page in ['0', '-1', 'abc', '1.5', '']:
            with self.subTest(page=page):
                self.assertEqual(self.client.get(self.endpoint, {'page': page}).status_code, 400)
        self.assertEqual(self.client.get(self.endpoint, {'page': 2}).status_code, 404)

    def test_uses_the_configured_sensor_database(self):
        SensorReading.objects.create(temperature=10)
        remote = SensorReading.objects.using('prediction_cloud').create(temperature=31, rain=1023)

        def route_read(model, **hints):
            return 'prediction_cloud' if model is SensorReading else None

        with patch('api.db_router.SensorReadingRouter.db_for_read', side_effect=route_read):
            data = self.client.get(self.endpoint).json()
        self.assertEqual(data['count'], 1)
        self.assertEqual(data['results'][0]['id'], remote.pk)
        self.assertEqual(data['results'][0]['temperature'], 31)
        self.assertEqual(data['results'][0]['rain'], 1023)
