import uuid

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from .consent import CONSENT_VERSION
from .models import ConsentIdentity, UserConsent


@override_settings(CONSENT_GATE_ENABLED=True)
class UserConsentApiTests(TestCase):
	def setUp(self):
		self.client = APIClient()
		self.user = User.objects.create_user(
			username='farmer@example.test',
			email='farmer@example.test',
			password='test-password-123!',
		)
		self.client.force_login(self.user)

	def post_choices(self, research_consent=False, privacy_consent=True, **extra):
		payload = {
			'research_consent': research_consent,
			'privacy_consent': privacy_consent,
			**extra,
		}
		return self.client.post('/api/consent/', payload, format='json')

	def test_status_never_creates_an_accepted_record(self):
		response = self.client.get('/api/consent/')

		self.assertEqual(response.status_code, 200)
		self.assertTrue(response.json()['requiresConsent'])
		self.assertFalse(response.json()['privacyAccepted'])
		self.assertEqual(response.json()['history'], [])
		self.assertFalse(UserConsent.objects.exists())

	def test_acceptance_requires_explicit_boolean_choices(self):
		for payload in (
			{},
			{'research_consent': False, 'privacy_consent': 'true'},
			{'research_consent': 0, 'privacy_consent': True},
			{'research_consent': False, 'privacy_consent': False},
		):
			with self.subTest(payload=payload):
				response = self.client.post('/api/consent/', payload, format='json')
				self.assertEqual(response.status_code, 400)
		self.assertFalse(UserConsent.objects.exists())

	def test_privacy_consent_allows_app_access_without_research_opt_in(self):
		response = self.post_choices(research_consent=False)

		self.assertEqual(response.status_code, 200)
		self.assertTrue(response.json()['privacyAccepted'])
		self.assertFalse(response.json()['researchAccepted'])
		record = UserConsent.objects.get()
		self.assertTrue(record.privacy_consent)
		self.assertFalse(record.research_consent)

	def test_server_sets_identity_version_and_timestamp(self):
		started_at = timezone.now()
		response = self.post_choices(
			research_consent=True,
			user_id=str(uuid.uuid4()),
			consent_version='forged-version',
			agreed_at='2000-01-01T00:00:00Z',
		)

		self.assertEqual(response.status_code, 200)
		record = UserConsent.objects.get()
		identity = ConsentIdentity.objects.get(user=self.user)
		self.assertEqual(record.user_id, identity.pk)
		self.assertEqual(record.consent_version, CONSENT_VERSION)
		self.assertGreaterEqual(record.agreed_at, started_at)
		self.assertLessEqual(record.agreed_at, timezone.now())
		self.assertTrue(record.research_consent)

	def test_old_notice_version_requires_new_privacy_consent(self):
		identity = ConsentIdentity.objects.create(user=self.user)
		UserConsent.objects.create(
			user=identity,
			research_consent=True,
			privacy_consent=True,
			consent_version='previous-version',
			agreed_at=timezone.now(),
		)

		response = self.client.get('/api/consent/')

		self.assertEqual(response.status_code, 200)
		self.assertTrue(response.json()['requiresConsent'])
		self.assertFalse(response.json()['privacyAccepted'])

	def test_changing_research_choice_preserves_auditable_history(self):
		self.assertEqual(self.post_choices(research_consent=True).status_code, 200)
		first_record = UserConsent.objects.get()

		response = self.post_choices(research_consent=False)

		self.assertEqual(response.status_code, 200)
		first_record.refresh_from_db()
		current = UserConsent.objects.get(withdrawn_at__isnull=True)
		self.assertIsNotNone(first_record.withdrawn_at)
		self.assertFalse(current.research_consent)
		self.assertTrue(current.privacy_consent)
		self.assertEqual(UserConsent.objects.count(), 2)

	def test_withdrawal_is_recorded_and_protected_api_access_is_blocked(self):
		self.post_choices(research_consent=True)
		response = self.client.post('/api/consent/withdraw/', {'scope': 'all'}, format='json')

		self.assertEqual(response.status_code, 200)
		self.assertIsNotNone(UserConsent.objects.get().withdrawn_at)
		self.assertTrue(self.client.get('/api/consent/').json()['requiresConsent'])
		self.assertEqual(self.client.get('/api/private/').status_code, 403)

	def test_protected_api_access_is_denied_until_privacy_consent(self):
		response = self.client.get('/api/private/')
		self.assertEqual(response.status_code, 403)
		self.assertTrue(response.json()['consentRequired'])

		self.post_choices()
		self.assertEqual(self.client.get('/api/private/').status_code, 404)

	def test_user_can_only_read_own_consent_and_staff_can_list_records(self):
		self.post_choices()
		other = User.objects.create_user(
			username='other@example.test',
			email='other@example.test',
			password='test-password-123!',
		)
		other_identity = ConsentIdentity.objects.create(user=other)
		UserConsent.objects.create(
			user=other_identity,
			research_consent=True,
			privacy_consent=True,
			consent_version=CONSENT_VERSION,
			agreed_at=timezone.now(),
		)

		self.assertEqual(len(self.client.get('/api/consent/').json()['history']), 1)
		admin = User.objects.create_superuser(
			username='admin@example.test',
			email='admin@example.test',
			password='test-password-123!',
		)
		self.client.force_login(admin)
		response = self.client.get('/api/admin/consents/')
		self.assertEqual(response.status_code, 200)
		self.assertEqual(len(response.json()['results']), 2)
