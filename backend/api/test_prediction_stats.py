from datetime import datetime, timedelta, timezone as dt_timezone
from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from api.models import Prediction


@override_settings(TIME_ZONE='UTC')
class LeafScanStatsTests(TestCase):
    endpoint = '/api/predictions/leaf-stats/'
    now = datetime(2026, 9, 26, 2, 30, tzinfo=dt_timezone.utc)

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user('stats-farmer')
        self.other_user = User.objects.create_user('other-farmer')
        self.client.force_authenticate(self.user)

    def scan(self, label='Anthracnose', *, user=None, kind='leaf', at=None):
        scan = Prediction.objects.create(
            user=user or self.user, prediction_type=kind, label=label, confidence=.95,
        )
        Prediction.objects.filter(pk=scan.pk).update(created_at=at or self.now)
        return scan

    def stats(self, zone='Asia/Manila'):
        with patch('api.prediction_stats.timezone.now', return_value=self.now):
            return self.client.get(self.endpoint, {'timezone': zone})

    def test_requires_login(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.stats().status_code, 403)

    def test_empty_history_returns_real_zeroes_and_disables_caching(self):
        response = self.stats()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {
            'diseasesTracked': 0, 'scansToday': 0,
            'date': '2026-09-26', 'timezone': 'Asia/Manila',
        })
        self.assertEqual(response['Cache-Control'], 'no-store')

    def test_repeated_disease_scans_count_individually_and_only_for_owner(self):
        self.scan('Anthracnose')
        self.scan('Anthracnose')
        self.scan('Sooty Mold', at=self.now - timedelta(days=30))
        self.scan('Healthy Leaf')
        self.scan('Anthracnose', user=self.other_user)
        self.scan('mature', kind='rambutan')
        Prediction.objects.create(prediction_type='leaf', label='Anthracnose', confidence=.98)
        self.assertEqual(self.stats().json()['diseasesTracked'], 3)
        self.assertEqual(self.stats().json()['scansToday'], 3)

    def test_healthy_rejected_and_unknown_labels_are_not_diseases(self):
        for label in ['Healthy Leaf', 'healthy_leaf', ' HEALTHY ', 'unknown', 'UNKNOWN',
                      'not_leaf', 'Not-Leaf', '', '   ', '0', 'class_1']:
            self.scan(label)
        self.scan('algal_leaf_spot')
        self.assertEqual(self.stats().json()['diseasesTracked'], 1)

    def test_today_uses_requested_local_midnights_not_a_rolling_day_or_utc(self):
        start = datetime(2026, 9, 25, 16, tzinfo=dt_timezone.utc)
        end = start + timedelta(days=1)
        self.scan(at=start - timedelta(seconds=1))
        self.scan(at=start)
        self.scan('Healthy Leaf', at=end - timedelta(seconds=1))
        self.scan(at=end)
        self.assertEqual(self.stats().json()['scansToday'], 2)

    def test_local_date_changes_before_the_utc_date(self):
        self.scan(at=datetime(2026, 9, 25, 23, tzinfo=dt_timezone.utc))
        self.assertEqual(self.stats('Asia/Manila').json()['scansToday'], 1)
        self.assertEqual(self.stats('UTC').json()['scansToday'], 0)

    def test_counts_refresh_from_saved_records(self):
        self.assertEqual(self.stats().json()['scansToday'], 0)
        self.scan()
        self.scan()
        self.assertEqual(self.stats().json()['scansToday'], 2)
        self.assertEqual(self.stats().json()['diseasesTracked'], 2)
        self.scan('Healthy Leaf')
        self.assertEqual(self.stats().json()['scansToday'], 3)
        self.assertEqual(self.stats().json()['diseasesTracked'], 2)

    def test_invalid_timezone_is_a_client_error(self):
        for zone in ['Invalid/Timezone', '../Asia/Manila']:
            with self.subTest(zone=zone):
                response = self.stats(zone)
                self.assertEqual(response.status_code, 400)
                self.assertEqual(response.json(), {'error': 'Invalid timezone.'})
