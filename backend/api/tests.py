from django.test import SimpleTestCase
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIRequestFactory
from unittest.mock import patch
import io
import numpy as np
from PIL import Image

from api import views
from api.views import _normalize_rambutan_label, _normalize_leaf_label


class Yolo11nIntegrationTests(SimpleTestCase):
    def test_rambutan_label_mapping(self):
        self.assertEqual(_normalize_rambutan_label('ripe'), 'mature')
        self.assertEqual(_normalize_rambutan_label('unripe'), 'immature')
        self.assertEqual(_normalize_rambutan_label('overripe'), 'mature')
        self.assertEqual(_normalize_rambutan_label('class_1'), 'mature')

    def test_leaf_label_mapping(self):
        self.assertEqual(_normalize_leaf_label('healthy'), 'Healthy Leaf')
        self.assertEqual(_normalize_leaf_label('powdery mildew'), 'Powdery Mildew')
        self.assertEqual(_normalize_leaf_label('anthracnose'), 'Anthracnose')


class ClassifierPredictionTests(SimpleTestCase):
    def setUp(self):
        for check in ('verify_rambutan', 'verify_leaf'):
            verifier = patch.object(views, check, return_value={'verified': True})
            verifier.start()
            self.addCleanup(verifier.stop)

    def request(self, color=(20, 160, 20)):
        image = io.BytesIO()
        Image.new('RGB', (40, 40), color).save(image, format='PNG')
        upload = SimpleUploadedFile('leaf.png', image.getvalue(), content_type='image/png')
        return APIRequestFactory().post('/predict/', {'image': upload}, format='multipart')

    def model(self, names, index=0, probabilities=None):
        class FakeModel:
            input_shape = (None, 32, 32, 3)
            _class_names = names

            def predict(inner, batch):
                self.assertEqual(batch.shape, (1, 32, 32, 3))
                self.assertGreaterEqual(float(batch.min()), 0.0)
                self.assertLessEqual(float(batch.max()), 1.0)
                if probabilities is not None:
                    return np.asarray([probabilities], dtype=np.float32)
                result = np.zeros((1, len(names)), dtype=np.float32)
                result[0, index] = 1.0
                return result

        return FakeModel()

    def test_binary_rambutan_uses_saved_order_for_both_labels(self):
        names = ['mature', 'immature']
        for index, label in enumerate(names):
            with self.subTest(label=label), patch.object(views, '_rambutan_model', self.model(names, index)), patch.object(views.Prediction.objects, 'create'):
                response = views.predict_rambutan(self.request())
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.data['label'], label)
                self.assertEqual(response.data['class_names'], names)

    def test_uncertain_binary_predictions_are_not_called_non_fruit(self):
        names = ['mature', 'immature']
        for probabilities in ([0.5, 0.5], [0.59, 0.41], [0.41, 0.59]):
            with self.subTest(probabilities=probabilities), patch.object(views, '_rambutan_model', self.model(names, probabilities=probabilities)), patch.object(views.Prediction.objects, 'create') as save:
                response = views.predict_rambutan(self.request())
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.data['label'], 'unknown')
                save.assert_not_called()
                self.assertIn('uncertain', response.data['message'])

    def test_explicit_non_fruit_class_is_preserved_for_legacy_models(self):
        names = ['not_rambutan', 'ripe', 'unripe', 'overripe']
        with patch.object(views, '_rambutan_model', self.model(names)), patch.object(views.Prediction.objects, 'create'):
            response = views.predict_rambutan(self.request())
            self.assertEqual(response.data['label'], 'not_rambutan')

    def test_invalid_probabilities_are_not_saved_as_predictions(self):
        cases = [('_rambutan_model', views.predict_rambutan, ['mature', 'immature']),
                 ('_leaf_model', views.predict_leaf, ['healthy', 'anthracnose'])]
        for attribute, endpoint, names in cases:
            with self.subTest(endpoint=attribute), patch.object(views, attribute, self.model(names, probabilities=[float('nan'), 0.5])), patch.object(views, '_leaf_likeness_score', return_value=1.0), patch.object(views.Prediction.objects, 'create') as save:
                response = endpoint(self.request())
                self.assertEqual(response.status_code, 500)
                self.assertEqual(response.data['error'], 'Prediction failed')
                save.assert_not_called()

    def test_leaf_uses_new_four_class_order(self):
        names = ['algal leaf spot', 'anthracnose', 'healthy', 'sooty mold']
        with patch.object(views, '_leaf_model', self.model(names, 2)), patch.object(views, '_leaf_likeness_score', return_value=1.0), patch.object(views.Prediction.objects, 'create'):
            response = views.predict_leaf(self.request())
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.data['label'], 'Healthy Leaf')
            self.assertEqual(response.data['class_names'], names)

    def test_brown_leaf_reaches_model_instead_of_color_rejection(self):
        names = ['algal leaf spot', 'anthracnose', 'healthy', 'sooty mold']
        with patch.object(views, '_leaf_model', self.model(names, 1)), patch.object(views.Prediction.objects, 'create'):
            response = views.predict_leaf(self.request(color=(120, 70, 35)))
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.data['label'], 'Anthracnose')

    def test_low_confidence_brown_image_requests_a_clearer_photo(self):
        names = ['algal leaf spot', 'anthracnose', 'healthy', 'sooty mold']
        with patch.object(views, '_leaf_model', self.model(names, probabilities=[0.1, 0.5, 0.2, 0.2])), patch.object(views.Prediction.objects, 'create'):
            response = views.predict_leaf(self.request(color=(120, 70, 35)))
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.data['label'], 'unknown')

    def test_missing_or_invalid_image_remains_a_bad_request(self):
        factory = APIRequestFactory()
        requests = [factory.post('/api/predict_leaf/', {}, format='multipart'),
                    factory.post('/api/predict_leaf/', {'image': SimpleUploadedFile('bad.jpg', b'not an image')}, format='multipart')]
        for request in requests:
            with self.subTest(request=request), patch.object(views.Prediction.objects, 'create') as save:
                response = views.predict_leaf(request)
                self.assertEqual(response.status_code, 400)
                self.assertIn('error', response.data)
                save.assert_not_called()
