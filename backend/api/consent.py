from contextlib import contextmanager

from django.conf import settings
from django.db import connection, transaction
from django.http import JsonResponse

from .models import ConsentIdentity, UserConsent


CONSENT_VERSION = '2026-11-21-v1'
CONSENT_RLS_ROLE = 'rambutech_consent_api'


def consent_identity_for(user):
	return ConsentIdentity.objects.get_or_create(user=user)[0]


@contextmanager
def consent_database_scope(user, identity=None):
	identity = identity or consent_identity_for(user)
	with transaction.atomic():
		if connection.vendor == 'postgresql':
			with connection.cursor() as cursor:
				cursor.execute(f'SET LOCAL ROLE {CONSENT_RLS_ROLE}')
				cursor.execute(
					"SELECT set_config('app.rambutech_user_id', %s, true)",
					[str(identity.pk)],
				)
				cursor.execute(
					"SELECT set_config('app.rambutech_is_admin', %s, true)",
					['true' if user.is_staff else 'false'],
				)
		yield identity


def current_consent_for(user, identity=None):
	identity = identity or consent_identity_for(user)
	with consent_database_scope(user, identity):
		return (
			UserConsent.objects
			.filter(user_id=identity.pk, withdrawn_at__isnull=True)
			.order_by('-agreed_at')
			.first()
		)


def has_current_privacy_consent(user):
	record = current_consent_for(user)
	return bool(
		record
		and record.privacy_consent
		and record.consent_version == CONSENT_VERSION
	)


def has_current_research_consent(user):
	record = current_consent_for(user)
	return bool(
		record
		and record.privacy_consent
		and record.research_consent
		and record.consent_version == CONSENT_VERSION
	)


class ConsentGateMiddleware:
	def __init__(self, get_response):
		self.get_response = get_response

	def __call__(self, request):
		if (
			settings.CONSENT_GATE_ENABLED
			and request.path.startswith('/api/')
			and getattr(request.user, 'is_authenticated', False)
			and not self._is_exempt(request.path, request.method)
			and not has_current_privacy_consent(request.user)
		):
			return JsonResponse(
				{
					'error': 'consent_required',
					'consentRequired': True,
					'message': 'Accept the current Data Privacy Notice before using the system.',
				},
				status=403,
			)
		return self.get_response(request)

	@staticmethod
	def _is_exempt(path, method):
		path = path.rstrip('/')
		exact = {
			'/api/admin/consents',
			'/api/auth/google',
			'/api/consent',
			'/api/consent/withdraw',
			'/api/csrf',
			'/api/logout',
			'/api/login',
			'/api/ping',
			'/api/signup',
			'/api/me',
		}
		if path in exact:
			return path != '/api/me' or method == 'GET'
		return path.startswith(('/api/otp/', '/api/password_reset/'))
