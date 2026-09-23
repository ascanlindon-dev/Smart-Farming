import io
from unittest.mock import Mock, patch

import numpy as np
from PIL import Image
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import SimpleTestCase
from rest_framework.test import APIRequestFactory

from api import views
import image_verifier
from leaf_guard import verify_leaf, assess_similarities, LEAF_DESCRIPTIONS, OTHER_DESCRIPTIONS
from rambutan_guard import verify_rambutan
from image_verifier import VerifierUnavailable


class LeafGuardTests(SimpleTestCase):
    def request(self, color=(20, 160, 20), content=None):
        if content is None:
            buffer = io.BytesIO()
            Image.new('RGB', (64, 64), color).save(buffer, format='PNG')
            content = buffer.getvalue()
        return APIRequestFactory().post('/api/predict_leaf/', {
            'image': SimpleUploadedFile('photo.png', content, content_type='image/png'),
        }, format='multipart')

    def test_green_object_cannot_bypass_leaf_check_with_high_disease_confidence(self):
        model = Mock()
        model.predict.return_value = np.array([[0.99, 0.01]])
        with patch.object(views, 'verify_leaf', return_value={'verified': False}), patch.object(views, '_leaf_model', model), patch.object(views.Prediction.objects, 'create') as save:
            response = views.predict_leaf(self.request())
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['type'], 'not_leaf')
        self.assertEqual(response.data['label'], 'not_leaf')
        self.assertFalse(response.data['leaf_verified'])
        self.assertIsNone(response.data['confidence'])
        self.assertNotIn('raw_probs', response.data)
        model.predict.assert_not_called()
        save.assert_not_called()

    def test_unavailable_verifier_does_not_bypass_leaf_check(self):
        with patch.object(views, 'verify_leaf', side_effect=VerifierUnavailable()), patch.object(views, '_leaf_model') as model, patch.object(views.Prediction.objects, 'create') as save:
            response = views.predict_leaf(self.request())
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.data['code'], 'leaf_verifier_unavailable')
        model.predict.assert_not_called()
        save.assert_not_called()

    def test_invalid_image_is_rejected_before_verification(self):
        with patch.object(views, 'verify_leaf') as verify:
            response = views.predict_leaf(self.request(content=b'not an image'))
        self.assertEqual(response.status_code, 400)
        verify.assert_not_called()

    def test_verified_brown_leaf_can_reach_disease_classification(self):
        model = Mock(input_shape=(None, 32, 32, 3), _class_names=['healthy', 'anthracnose'])
        model.predict.return_value = np.array([[0.01, 0.99]])
        with patch.object(views, 'verify_leaf', return_value={'verified': True}), patch.object(views, '_leaf_model', model), patch.object(views.Prediction.objects, 'create') as save:
            response = views.predict_leaf(self.request(color=(120, 70, 35)))
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['leaf_verified'])
        self.assertEqual(response.data['label'], 'Anthracnose')
        save.assert_called_once()

    def test_uncertain_disease_is_not_saved_as_a_diagnosis(self):
        model = Mock(input_shape=(None, 32, 32, 3), _class_names=['healthy', 'anthracnose'])
        model.predict.return_value = np.array([[0.5, 0.5]])
        with patch.object(views, 'verify_leaf', return_value={'verified': True}), patch.object(views, '_leaf_model', model), patch.object(views.Prediction.objects, 'create') as save:
            response = views.predict_leaf(self.request(color=(120, 70, 35)))
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['leaf_verified'])
        self.assertEqual(response.data['label'], 'unknown')
        save.assert_not_called()

    def test_similarity_requires_clear_leaf_evidence(self):
        size = len(LEAF_DESCRIPTIONS) + len(OTHER_DESCRIPTIONS)
        for positive, negative, accepted in [(0.35, 0.28, True), (0.35, 0.37, False),
                                            (0.35, 0.34, False), (0.20, 0.10, False)]:
            with self.subTest(positive=positive, negative=negative):
                scores = np.full(size, negative)
                scores[:len(LEAF_DESCRIPTIONS)] = 0.1
                scores[0] = positive
                self.assertEqual(assess_similarities(scores)['verified'], accepted)

    def test_invalid_verifier_output_cannot_pass(self):
        size = len(LEAF_DESCRIPTIONS) + len(OTHER_DESCRIPTIONS)
        for scores in [[0.99], [float('nan')] * size, [float('inf')] * size]:
            with self.assertRaises(VerifierUnavailable):
                assess_similarities(scores)

    def test_leaf_and_fruit_checks_share_one_loaded_encoder(self):
        encoder = Mock()

        def scores(image, descriptions):
            values = np.full(len(descriptions), 0.1)
            values[0] = 0.4
            return values

        encoder.compare.side_effect = scores
        with patch.object(image_verifier, '_verifier', None), patch.object(image_verifier, 'ImageVerifier', return_value=encoder) as factory:
            self.assertTrue(verify_leaf(Image.new('RGB', (64, 64)))['verified'])
            self.assertTrue(verify_rambutan(Image.new('RGB', (64, 64)))['verified'])
        factory.assert_called_once()
        self.assertEqual(encoder.compare.call_count, 2)
