import tempfile
import os
import subprocess
import sys
from pathlib import Path
from unittest.mock import patch

from django.contrib.auth.models import User
from django.db import DatabaseError
from django.test import SimpleTestCase, TestCase, override_settings
from rest_framework.test import APIClient

from api.models import Prediction, SensorReading
from api.prediction_storage import save_prediction


class ProductionStartupTests(SimpleTestCase):
    def check_settings(self, **overrides):
        environment = dict(os.environ, DJANGO_SECRET_KEY='test-only-hosting-secret-with-more-than-fifty-characters-123456789',
                           DJANGO_DEBUG='false', DATABASE_URL='postgresql://127.0.0.1:1/test',
                           DB_ENGINE='sqlite', SENSOR_DB_ENGINE='', PREDICTION_SYNC_DATABASE='',
                           DJANGO_ALLOWED_HOSTS='hosting.example.test', RAILWAY_PUBLIC_DOMAIN='',
                           TELEMETRY_API_KEY='test-device-key-long-enough-for-production')
        environment.update(overrides)
        return subprocess.run([sys.executable, '-B', '-c', 'import backend.production'],
                              cwd=Path(__file__).resolve().parents[1], env=environment,
                              capture_output=True, text=True, timeout=15)

    def test_persistent_database_configuration_can_boot_without_connecting(self):
        result = self.check_settings()
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_production_refuses_sqlite_debug_missing_device_key_and_wildcard_hosts(self):
        for overrides in ({'DATABASE_URL': ''}, {'DJANGO_DEBUG': 'true'}, {'TELEMETRY_API_KEY': ''},
                          {'DJANGO_ALLOWED_HOSTS': '*'}, {'DJANGO_SECRET_KEY': 'weak'}):
            with self.subTest(overrides=list(overrides)):
                self.assertNotEqual(self.check_settings(**overrides).returncode, 0)

    def test_production_refuses_the_old_split_database_configuration(self):
        result = self.check_settings(PREDICTION_SYNC_DATABASE='sensors')
        self.assertNotEqual(result.returncode, 0)


@override_settings(TELEMETRY_REQUIRE_AUTH=True, TELEMETRY_API_KEY='test-device-key-for-hosting-requests')
class HostedTelemetryTests(TestCase):
    def test_missing_wrong_and_non_ascii_keys_cannot_write_readings(self):
        for key in ('', 'wrong', '\u00e9' * 40):
            with self.subTest(key=key):
                response = self.client.post('/api/telemetry/', {'temperature': 27},
                                            content_type='application/json', HTTP_X_TELEMETRY_KEY=key)
                self.assertEqual(response.status_code, 401)
        self.assertEqual(SensorReading.objects.count(), 0)

    def test_valid_device_key_preserves_real_zero_values(self):
        response = self.client.post('/api/telemetry/', {'device_id': 'test-device', 'temperature': 0, 'rain': False},
                                    content_type='application/json', HTTP_X_TELEMETRY_KEY='test-device-key-for-hosting-requests')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(SensorReading.objects.get().temperature, 0)

    @override_settings(TELEMETRY_API_KEY='')
    def test_required_auth_never_accepts_an_unconfigured_key(self):
        response = self.client.post('/api/telemetry/', {'temperature': 27}, content_type='application/json')
        self.assertEqual(response.status_code, 401)
        self.assertEqual(SensorReading.objects.count(), 0)


@override_settings(API_REQUIRE_LOGIN=True)
class HostedScanTests(TestCase):
    def test_anonymous_users_cannot_trigger_inference_or_paid_provider_calls(self):
        client = APIClient()
        with patch('api.views.verify_leaf') as leaf, patch('api.views.verify_rambutan') as fruit, patch('api.views.recommend_with_openai') as provider:
            for endpoint in ('predict_leaf', 'predict_rambutan', 'nlp/summary', 'disease-recommendation'):
                with self.subTest(endpoint=endpoint):
                    self.assertEqual(client.post(f'/api/{endpoint}/', {}, format='json').status_code, 403)
            leaf.assert_not_called()
            fruit.assert_not_called()
            provider.assert_not_called()

    def test_signed_in_users_reach_upload_validation_and_csrf_remains_available(self):
        client = APIClient()
        self.assertEqual(client.get('/api/csrf/').status_code, 200)
        client.force_authenticate(User.objects.create_user('hosted-farmer'))
        self.assertEqual(client.post('/api/predict_leaf/', {}, format='multipart').status_code, 400)

    @override_settings(PREDICTIONS_STORED_IN_CLOUD=True, PREDICTION_SYNC_DATABASE='')
    def test_primary_cloud_database_save_keeps_owner_without_duplicate_sync(self):
        user = User.objects.create_user('cloud-farmer')
        with patch('api.prediction_storage.sync_prediction') as sync:
            result = save_prediction(user=user, prediction_type='leaf', label='Healthy Leaf', confidence=.98)
        sync.assert_not_called()
        self.assertTrue(result['cloud_saved'])
        self.assertEqual(result['cloud_prediction_id'], result['prediction_id'])
        self.assertEqual(Prediction.objects.get().user_id, user.pk)


@override_settings(ROOT_URLCONF='backend.production_urls', SECURE_SSL_REDIRECT=True,
                   SECURE_REDIRECT_EXEMPT=[r'^healthz/$'],
                   SECURE_PROXY_SSL_HEADER=('HTTP_X_FORWARDED_PROTO', 'https'),
                   ALLOWED_HOSTS=['testserver', 'healthcheck.railway.app'])
class HostedRoutingTests(TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.build = Path(directory.name)
        (self.build / 'index.html').write_text('<html>test frontend</html>', encoding='utf-8')
        self.enable = override_settings(FRONTEND_BUILD_DIR=self.build)
        self.enable.enable()
        self.addCleanup(self.enable.disable)

    def test_frontend_is_served_on_the_https_origin_without_caching_the_index(self):
        response = self.client.get('/', HTTP_X_FORWARDED_PROTO='https')
        self.assertEqual(response.status_code, 200)
        self.assertIn(b'test frontend', b''.join(response.streaming_content))
        response.close()
        self.assertIn('no-store', response['Cache-Control'])
        self.assertEqual(self.client.get('/').status_code, 301)

    def test_unknown_api_routes_remain_404_instead_of_serving_html(self):
        self.assertEqual(self.client.get('/api/not-a-route/', secure=True).status_code, 404)

    def test_railway_healthcheck_does_not_redirect_and_checks_database(self):
        with patch('image_verifier.WEIGHTS', self.build / 'index.html'):
            response = self.client.get('/healthz/', HTTP_HOST='healthcheck.railway.app')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'status': 'ok'})

    def test_healthcheck_fails_for_missing_model_or_frontend(self):
        for model, frontend in [(self.build / 'missing-weights', self.build), (self.build / 'index.html', self.build / 'missing-build')]:
            with patch('image_verifier.WEIGHTS', model), override_settings(FRONTEND_BUILD_DIR=frontend):
                self.assertEqual(self.client.get('/healthz/').status_code, 503)

    def test_healthcheck_does_not_expose_database_errors(self):
        with patch('image_verifier.WEIGHTS', self.build / 'index.html'), patch('backend.hosting_views.connections') as connections:
            connections.__getitem__.return_value.cursor.side_effect = DatabaseError('private connection details')
            response = self.client.get('/healthz/')
        self.assertEqual(response.status_code, 503)
        self.assertNotIn('private', response.content.decode())
