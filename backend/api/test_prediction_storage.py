import io
from unittest.mock import Mock, patch

import numpy as np
from PIL import Image
from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import connections, DatabaseError
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from api.models import Prediction
from api.prediction_storage import save_prediction, sync_prediction


@override_settings(PREDICTION_SYNC_DATABASE='prediction_cloud', PREDICTION_SYNC_NAMESPACE='07b5a45c-2c4f-4b81-9cb1-92b2ce9f64c6')
class PredictionStorageTests(TestCase):
    databases = {'default', 'prediction_cloud'}

    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user('local-farmer', email='farmer@example.test')
        # A matching numeric ID in another auth database is a different person.
        User.objects.using('prediction_cloud').create(pk=cls.user.pk, username='unrelated-cloud-user')
        with connections['prediction_cloud'].cursor() as cursor:
            cursor.execute('ALTER TABLE api_prediction ADD COLUMN source_key text NULL')
            cursor.execute('ALTER TABLE api_prediction ADD COLUMN source_user_id integer NULL')
            cursor.execute('CREATE UNIQUE INDEX api_prediction_source_key_unique ON api_prediction (source_key)')

    def values(self, kind='leaf'):
        return dict(user=self.user, prediction_type=kind, label='Healthy Leaf' if kind == 'leaf' else 'mature',
                    confidence=.95, image_name='scan.png', raw_probs='[0.05, 0.95]')

    def test_leaf_and_fruit_save_to_both_databases_without_cross_linking_accounts(self):
        for kind in ('leaf', 'rambutan'):
            result = save_prediction(**self.values(kind))
            self.assertTrue(result['saved'])
            self.assertTrue(result['cloud_saved'])
            local = Prediction.objects.get(pk=result['prediction_id'])
            cloud = Prediction.objects.using('prediction_cloud').get(pk=result['cloud_prediction_id'])
            self.assertEqual(local.user_id, self.user.pk)
            self.assertIsNone(cloud.user_id)
            self.assertEqual(local.created_at, cloud.created_at)
            self.assertEqual(local.label, cloud.label)
            with connections['prediction_cloud'].cursor() as cursor:
                cursor.execute('SELECT source_user_id FROM api_prediction WHERE id = %s', [cloud.pk])
                self.assertEqual(cursor.fetchone()[0], self.user.pk)

    def test_retry_and_corrections_update_the_same_cloud_record(self):
        existing = Prediction.objects.using('prediction_cloud').create(prediction_type='leaf', label='Older scan', confidence=.8)
        local = Prediction.objects.create(**self.values())
        first_id = sync_prediction(local)
        local.label = 'Anthracnose'
        local.save(update_fields=['label'])
        self.assertEqual(sync_prediction(local), first_id)
        self.assertEqual(Prediction.objects.using('prediction_cloud').count(), 2)
        self.assertEqual(Prediction.objects.using('prediction_cloud').get(pk=first_id).label, 'Anthracnose')
        self.assertEqual(Prediction.objects.using('prediction_cloud').get(pk=existing.pk).label, 'Older scan')

    def test_anonymous_history_is_not_assigned_to_any_account(self):
        values = self.values()
        values['user'] = None
        result = save_prediction(**values)
        with connections['prediction_cloud'].cursor() as cursor:
            cursor.execute('SELECT user_id, source_user_id FROM api_prediction WHERE id = %s', [result['cloud_prediction_id']])
            self.assertEqual(cursor.fetchone(), (None, None))

    def test_cloud_failure_keeps_local_history_and_reports_unsynced_status(self):
        with patch('api.prediction_storage.sync_prediction', side_effect=DatabaseError('offline')), self.assertLogs('api.prediction_storage', level='ERROR'):
            result = save_prediction(**self.values())
        self.assertTrue(result['saved'])
        self.assertFalse(result['cloud_saved'])
        local = Prediction.objects.get(pk=result['prediction_id'])
        self.assertIsNotNone(sync_prediction(local))

    def test_local_save_failure_is_not_reported_as_saved(self):
        with patch.object(Prediction.objects, 'create', side_effect=DatabaseError('offline')), patch('api.prediction_storage.sync_prediction') as sync, self.assertLogs('api.prediction_storage', level='ERROR'):
            result = save_prediction(**self.values())
        self.assertFalse(result['saved'])
        sync.assert_not_called()

    def test_accepted_scan_endpoints_return_confirmed_storage_status(self):
        client = APIClient()
        client.force_authenticate(self.user)
        for kind, classes in [('leaf', ['healthy', 'anthracnose']), ('rambutan', ['mature', 'immature'])]:
            data = io.BytesIO()
            Image.new('RGB', (32, 32), (20, 160, 20)).save(data, format='PNG')
            model = Mock(input_shape=(None, 32, 32, 3), _class_names=classes)
            model.predict.return_value = np.array([[.99, .01]])
            with patch(f'api.views.verify_{kind}', return_value={'verified': True}), patch(f'api.views._{kind}_model', model):
                response = client.post(f'/api/predict_{kind}/', {'image': SimpleUploadedFile('scan.png', data.getvalue())}, format='multipart')
            self.assertEqual(response.status_code, 200)
            self.assertTrue(response.json()['storage']['cloud_saved'])
        self.assertEqual(Prediction.objects.filter(user=self.user).count(), 2)
        self.assertEqual(Prediction.objects.using('prediction_cloud').count(), 2)
