from datetime import timedelta

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from api.models import Prediction


class PredictionTransactionsTests(TestCase):
    endpoint = '/api/predictions/transactions/'

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user('transaction-farmer')
        self.other_user = User.objects.create_user('other-transaction-farmer')
        self.client.force_authenticate(self.user)

    def scan(self, **overrides):
        values = {
            'user': self.user, 'prediction_type': 'leaf', 'label': 'Anthracnose',
            'confidence': .95, 'image_name': 'leaf.jpg',
        }
        return Prediction.objects.create(**{**values, **overrides})

    def test_login_is_required(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(self.endpoint).status_code, 403)

    def test_empty_history_is_a_valid_page_and_disables_caching(self):
        response = self.client.get(self.endpoint)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {
            'count': 0, 'page': 1, 'page_size': 20, 'total_pages': 1, 'results': [],
        })
        self.assertEqual(response['Cache-Control'], 'no-store')

    def test_only_session_owner_records_are_returned_even_with_spoofed_user(self):
        own = self.scan()
        other = self.scan(user=self.other_user, label='Private result')
        self.scan(user=None, label='Anonymous result')
        response = self.client.get(self.endpoint, {
            'user_id': self.other_user.pk, 'user': self.other_user.pk,
            'email': self.other_user.email,
        })
        self.assertEqual(response.json()['count'], 1)
        self.assertEqual([row['id'] for row in response.json()['results']], [own.pk])

        self.client.force_authenticate(self.other_user)
        self.assertEqual(
            [row['id'] for row in self.client.get(self.endpoint).json()['results']],
            [other.pk],
        )

    def test_returns_requested_fields_all_dates_and_repeated_scans_newest_first(self):
        old = self.scan(image_name='')
        old_time = timezone.now() - timedelta(days=800)
        Prediction.objects.filter(pk=old.pk).update(created_at=old_time)
        duplicate_one = self.scan()
        duplicate_two = self.scan()
        fruit = self.scan(prediction_type='rambutan', label='mature', image_name='fruit.png')

        data = self.client.get(self.endpoint).json()
        self.assertEqual(data['count'], 4)
        self.assertEqual(
            [row['id'] for row in data['results']],
            [fruit.pk, duplicate_two.pk, duplicate_one.pk, old.pk],
        )
        self.assertEqual(data['results'][0], {
            'id': fruit.pk, 'prediction_type': 'rambutan', 'label': 'mature',
            'image_name': 'fruit.png', 'created_at': fruit.created_at.isoformat(),
        })
        self.assertEqual(data['results'][-1]['created_at'], old_time.isoformat())
        self.assertEqual(data['results'][-1]['image_name'], '')

    def test_all_records_are_reachable_across_pages_with_tied_timestamps(self):
        scans = [self.scan() for _ in range(23)]
        Prediction.objects.filter(user=self.user).update(created_at=timezone.now())
        self.scan(user=self.other_user)

        first = self.client.get(self.endpoint).json()
        second = self.client.get(self.endpoint, {'page': 2}).json()
        self.assertEqual(first['count'], 23)
        self.assertEqual(first['total_pages'], 2)
        self.assertEqual(len(first['results']), 20)
        self.assertEqual(second['page'], 2)
        self.assertEqual(len(second['results']), 3)
        self.assertEqual(
            [row['id'] for row in first['results'] + second['results']],
            [scan.pk for scan in reversed(scans)],
        )

    def test_expanded_overview_returns_only_the_latest_50_owned_scans(self):
        scans = [self.scan() for _ in range(55)]
        Prediction.objects.filter(user=self.user).update(created_at=timezone.now())
        self.scan(user=self.other_user)
        data = self.client.get(self.endpoint, {'page_size': 50}).json()
        self.assertEqual(data['page_size'], 50)
        self.assertEqual(data['count'], 55)
        self.assertEqual(
            [row['id'] for row in data['results']],
            [scan.pk for scan in reversed(scans)][:50],
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
