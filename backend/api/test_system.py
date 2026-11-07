import json
import os
from datetime import timedelta
from unittest.mock import Mock, patch

from django.contrib.auth.models import User
from django.test import TestCase, SimpleTestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from api.models import SensorReading, Prediction
from api.recommendations import fallback_recommendation, recommend_with_openai


class SensorAndSessionTests(TestCase):
    def setUp(self):
        self.client = APIClient(enforce_csrf_checks=True)
        self.user = User.objects.create_user('farmer@example.test', 'farmer@example.test', 'initial-password')

    def post(self, url, data):
        token = self.client.get('/api/csrf/').json()['csrfToken']
        return self.client.post(url, data, format='json', HTTP_X_CSRFTOKEN=token)

    def login(self):
        response = self.post('/api/login', {'identifier': self.user.email, 'password': 'initial-password'})
        self.assertEqual(response.status_code, 200)

    def test_login_creates_session_profile_cannot_be_changed_by_email_and_logout_clears_it(self):
        other = User.objects.create_user('other', 'other@example.test', 'other-password')
        self.assertEqual(self.client.get('/api/me/', {'email': other.email}).status_code, 403)
        self.login()
        self.assertEqual(self.client.get('/api/me/', {'email': other.email}).json()['email'], self.user.email)
        self.assertEqual(self.post('/api/me/', {'email': other.email, 'name': 'Intruder'}).status_code, 403)
        self.assertEqual(self.post('/api/me/', {'email': self.user.email, 'name': 'Farmer'}).status_code, 200)
        self.post('/api/logout', {})
        self.assertEqual(self.client.get('/api/me/').status_code, 403)

    def test_profile_mutation_requires_csrf(self):
        self.login()
        self.assertEqual(self.client.post('/api/me/', {'email': self.user.email}, format='json').status_code, 403)

    def test_password_change_updates_database_and_preserves_session(self):
        self.login()
        self.assertEqual(self.post('/api/password/change/', {'oldPassword': 'wrong', 'newPassword': 'new-password-947!', 'confirmPassword': 'new-password-947!'}).status_code, 400)
        response = self.post('/api/password/change/', {'oldPassword': 'initial-password', 'newPassword': 'new-password-947!', 'confirmPassword': 'new-password-947!'})
        self.assertEqual(response.status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('new-password-947!'))
        self.assertEqual(self.client.get('/api/me/').status_code, 200)

    def test_history_is_scoped_to_current_user(self):
        other = User.objects.create_user('other')
        Prediction.objects.create(user=other, prediction_type='leaf', label='private-result', confidence=.99)
        self.assertEqual(self.client.get('/api/predictions/history/').status_code, 403)
        self.login()
        self.assertNotIn('private-result', str(self.client.get('/api/predictions/history/').json()))

    def test_telemetry_round_trip_preserves_real_zeroes(self):
        response = self.post('/api/telemetry/', {'device_id': 'test-device', 'temperature': 0, 'humidity': 0, 'rain': False})
        self.assertEqual(response.status_code, 200)
        data = self.client.get('/api/sensors/').json()
        self.assertEqual(data['temperature'], 0)
        self.assertEqual(data['humidity'], 0)
        self.assertIs(data['isRaining'], False)
        self.assertIsNone(data['soilMoisture'])
        self.assertTrue(data['received_at'])

    def test_malformed_telemetry_is_rejected_without_writing(self):
        for value in ([], {}, {'temperature': 'hot'}, {'humidity': 101}, {'rain': -1}, {'soil_raw': 1.25}, {'device_id': ['invalid'], 'temperature': 20}):
            with self.subTest(value=value):
                self.assertEqual(self.post('/api/telemetry/', value).status_code, 400)
        response = self.client.post('/api/telemetry/', '{"temperature": NaN}', content_type='application/json')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(SensorReading.objects.count(), 0)

    def test_no_sensor_data_is_not_reported_as_zero(self):
        self.assertEqual(self.client.get('/api/sensors/').json(), {})

    @override_settings(SENSOR_SIMULATION_ENABLED=True, SENSOR_SIMULATION_INTERVAL_SECONDS=20)
    @patch('api.views.random.uniform', side_effect=[27.1234, 67.8912, 29.8765, 79.4567])
    def test_enabled_sensor_simulator_persists_decimal_readings_every_20_seconds(self, uniform):
        first = self.client.get('/api/sensors/')
        self.assertEqual(first.status_code, 200)
        self.assertEqual(first.json()['temperature'], 27.12)
        self.assertEqual(first.json()['humidity'], 67.89)
        self.assertEqual(first.json()['device_id'], 'temporary-simulator')
        self.assertEqual(SensorReading.objects.count(), 1)

        second = self.client.get('/api/sensors/')
        self.assertEqual(second.json()['temperature'], 27.12)
        self.assertEqual(second.json()['humidity'], 67.89)
        self.assertEqual(SensorReading.objects.count(), 1)
        self.assertEqual(uniform.call_count, 2)

        SensorReading.objects.update(received_at=timezone.now() - timedelta(seconds=21))
        third = self.client.get('/api/sensors/')
        self.assertEqual(third.json()['temperature'], 29.88)
        self.assertEqual(third.json()['humidity'], 79.46)
        self.assertEqual(SensorReading.objects.count(), 2)
        self.assertEqual(uniform.call_count, 4)

    def test_sensor_history_does_not_sum_raw_rain_as_millimeters(self):
        SensorReading.objects.create(temperature=29, humidity=65, rain=1023)
        data = self.client.get('/api/sensors/history/').json()
        self.assertIsNone(data['summary']['totalRainfall'])
        self.assertIsNone(data['rainfallSummary']['dryDays'])
        self.assertEqual(data['sensorRecords'][0]['rainRaw'], 1023)
        self.assertTrue(all(row['rainfall'] is None for row in data['rainfallData']))

    def test_empty_sensor_history_does_not_claim_low_risk_or_dry_weather(self):
        data = self.client.get('/api/sensors/history/').json()
        self.assertIsNone(data['summary']['currentRisk'])
        self.assertEqual(data['summary']['riskLabel'], 'No data')
        self.assertEqual(data['rainfallSummary']['patterns'], [])

    def test_stale_sensor_data_never_drives_disease_advice(self):
        reading = SensorReading.objects.create(temperature=40, humidity=99, rain=1023)
        SensorReading.objects.filter(pk=reading.pk).update(received_at=timezone.now() - timedelta(hours=3))
        with patch.dict(os.environ, {'OPENAI_API_KEY': ''}):
            response = self.post('/api/disease-recommendation/', {'disease': 'Anthracnose', 'confidence': 90})
        self.assertEqual(response.status_code, 200)
        self.assertTrue(all(value is None for value in response.json()['environment'].values()))
        self.assertEqual(response.json()['environmental_advice'], [])

    def test_bad_recommendation_payloads_are_client_errors(self):
        for value in ([], {'disease': 3}, {'disease': 'Anthracnose', 'confidence': 'nan'}):
            with self.subTest(value=value):
                self.assertEqual(self.post('/api/disease-recommendation/', value).status_code, 400)
        for value in ([], {'kind': 'environmental', 'payload': 'bad'}, {'kind': 'environmental', 'payload': {'temperature': 'hot'}}):
            with self.subTest(value=value):
                self.assertEqual(self.post('/api/nlp/summary/', value).status_code, 400)


