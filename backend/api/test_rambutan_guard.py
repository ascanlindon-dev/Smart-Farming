import io
from unittest.mock import Mock, patch

import numpy as np
from PIL import Image
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import SimpleTestCase
from rest_framework.test import APIRequestFactory

from api import views
from rambutan_guard import assess_similarities, RAMBUTAN_DESCRIPTIONS, OTHER_DESCRIPTIONS, VerifierUnavailable


class RambutanGuardTests(SimpleTestCase):
    def request(self, content=None):
        if content is None:
            buffer = io.BytesIO()
            Image.new('RGB', (64, 64), 'red').save(buffer, format='PNG')
            content = buffer.getvalue()
        return APIRequestFactory().post('/api/predict_rambutan/', {
            'image': SimpleUploadedFile('photo.png', content, content_type='image/png'),
        }, format='multipart')

    def test_non_rambutan_never_reaches_maturity_or_history(self):
        # Even a maturity model that would report 99% ripe must not run.
        model = Mock()
        model.predict.return_value = np.array([[0.99, 0.01]])
        with patch.object(views, 'verify_rambutan', return_value={'verified': False}), patch.object(views, '_rambutan_model', model), patch.object(views.Prediction.objects, 'create') as save:
            response = views.predict_rambutan(self.request())
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['label'], 'not_rambutan')
        self.assertFalse(response.data['rambutan_verified'])
        self.assertIsNone(response.data['confidence'])
        model.predict.assert_not_called()
        save.assert_not_called()

    def test_unavailable_verifier_does_not_bypass_object_check(self):
        with patch.object(views, 'verify_rambutan', side_effect=VerifierUnavailable()), patch.object(views, '_rambutan_model') as model, patch.object(views.Prediction.objects, 'create') as save:
            response = views.predict_rambutan(self.request())
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.data['code'], 'fruit_verifier_unavailable')
        model.predict.assert_not_called()
        save.assert_not_called()

    def test_invalid_image_is_rejected_before_verification(self):
        with patch.object(views, 'verify_rambutan') as verify:
            response = views.predict_rambutan(self.request(b'not an image'))
        self.assertEqual(response.status_code, 400)
        verify.assert_not_called()

    def test_rambutan_must_beat_competing_objects_with_sufficient_similarity(self):
        size = len(RAMBUTAN_DESCRIPTIONS) + len(OTHER_DESCRIPTIONS)
        for positive, negative, expected in [(0.35, 0.28, True), (0.35, 0.37, False),
                                              (0.35, 0.34, False), (0.2, 0.1, False)]:
            with self.subTest(positive=positive, negative=negative):
                values = np.full(size, negative)
                values[0] = positive
                values[1:len(RAMBUTAN_DESCRIPTIONS)] = 0.1
                self.assertEqual(assess_similarities(values)['verified'], expected)

    def test_invalid_verifier_output_is_not_accepted(self):
        for values in [[0.9], [float('nan')] * (len(RAMBUTAN_DESCRIPTIONS) + len(OTHER_DESCRIPTIONS))]:
            with self.assertRaises(VerifierUnavailable):
                assess_similarities(values)
