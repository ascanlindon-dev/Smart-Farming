from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient


class PasswordLoginTests(TestCase):
    def setUp(self):
        self.client = APIClient(enforce_csrf_checks=True)
        self.user = User.objects.create_user(
            username='farm-owner', email='farmer@example.test', password='pass With Spaces 947! ',
        )

    def post(self, payload):
        token = self.client.get('/api/csrf/').json()['csrfToken']
        return self.client.post('/api/login', payload, format='json', HTTP_X_CSRFTOKEN=token)

    def test_email_case_and_surrounding_spaces_do_not_prevent_login(self):
        response = self.post({'identifier': '  FARMER@EXAMPLE.TEST  ', 'password': 'pass With Spaces 947! '})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.client.get('/api/me/').json()['email'], self.user.email)

    def test_exact_username_still_works(self):
        response = self.post({'identifier': self.user.username, 'password': 'pass With Spaces 947! '})
        self.assertEqual(response.status_code, 200)

    def test_incorrect_password_does_not_create_a_session(self):
        for password in ('wrong-password', 'pass With Spaces 947!'):
            response = self.post({'identifier': self.user.email, 'password': password})
            self.assertEqual(response.status_code, 400)
            self.assertEqual(response.json()['error'], 'Incorrect email or password.')
            self.assertEqual(self.client.get('/api/me/').status_code, 403)

    def test_malformed_credentials_return_a_clear_validation_error(self):
        for payload in ([], {}, {'identifier': ' ', 'password': 'secret'},
                        {'identifier': [], 'password': 'secret'},
                        {'identifier': self.user.email, 'password': {}},
                        {'identifier': self.user.email, 'password': ''}):
            with self.subTest(payload=payload):
                response = self.post(payload)
                self.assertEqual(response.status_code, 400)
                self.assertEqual(response.json()['error'], 'Email and password are required.')

    @patch('api.views.create_and_send_otp', return_value=(True, None))
    def test_unverified_accounts_still_require_email_verification(self, send_otp):
        self.user.is_active = False
        self.user.save(update_fields=['is_active'])
        response = self.post({'identifier': self.user.email.upper(), 'password': 'pass With Spaces 947! '})
        self.assertEqual(response.status_code, 403)
        self.assertTrue(response.json()['verificationRequired'])
        send_otp.assert_called_once_with(self.user.email, 'signup')
        self.assertEqual(self.client.get('/api/me/').status_code, 403)

    @patch('api.views.id_token.verify_oauth2_token')
    def test_google_login_uses_existing_account_and_creates_a_session(self, verify_token):
        verify_token.return_value = {'email': self.user.email, 'email_verified': True, 'name': 'Farm owner'}
        token = self.client.get('/api/csrf/').json()['csrfToken']
        response = self.client.post('/api/auth/google/', {'credential': 'test-verified-token'}, format='json', HTTP_X_CSRFTOKEN=token)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(User.objects.count(), 1)
        self.assertEqual(self.client.get('/api/me/').json()['email'], self.user.email)

    @patch('api.views.id_token.verify_oauth2_token', side_effect=ValueError('Invalid token'))
    def test_invalid_google_token_cannot_sign_in(self, verify_token):
        token = self.client.get('/api/csrf/').json()['csrfToken']
        response = self.client.post('/api/auth/google/', {'credential': 'invalid'}, format='json', HTTP_X_CSRFTOKEN=token)
        self.assertEqual(response.status_code, 401)
        self.assertEqual(self.client.get('/api/me/').status_code, 403)