class RecommendationProviderTests(SimpleTestCase):
    def setUp(self):
        self.base = fallback_recommendation('Anthracnose', 90, {}, 'en')

    def provider(self, value):
        response = Mock()
        response.json.return_value = {'output': [{'content': [{'type': 'output_text', 'text': json.dumps(value)}]}]}
        return response

    def test_generated_text_preserves_verified_fields_and_original_fallback(self):
        response = self.provider({'assessment': 'Generated assessment.', 'immediate_actions': ['Inspect affected leaves.'], 'chemical_treatment': {'available': True}, 'severity': {'level': 'Severe'}})
        with patch.dict(os.environ, {'OPENAI_API_KEY': 'test-key'}), patch('requests.post', return_value=response):
            data, used_ai = recommend_with_openai(self.base, None, 'en')
        self.assertTrue(used_ai)
        self.assertEqual(data['source'], 'openai')
        self.assertEqual(data['assessment'], 'Generated assessment.')
        self.assertEqual(data['severity'], self.base['severity'])
        self.assertFalse(data['chemical_treatment']['available'])
        self.assertEqual(self.base['source'], 'fallback')

    def test_invalid_provider_output_keeps_fallback(self):
        for value in ({}, {'assessment': {}, 'immediate_actions': ['Inspect']}, {'assessment': 'Text', 'immediate_actions': [5]}, []):
            with self.subTest(value=value), patch.dict(os.environ, {'OPENAI_API_KEY': 'test-key'}), patch('requests.post', return_value=self.provider(value)):
                data, used_ai = recommend_with_openai(self.base, None, 'en')
                self.assertFalse(used_ai)
                self.assertEqual(data, self.base)

    def test_provider_failure_keeps_fallback(self):
        with patch.dict(os.environ, {'OPENAI_API_KEY': 'test-key'}), patch('requests.post', side_effect=TimeoutError()):
            data, used_ai = recommend_with_openai(self.base, None, 'en')
        self.assertFalse(used_ai)
        self.assertEqual(data, self.base)
