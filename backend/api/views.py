# views.py
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.response import Response
from rest_framework import status

from django.contrib.auth import authenticate, login as auth_login, logout as auth_logout, update_session_auth_hash
from django.middleware.csrf import get_token
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.conf import settings
from django.shortcuts import redirect
from django.contrib.auth.models import User
from django.utils import timezone

from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse

from pathlib import Path
import json
import logging
import os
import re
import math
import secrets
import uuid
from collections import defaultdict
from datetime import timedelta, datetime

import numpy as np
from model_metadata import load_model_classes
from prediction_checks import validate_probabilities
from rambutan_guard import verify_rambutan, VerifierUnavailable
from leaf_guard import verify_leaf

from .models import (
	ConsentIdentity,
	Farmer,
	Prediction,
	SensorReading,
	UserConsent,
	WeatherCache,
)
from .consent import (
	CONSENT_VERSION,
	consent_database_scope,
	consent_identity_for,
)
from .weather_forecast import condition_for_code
from django.utils import timezone
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from .recommendations import fallback_recommendation, recommend_with_openai
from .sensor_data import current_reading, validate_telemetry
from .otp_utils import create_and_send_otp, verify_otp_code
from .prediction_storage import save_prediction, prediction_storage_status
from .hosting_permissions import HostedAccountRequired

BASE_DIR = Path(__file__).resolve().parents[1]
FARM_WEATHER_TIMEZONE = 'Asia/Manila'
logger = logging.getLogger(__name__)


def _normalize_rambutan_label(label):
	"""Map generic labels to the app's immature/mature readiness values."""
	if label is None:
		return 'unknown'
	text = str(label).strip().lower().replace(' ', '_')
	mapping = {
		'0': 'immature',
		'1': 'mature',
		'class_0': 'immature',
		'class_1': 'mature',
		'immature': 'immature',
		'mature': 'mature',
		# backward compatibility with the previous unripe/ripe/overripe scheme
		'unripe': 'immature',
		'ripe': 'mature',
		'overripe': 'mature',
		'nearly_ripe': 'mature',
		'nearly-ripe': 'mature',
		'ready': 'mature',
		'healthy': 'mature',
		'good': 'mature',
	}
	return mapping.get(text, text)


def _normalize_leaf_label(label):
	"""Normalize generic class labels to the app's leaf disease names."""
	if label is None:
		return 'unknown'
	text = str(label).strip()
	mapping = {
		'healthy': 'Healthy Leaf',
		'healthy_leaf': 'Healthy Leaf',
		'healthy leaf': 'Healthy Leaf',
		'powdery_mildew': 'Powdery Mildew',
		'powdery mildew': 'Powdery Mildew',
		'leaf_curl': 'Leaf Curl',
		'leaf curl': 'Leaf Curl',
		'leafcurl': 'Leaf Curl',
		'anthracnose': 'Anthracnose',
		'sooty_mold': 'Sooty Mold',
		'sooty mold': 'Sooty Mold',
		'algal_leaf_spot': 'Algal Leaf Spot (Black Spots)',
		'algal leaf spot': 'Algal Leaf Spot (Black Spots)',
		'algal_leaf': 'Algal Leaf Spot (Black Spots)',
	}
	normalized = mapping.get(text.lower(), text)
	return normalized if normalized else 'unknown'


def _fallback_rainfall_recommendation(rainfall_summary):
	insights = rainfall_summary.get('insights') or []
	patterns = rainfall_summary.get('patterns') or []
	items = insights + patterns
	if not items:
		return 'Not enough rainfall history yet to generate a recommendation.'
	return ' '.join(items[:3])


def _generate_rainfall_ai_recommendation(rainfall_summary):
	api_key = os.environ.get('OPENAI_API_KEY')
	if not api_key:
		return _fallback_rainfall_recommendation(rainfall_summary), False

	try:
		import requests

		prompt = (
			"You are an agricultural assistant for farmers. "
			"Write a short rainfall-based recommendation in 2 to 3 sentences, plain English, farmer-friendly. "
			"Use the data exactly as given. Mention if conditions are good, dry, or too wet, and give one practical action.\n\n"
			f"Rainfall summary: {json.dumps(rainfall_summary)}"
		)

		response = requests.post(
			'https://api.openai.com/v1/responses',
			headers={
				'Authorization': f'Bearer {api_key}',
				'Content-Type': 'application/json',
			},
			json={
				'model': 'gpt-4.1-mini',
				'input': prompt,
				'max_output_tokens': 140,
			},
			timeout=15,
		)
		response.raise_for_status()
		payload = response.json()

		output_text = ''
		for item in payload.get('output', []):
			for content in item.get('content', []):
				if content.get('type') == 'output_text':
					output_text += content.get('text', '')

		output_text = output_text.strip()
		if output_text:
			return output_text, True
	except Exception:
		pass

	return _fallback_rainfall_recommendation(rainfall_summary), False


def _fallback_nlp_summary(kind, payload):
	language = (payload.get('language') or 'en').lower()
	is_tl = language == 'tl'

	if kind == 'environmental':
		temperature = payload.get('temperature')
		humidity = payload.get('humidity')
		rainfall = payload.get('rainfall')

		parts = []
		if temperature is not None:
			if temperature >= 35:
				parts.append('Masyadong mainit ngayon, kaya iwasan muna ang mabigat na trabaho sa tanghali at bantayan ang heat stress ng mga tanim.' if is_tl else 'Temperature is very high, so avoid heavy field work at midday and protect crops from heat stress.')
			elif temperature >= 31:
				parts.append('Mainit ang panahon ngayon, kaya bantayan ang halumigmig ng lupa at kondisyon ng rambutan.' if is_tl else 'Temperature is warm today, so monitor soil moisture and rambutan tree condition.')
			else:
				parts.append('Maayos ang temperatura at pwede ang normal na gawain sa bukid.' if is_tl else 'Temperature is within a manageable range for routine farm work.')
		if humidity is not None:
			if humidity >= 80:
				parts.append('Mataas ang humidity ngayon at puwedeng tumaas ang chance ng fungal disease.' if is_tl else 'Humidity is high and may increase fungal disease pressure.')
			elif humidity >= 75:
				parts.append('Medyo mataas ang humidity, kaya siguraduhing maayos ang airflow sa paligid ng mga halaman.' if is_tl else 'Humidity is slightly elevated, so keep airflow around the plants as open as possible.')
			else:
				parts.append('Okay ang humidity at manageable ito para sa karamihan ng tanim.' if is_tl else 'Humidity looks balanced for most crop conditions.')
		if rainfall is not None:
			if rainfall >= 20:
				parts.append('Malakas ang ulan, kaya ipagpaliban muna ang pag-spray at bantayan kung sobrang basa ang lupa.' if is_tl else 'Rainfall is heavy, so postpone spraying and watch for waterlogging.')
			elif rainfall > 0:
				parts.append('May kaunting ulan, kaya planuhin nang mabuti ang field activities.' if is_tl else 'Light rainfall is present, so field activities should be timed carefully.')
			else:
				parts.append('Walang naitalang ulan ngayon, kaya obserbahan ang lupa at mga senyales ng pagkatuyo ng rambutan.' if is_tl else 'No rainfall is recorded right now, so observe the soil and watch for signs of rambutan dryness.')
		return ' '.join(parts) if parts else ('Wala pang sapat na live environmental data para makagawa ng malinaw na buod.' if is_tl else 'Not enough live environmental data yet to generate a summary.')

	if kind == 'historical':
		summary = payload.get('summary') or {}
		rainfall_summary = payload.get('rainfallSummary') or {}
		leaf_summary = payload.get('leafSummary') or {}
		fruit_summary = payload.get('fruitSummary') or {}
		range_label = payload.get('rangeLabel') or 'selected period'

		parts = []
		avg_temp = summary.get('avgTemperature')
		if avg_temp is not None:
			if avg_temp > 30:
				parts.append(f'Sa {range_label.lower()}, medyo mas mataas ang temperatura kaysa sa normal na target range.' if is_tl else f'For the {range_label.lower()}, temperature stayed slightly above the usual target range.')
			else:
				parts.append(f'Sa {range_label.lower()}, nasa maayos na range ang temperatura.' if is_tl else f'For the {range_label.lower()}, temperature stayed in a generally acceptable range.')
		total_rain = rainfall_summary.get('totalRainfall')
		if total_rain is not None:
			if total_rain >= 80:
				parts.append('Malakas ang ulan sa period na ito, kaya puwedeng manatiling sobrang basa ang bukid at tumaas ang disease risk.' if is_tl else 'Rainfall was heavy, which can keep the field too wet and raise disease risk.')
			elif total_rain >= 30:
				parts.append('Katamtaman ang ulan at generally okay ito para sa paglaki ng pananim.' if is_tl else 'Rainfall was moderate and generally supportive for crop growth.')
			else:
				parts.append('Mahina ang ulan sa period na ito, kaya mas mahalaga ang regular na pagmamanman sa kondisyon ng bukid.' if is_tl else 'Rainfall stayed light during this period, so regular farm condition monitoring remains important.')
		if leaf_summary.get('topLabel'):
			parts.append(f"Sa leaf detection, ang pinakakaraniwang result ay {leaf_summary.get('topLabel')}." if is_tl else f"The most common leaf detection result was {leaf_summary.get('topLabel')}.")
		if fruit_summary.get('topLabel'):
			parts.append(f"Sa fruit maturity, ang pinakakaraniwang result ay {fruit_summary.get('topLabel')}." if is_tl else f"The most common fruit maturity result was {fruit_summary.get('topLabel')}.")
		return ' '.join(parts) if parts else ('Wala pang sapat na historical data para makagawa ng buod.' if is_tl else 'Not enough historical data yet to generate a summary.')

	if kind == 'leaf_detection':
		disease = payload.get('disease') or payload.get('label') or 'unknown'
		confidence = payload.get('confidence')
		if str(disease).lower() == 'unknown':
			return 'Mukhang dahon ang larawan, pero mababa pa ang confidence ng model para matukoy nang maayos ang sakit. Subukan ulit gamit ang mas malinaw na picture na may kita ang sintomas at maayos ang ilaw.' if is_tl else 'The image appears to be a leaf, but the model is not yet confident enough to give a reliable disease name. Capture a clearer photo with visible symptoms and even lighting.'
		base = f'Nakita ng model na posibleng {disease} ito' if is_tl else f'The model detected {disease}'
		if confidence is not None:
			base += f' na may mga {confidence}% confidence' if is_tl else f' with about {confidence}% confidence'
		base += '.'
		return f'{base} Tingnan ang recommended treatment steps sa ibaba, alisin ang mga dahong matindi ang tama kung kailangan, at bantayan din ang mga katabing halaman para sa kaparehong sintomas.' if is_tl else f'{base} Review the recommended treatment steps below, remove heavily affected leaves if needed, and continue monitoring nearby plants for similar symptoms.'

	if kind == 'fruit_maturity':
		stage = payload.get('stage') or payload.get('label') or 'unknown'
		confidence = payload.get('confidence')
		if str(stage).lower() in ['not classified', 'not_rambutan', 'unknown']:
			return 'Hindi matiyak ng system kung rambutan fruit ang nasa larawan. Subukan ulit gamit ang mas malapit at mas malinaw na photo sa natural light.' if is_tl else 'The image was not confidently recognized as a rambutan fruit. Try again with a closer and clearer fruit photo under natural light.'
		base = f'Mukhang nasa {stage.lower()} stage ang prutas' if is_tl else f'The fruit appears to be at the {stage.lower()} stage'
		if confidence is not None:
			base += f' na may mga {confidence}% confidence' if is_tl else f' with about {confidence}% confidence'
		base += '.'
		return f'{base} Gamitin ang harvest at storage guidance sa ibaba para makapagdesisyon kung maghihintay pa, mag-aani na ngayon, o agad itong ilalabas sa market.' if is_tl else f'{base} Use the harvest and storage guidance below to decide whether to wait, harvest now, or move the fruit quickly to market.'

	return 'Wala pang NLP summary para sa request na ito.' if is_tl else 'No NLP summary is available for this request yet.'


def _generate_nlp_summary(kind, payload):
	api_key = os.environ.get('OPENAI_API_KEY')
	fallback_text = _fallback_nlp_summary(kind, payload)
	language = (payload.get('language') or 'en').lower()
	output_language = 'simple Tagalog or Taglish' if language == 'tl' else 'English'
	if not api_key:
		return fallback_text, False

	try:
		import requests

		prompt = (
			'You are a farmer-friendly agricultural assistant. '
			'Write a short natural-language summary in 2 to 4 sentences. '
			f'Use {output_language} only. '
			'Be practical, specific, and easy to understand. '
			'Do not use bullets. Use the data exactly as given.\n\n'
			f'Kind: {kind}\n'
			f'Data: {json.dumps(payload)}'
		)

		response = requests.post(
			'https://api.openai.com/v1/responses',
			headers={
				'Authorization': f'Bearer {api_key}',
				'Content-Type': 'application/json',
			},
			json={
				'model': 'gpt-4.1-mini',
				'input': prompt,
				'max_output_tokens': 180,
			},
			timeout=15,
		)
		response.raise_for_status()
		payload_json = response.json()

		output_text = ''
		for item in payload_json.get('output', []):
			for content in item.get('content', []):
				if content.get('type') == 'output_text':
					output_text += content.get('text', '')

		output_text = output_text.strip()
		if output_text:
			return output_text, True
	except Exception:
		pass

	return fallback_text, False


def _resolve_history_window(request):
	range_param = (request.GET.get('range') or '7days').lower()
	range_map = {
		'today': 1,
		'3days': 3,
		'2weeks': 14,
		'2months': 60,
		'6months': 180,
		'7days': 7,
		'30days': 30,
		'90days': 90,
		'1year': 365,
		'monthly': 365,
	}

	start_date_str = request.GET.get('start_date')
	end_date_str = request.GET.get('end_date')
	custom = bool(start_date_str and end_date_str)
	now = timezone.now()
	today = timezone.localdate()

	if custom:
		try:
			start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
			end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
			if end_date < start_date:
				start_date, end_date = end_date, start_date
			start_dt = timezone.make_aware(datetime.combine(start_date, datetime.min.time()))
			end_dt = timezone.make_aware(datetime.combine(end_date + timedelta(days=1), datetime.min.time()))
			days = max(1, (end_date - start_date).days + 1)
			return {
				'range_param': 'custom',
				'days': days,
				'start_dt': start_dt,
				'end_dt': end_dt,
				'bucket_mode': 'month' if days > 62 else 'day',
				'custom': True,
			}
		except Exception:
			pass

	if range_param == 'all':
		earliest_dates = list(
			SensorReading.objects.exclude(device_id='temporary-simulator')
			.order_by('received_at')
			.values_list('received_at', flat=True)[:1]
		)
		if getattr(request.user, 'is_authenticated', False):
			earliest_dates.extend(
				Prediction.objects.filter(user=request.user)
				.order_by('created_at')
				.values_list('created_at', flat=True)[:1]
			)
		start_date = min((timezone.localdate(value) for value in earliest_dates), default=today)
		start_dt = timezone.make_aware(datetime.combine(start_date, datetime.min.time()))
		end_dt = timezone.make_aware(datetime.combine(today + timedelta(days=1), datetime.min.time()))
		return {
			'range_param': range_param,
			'days': max(1, (today - start_date).days + 1),
			'start_dt': start_dt,
			'end_dt': end_dt,
			'bucket_mode': 'month',
			'custom': False,
		}

	if range_param == 'today':
		start_dt = timezone.make_aware(datetime.combine(today, datetime.min.time()))
		end_dt = timezone.make_aware(datetime.combine(today + timedelta(days=1), datetime.min.time()))
		return {
			'range_param': range_param,
			'days': 1,
			'start_dt': start_dt,
			'end_dt': end_dt,
			'bucket_mode': 'day',
			'custom': False,
		}

	days = range_map.get(range_param, 7)
	start_dt = timezone.make_aware(datetime.combine(today - timedelta(days=days - 1), datetime.min.time()))
	end_dt = timezone.make_aware(datetime.combine(today + timedelta(days=1), datetime.min.time()))
	bucket_mode = 'month' if range_param == 'monthly' or days > 180 else 'day'
	return {
		'range_param': range_param,
		'days': days,
		'start_dt': start_dt,
		'end_dt': end_dt,
		'bucket_mode': bucket_mode,
		'custom': False,
	}


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def me(request):
	"""Return or update farmer profile.

	GET: optionally accepts ?email=<email> to fetch that user, otherwise tries request.user.
	POST: accepts JSON { email, name, location, photo } and updates the corresponding User/Farmer.
	"""
	# Identity comes exclusively from the authenticated session.
	if request.method == 'GET':
		user_obj = request.user

		farmer = Farmer.objects.filter(user=user_obj).first()
		return Response({
			'name': user_obj.first_name or user_obj.username,
			'email': user_obj.email,
			'location': farmer.location if farmer else '',
			'photo': farmer.photo if farmer else ''
		})

	# Handle POST: update profile by email/username
	try:
		payload = request.data if hasattr(request, 'data') else json.loads(request.body.decode('utf-8'))
	except Exception:
		return Response({'error': 'Invalid JSON payload'}, status=400)

	email = payload.get('email')
	name = payload.get('name')
	location = payload.get('location')
	photo = payload.get('photo')

	if not email:
		return Response({'error': 'Email is required to identify user'}, status=400)

	user_obj = request.user
	if email.lower() != user_obj.email.lower():
		return Response({'error': 'You may only update your own profile.'}, status=403)

	# Update fields
	if isinstance(name, str):
		user_obj.first_name = name.strip()
		user_obj.save()

	farmer, _ = Farmer.objects.get_or_create(user=user_obj)
	if isinstance(location, str):
		farmer.location = location.strip()
	if isinstance(photo, str):
		farmer.photo = photo.strip()
	farmer.save()

	return Response({
		'status': 'updated',
		'name': user_obj.first_name,
		'email': user_obj.email,
		'location': farmer.location,
		'photo': farmer.photo
	})


@api_view(['GET'])
def api_root(request):
	return Response({
		'message': 'Smart Farming API is running.',
		'endpoints': [
			'/api/sensors/',
			'/api/leaf_diseases/',
			'/api/signup/',
			'/api/ping',
			'/api/login',
			'/api/weather/'
		]
	})


@api_view(['GET'])
def ping(request):
	return Response({'status': 'ok'})


@api_view(['GET'])
def csrf_token(request):
	return Response({'csrfToken': get_token(request)}, headers={'Cache-Control': 'no-store'})


def _serialize_user_consent(record, email=None):
	payload = {
		'id': str(record.pk),
		'user_id': str(record.user_id),
		'research_consent': record.research_consent,
		'privacy_consent': record.privacy_consent,
		'consent_version': record.consent_version,
		'agreed_at': record.agreed_at.isoformat(),
		'withdrawn_at': record.withdrawn_at.isoformat() if record.withdrawn_at else None,
	}
	if email is not None:
		payload['email'] = email
	return payload


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def user_consent(request):
	identity = consent_identity_for(request.user)

	if request.method == 'POST':
		payload = request.data
		if not isinstance(payload, dict):
			return Response({'error': 'Consent choices must be an object.'}, status=400)
		research_consent = payload.get('research_consent')
		privacy_consent = payload.get('privacy_consent')
		if type(research_consent) is not bool or type(privacy_consent) is not bool:
			return Response({'error': 'Both consent choices must be explicitly selected.'}, status=400)
		if not privacy_consent:
			return Response(
				{'error': 'Privacy consent is required to use the farm system. Decline to leave without saving consent.'},
				status=400,
			)

		agreed_at = timezone.now()
		with consent_database_scope(request.user, identity):
			active_records = UserConsent.objects.filter(
				user_id=identity.pk,
				withdrawn_at__isnull=True,
			)
			current = active_records.order_by('-agreed_at').first()
			if (
				current
				and current.consent_version == CONSENT_VERSION
				and current.privacy_consent == privacy_consent
				and current.research_consent == research_consent
			):
				record = current
			else:
				active_records.update(withdrawn_at=agreed_at)
				record = UserConsent.objects.create(
					user_id=identity.pk,
					research_consent=research_consent,
					privacy_consent=privacy_consent,
					consent_version=CONSENT_VERSION,
					agreed_at=agreed_at,
				)
			history = list(
				UserConsent.objects
				.filter(user_id=identity.pk)
				.order_by('-agreed_at')[:25]
			)
		return Response({
			'current': _serialize_user_consent(record),
			'history': [_serialize_user_consent(item) for item in history],
			'consentVersion': CONSENT_VERSION,
			'privacyAccepted': record.privacy_consent and record.consent_version == CONSENT_VERSION,
			'researchAccepted': record.research_consent and record.consent_version == CONSENT_VERSION,
			'requiresConsent': False,
		})

	with consent_database_scope(request.user, identity):
		history = list(
			UserConsent.objects
			.filter(user_id=identity.pk)
			.order_by('-agreed_at')[:25]
		)
		current = next((record for record in history if record.withdrawn_at is None), None)

	version_is_current = bool(current and current.consent_version == CONSENT_VERSION)
	privacy_accepted = bool(version_is_current and current.privacy_consent)
	research_accepted = bool(privacy_accepted and current.research_consent)
	return Response({
		'current': _serialize_user_consent(current) if current else None,
		'history': [_serialize_user_consent(item) for item in history],
		'consentVersion': CONSENT_VERSION,
		'privacyAccepted': privacy_accepted,
		'researchAccepted': research_accepted,
		'requiresConsent': not privacy_accepted,
	})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def withdraw_user_consent(request):
	if not isinstance(request.data, dict) or request.data.get('scope') != 'all':
		return Response({'error': 'A full consent withdrawal must be explicitly requested.'}, status=400)

	identity = consent_identity_for(request.user)
	with consent_database_scope(request.user, identity):
		active_records = UserConsent.objects.filter(
			user_id=identity.pk,
			withdrawn_at__isnull=True,
		)
		if not active_records.exists():
			return Response({'error': 'There is no active consent to withdraw.'}, status=404)
		withdrawn_at = timezone.now()
		active_records.update(withdrawn_at=withdrawn_at)

	return Response({
		'message': 'Consent withdrawn.',
		'withdrawn_at': withdrawn_at.isoformat(),
		'requiresConsent': True,
	})


@api_view(['GET'])
@permission_classes([IsAdminUser])
def admin_user_consents(request):
	identity = consent_identity_for(request.user)
	with consent_database_scope(request.user, identity):
		records = list(
			UserConsent.objects
			.order_by('-agreed_at')[:500]
		)
	emails = dict(
		ConsentIdentity.objects
		.filter(pk__in=[record.user_id for record in records])
		.values_list('pk', 'user__email')
	)
	return Response({
		'results': [
			_serialize_user_consent(record, email=emails.get(record.user_id, ''))
			for record in records
		],
	})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def change_password(request):
	old_password = request.data.get('oldPassword') or ''
	password = request.data.get('newPassword') or ''
	if not request.user.check_password(old_password):
		return Response({'error': 'Current password is incorrect.'}, status=400)
	if password != request.data.get('confirmPassword'):
		return Response({'error': 'Passwords do not match.'}, status=400)
	try:
		validate_password(password, user=request.user)
	except ValidationError as exc:
		return Response({'error': ' '.join(exc.messages)}, status=400)
	request.user.set_password(password)
	request.user.save(update_fields=['password'])
	update_session_auth_hash(request, request.user)
	return Response({'message': 'Password changed successfully.'})


@api_view(['POST'])
def google_auth(request):
	credential = request.data.get('credential') or ''
	if not credential:
		return Response({'error': 'Google credential is required.'}, status=400)

	try:
		google_user = id_token.verify_oauth2_token(
			credential,
			google_requests.Request(),
			settings.GOOGLE_CLIENT_ID,
		)
	except ValueError:
		return Response({'error': 'Google sign-in could not be verified.'}, status=401)

	email = (google_user.get('email') or '').strip().lower()
	if not email or not google_user.get('email_verified'):
		return Response({'error': 'Please use a verified Google email address.'}, status=400)

	user_obj = User.objects.filter(email=email).first() or User.objects.filter(username=email).first()
	if not user_obj:
		user_obj = User.objects.create_user(username=email, email=email)
		user_obj.set_unusable_password()
		user_obj.first_name = (google_user.get('name') or '').strip()
		user_obj.is_active = True
		user_obj.save()
		Farmer.objects.create(user=user_obj, mobile='', location='', photo=google_user.get('picture') or '')
	elif not user_obj.is_active:
		user_obj.is_active = True
		user_obj.save(update_fields=['is_active'])

	auth_login(request, user_obj, backend='django.contrib.auth.backends.ModelBackend')
	return Response({
		'message': 'Google sign-in successful',
		'username': user_obj.username,
		'email': user_obj.email,
		'name': user_obj.first_name,
	})


@api_view(['POST'])
def login(request):
	if not isinstance(request.data, dict):
		return Response({'error': 'Email and password are required.'}, status=400)
	identifier = request.data.get('identifier')
	password = request.data.get('password')
	if not isinstance(identifier, str) or not identifier.strip() or not isinstance(password, str) or not password:
		return Response({'error': 'Email and password are required.'}, status=400)
	identifier = identifier.strip()
	user = None

	# Try username match
	user_obj = User.objects.filter(username=identifier).first()

	# Try email match if not found
	if not user_obj:
		user_obj = User.objects.filter(email__iexact=identifier).first()

	# Try mobile match in Farmer model if not found
	if not user_obj:
		farmer = Farmer.objects.filter(mobile=identifier).first()
		if farmer:
			user_obj = farmer.user

	if user_obj and not user_obj.is_active:
		if user_obj.check_password(password):
			ok, err = create_and_send_otp(user_obj.email, 'signup')
			return Response({
				'error': 'Please verify your email first. We sent a new code.' if ok else (err or 'Please verify your email first.'),
				'verificationRequired': True,
				'email': user_obj.email,
			}, status=status.HTTP_403_FORBIDDEN)
		return Response({'error': 'Incorrect email or password.'}, status=400)

	if user_obj:
		user = authenticate(username=user_obj.username, password=password)

	if user is not None:
		auth_login(request, user)
		return Response({
			'message': 'Login successful',
			'username': user.username,
			'email': user.email,
			'name': user.first_name,
		})
	else:
		return Response({'error': 'Incorrect email or password.'}, status=400)


@api_view(['POST'])
def otp_request(request):
	email = (request.data.get('email') or '').strip().lower()
	purpose = (request.data.get('purpose') or '').strip().lower()
	if not email or purpose not in ('signup', 'login', 'reset'):
		return Response({'error': 'A valid email and purpose are required.'}, status=400)

	user_obj = User.objects.filter(email=email).first()
	if purpose in ('login', 'reset') and not user_obj:
		return Response({'message': 'If an account exists, a code has been sent.'})
	if purpose == 'signup' and user_obj and user_obj.is_active:
		return Response({'error': 'This account is already verified.'}, status=400)

	ok, err = create_and_send_otp(email, purpose)
	if not ok:
		response_status = status.HTTP_429_TOO_MANY_REQUESTS if err and err.startswith('Please wait') else status.HTTP_502_BAD_GATEWAY
		return Response({'error': err or 'Failed to send verification code.'}, status=response_status)
	return Response({'message': 'Verification code sent.'})


@api_view(['POST'])
def otp_verify(request):
	email = (request.data.get('email') or '').strip().lower()
	code = str(request.data.get('code') or '').strip()
	purpose = (request.data.get('purpose') or '').strip().lower()
	if not email or not code or purpose not in ('signup', 'login'):
		return Response({'error': 'Email, code and purpose are required.'}, status=400)

	ok, err = verify_otp_code(email, code, purpose)
	if not ok:
		return Response({'error': err}, status=400)

	user_obj = User.objects.filter(email=email).first()
	if not user_obj:
		return Response({'error': 'Account not found.'}, status=404)
	if purpose == 'signup':
		user_obj.is_active = True
		user_obj.save(update_fields=['is_active'])
	if not user_obj.is_active:
		return Response({'error': 'Account is inactive.'}, status=403)
	auth_login(request, user_obj, backend='django.contrib.auth.backends.ModelBackend')

	return Response({
		'message': 'Login successful',
		'username': user_obj.username,
		'email': user_obj.email,
		'name': user_obj.first_name,
	})


@api_view(['POST'])
def password_reset_request(request):
	email = (request.data.get('email') or '').strip().lower()
	if not email:
		return Response({'error': 'Email is required.'}, status=400)
	if User.objects.filter(email=email).exists():
		create_and_send_otp(email, 'reset')
	return Response({'message': 'If an account exists for this email, a reset code has been sent.'})


@api_view(['POST'])
def password_reset_confirm(request):
	email = (request.data.get('email') or '').strip().lower()
	code = str(request.data.get('code') or '').strip()
	new_password = request.data.get('newPassword') or ''
	confirm_password = request.data.get('confirmPassword') or ''
	if not email or not code or not new_password:
		return Response({'error': 'Email, code and new password are required.'}, status=400)
	if new_password != confirm_password:
		return Response({'error': 'Passwords do not match.'}, status=400)

	ok, err = verify_otp_code(email, code, 'reset')
	if not ok:
		return Response({'error': err}, status=400)
	user_obj = User.objects.filter(email=email).first()
	if not user_obj:
		return Response({'error': 'Account not found.'}, status=404)
	try:
		validate_password(new_password, user=user_obj)
	except ValidationError as exc:
		return Response({'error': ' '.join(exc.messages)}, status=400)
	user_obj.set_password(new_password)
	user_obj.save()
	return Response({'message': 'Password updated. You can now log in.'})


@api_view(['POST'])
def signup(request):
	# Accept frontend payload: name, email, password, confirmPassword
	name = (request.data.get('name') or '').strip()
	email = (request.data.get('email') or '').strip().lower()
	password = request.data.get('password') or ''
	confirm_password = request.data.get('confirmPassword') or ''

	# Validate required fields
	if not name or not email or not password or not confirm_password:
		return Response({'error': 'All fields are required.'}, status=status.HTTP_400_BAD_REQUEST)

	# Enforce a real email address (no more phone-number accounts)
	try:
		validate_email(email)
	except ValidationError:
		return Response({'error': 'Please enter a valid email address.'}, status=status.HTTP_400_BAD_REQUEST)

	if password != confirm_password:
		return Response({'error': 'Passwords do not match.'}, status=status.HTTP_400_BAD_REQUEST)

	# Enforce Django's configured password policy (min length, common password, similarity, numeric-only)
	try:
		validate_password(password)
	except ValidationError as exc:
		return Response({'error': ' '.join(exc.messages)}, status=status.HTTP_400_BAD_REQUEST)

	# Check for duplicates
	if User.objects.filter(username=email).exists() or User.objects.filter(email=email).exists():
		return Response({'error': 'An account with this email already exists.'}, status=status.HTTP_400_BAD_REQUEST)

	# Create user with the email as username and wait for OTP verification.
	user = User.objects.create_user(username=email, email=email, password=password)
	user.first_name = name
	user.is_active = False
	user.save()
	Farmer.objects.create(user=user, mobile='', location='', photo='')

	ok, err = create_and_send_otp(email, 'signup')
	if not ok:
		user.delete()
		response_status = status.HTTP_429_TOO_MANY_REQUESTS if err and err.startswith('Please wait') else status.HTTP_502_BAD_GATEWAY
		return Response({'error': err or 'Failed to send verification email.'}, status=response_status)

	return Response({
		'message': 'Account created. Please check your email for a verification code.',
		'otpRequired': True,
		'email': email,
	}, status=status.HTTP_201_CREATED)


@api_view(['GET'])
def leaf_diseases(request):
	# TODO: Connect to DB and fetch real data
	return Response([])


# Lazy-loaded leaf model placeholder
_leaf_model = None
_LEAF_MODEL_PATH = None  # set to path string or leave None to use 'model_leaf.keras' in backend root
# Treat weak softmax outputs as unknown rather than forcing a disease label.
# A four-class result around 50% is still too uncertain to present as a
# disease diagnosis. Ask for a clearer photo instead.
LEAF_CONF_THRESHOLD = 0.60
RAMBUTAN_CONF_THRESHOLD = 0.35
# A two-class softmax always has a top score >= 0.5. This initial cutoff
# rejects uncertain maturity predictions; tune it on validation data later.
RAMBUTAN_BINARY_CONF_THRESHOLD = 0.60
LEAF_IMAGE_SIZE = (224, 224)
RAMBUTAN_IMAGE_SIZE = (224, 224)
# Color can raise the disease-confidence cutoff, but cannot verify a leaf.
# The separate verify_leaf check must pass before disease prediction runs.
LEAF_LIKENESS_THRESHOLD = 0.08

# Retrain settings
RETRAIN_THRESHOLD = 10  # number of newly labeled images to trigger a short fine-tune
RETRAIN_SCRIPT = 'backend/train_finetune.py'
RETRAIN_EPOCHS = 2


def _leaf_likeness_score(pil_img):
	"""Return a float score [0..1] estimating if an image contains a leaf.

	Heuristic based on "excess green" (ExG = 2G - R - B) and green dominance.
	This is intentionally lightweight and dependency-free (NumPy only).
	"""
	try:
		import numpy as np
	except Exception:
		return 0.0

	try:
		img_small = pil_img.convert('RGB').resize((160, 160))
		arr = np.asarray(img_small).astype('float32') / 255.0  # HxWx3
		r = arr[:, :, 0]
		g = arr[:, :, 1]
		b = arr[:, :, 2]

		# Excess green index; leaves tend to have higher ExG than many backgrounds.
		exg = (2.0 * g) - r - b
		exg_mask = exg > 0.10

		# Green dominance: helps when ExG is borderline.
		green_dom = (g > (r + 0.03)) & (g > (b + 0.03)) & (g > 0.18)

		score = float(np.mean(exg_mask | green_dom))
		if score < 0.0:
			return 0.0
		if score > 1.0:
			return 1.0
		return score
	except Exception:
		return 0.0


def _latest_sensor_reading():
	return SensorReading.objects.exclude(device_id='temporary-simulator').order_by('-received_at', '-id').first()


def _rain_state_from_reading(reading):
	if reading.is_raining is not None:
		return reading.is_raining
	if reading.rain == 0:
		return False
	if reading.rain == 1:
		return True
	return None


def _stable_rain_status(reading):
	"""Report rain only after two recent, consecutive verified device states agree."""
	if reading is None:
		return None
	now = timezone.now()
	recent_readings = list(
		SensorReading.objects.filter(
			device_id=reading.device_id,
			received_at__gte=now - timedelta(seconds=120),
			received_at__lte=now + timedelta(seconds=60),
		).order_by('-received_at', '-id')[:2]
	)
	if len(recent_readings) != 2:
		return None
	states = [_rain_state_from_reading(sample) for sample in recent_readings]
	if states[0] is None or states[0] != states[1]:
		return None
	return states[0]


@api_view(['GET', 'POST'])
def sensors(request):
	# Only handle GET for sensor data
	if request.method == 'GET':
		try:
			latest = _latest_sensor_reading()
			if latest:
				response = {
					'temperature': latest.temperature,
					'soilMoisture': latest.moisture_pct,
					'rainfall': None,  # No calibrated rainfall amount is supplied by this device.
					'rain': latest.rain,
					'rainRaw': latest.rain,
					'windSpeed': None,  # Not available in current model
					'isRaining': _stable_rain_status(latest),
					'humidity': latest.humidity,
					'pressure_hpa': getattr(latest, 'pressure_hpa', None),
					'soil_raw': latest.soil_raw,
					'device_id': latest.device_id,
					'received_at': latest.received_at,
				}
				return Response(response, headers={'Cache-Control': 'no-store'})
			else:
				return Response({})
		except Exception as e:
			return Response({'error': f'Failed to fetch sensor data: {str(e)}'}, status=500)
	else:
		return Response({'error': 'GET method only'}, status=405)


@api_view(['GET'])
def sensor_history(request):
    window = _resolve_history_window(request)
    readings = list(SensorReading.objects.exclude(device_id='temporary-simulator').filter(
        received_at__gte=window['start_dt'], received_at__lt=window['end_dt'],
    ).order_by('received_at'))
    monthly = window['bucket_mode'] == 'month'
    buckets = defaultdict(lambda: {'temperature': [], 'humidity': []})
    for reading in readings:
        local_time = timezone.localtime(reading.received_at)
        key = local_time.strftime('%Y-%m') if monthly else local_time.date().isoformat()
        for field in ('temperature', 'humidity'):
            value = getattr(reading, field)
            if value is not None and math.isfinite(value):
                buckets[key][field].append(value)

    def average(values):
        return round(sum(values) / len(values), 1) if values else None

    keys = []
    current = window['start_dt'].date()
    end_date = (window['end_dt'] - timedelta(seconds=1)).date()
    while current <= end_date:
        key = current.strftime('%Y-%m') if monthly else current.isoformat()
        if not keys or keys[-1] != key:
            keys.append(key)
        current += timedelta(days=1)

    temperature_data, humidity_data, rainfall_data, risks = [], [], [], []
    for key in keys:
        date = datetime.strptime(key, '%Y-%m' if monthly else '%Y-%m-%d')
        label = date.strftime('%b %y' if window['range_param'] == 'all' else '%b') if monthly else date.strftime('%b %d' if window['days'] > 31 else '%a')
        temperature = average(buckets[key]['temperature'])
        humidity = average(buckets[key]['humidity'])
        risk = min(100, round(15 + min(50, max(0, humidity - 50)))) if humidity is not None else None
        dew_point = round(temperature - ((100 - humidity) / 5), 1) if temperature is not None and humidity is not None else None
        temperature_data.append({'time': label, 'temp': temperature, 'optimal': 27})
        humidity_data.append({'time': label, 'humidity': humidity, 'dewPoint': dew_point, 'risk': risk})
        rainfall_data.append({'time': label, 'rainfall': None, 'cumulative': None})
        risks.append({'time': label, 'incidents': None, 'risk': risk})

    # The hardware protocol stores a raw rain value, not rainfall in mm.
    # Adding its samples would fabricate rainfall totals and dry-day claims.
    rainfall_summary = {
        'totalRainfall': None, 'rainyDays': None, 'dryDays': None, 'avgPerDay': None,
        'previousPeriodTotal': None, 'changeFromPrevious': None, 'peakDay': None,
        'lowestDay': None, 'consistentRange': {'start': None, 'end': None, 'length': 0},
        'distribution': {'rainyPercent': None, 'dryPercent': None},
        'insights': [], 'patterns': [],
        'recommendation': 'Measured rainfall amounts are unavailable. The device rain value is not calibrated in millimeters.',
        'recommendationSource': 'fallback',
    }
    current_risk = average([item['risk'] for item in risks if item['risk'] is not None])
    summary = {
        'range': window['range_param'], 'days': window['days'], 'bucketMode': window['bucket_mode'],
        'startDate': window['start_dt'].date().isoformat(), 'endDate': end_date.isoformat(),
        'avgTemperature': average([item['temp'] for item in temperature_data if item['temp'] is not None]),
        'avgHumidity': average([item['humidity'] for item in humidity_data if item['humidity'] is not None]),
        'totalRainfall': None, 'rainyDays': None, 'dryDays': None, 'avgRainfallPerDay': None,
        'optimalDays': sum(1 for item in temperature_data if item['temp'] is not None and 24 <= item['temp'] <= 30),
        'currentRisk': current_risk,
        'riskLabel': 'No data' if current_risk is None else ('High' if current_risk >= 70 else 'Medium' if current_risk >= 45 else 'Low'),
        'totalRecords': len(readings),
    }
    return Response({
        'temperatureData': temperature_data, 'rainfallData': rainfall_data,
        'humidityData': humidity_data, 'diseaseRiskData': risks,
        'sensorRecords': [{
            'id': reading.id, 'deviceId': reading.device_id, 'temperature': reading.temperature,
            'humidity': reading.humidity, 'rainfall': None, 'rainRaw': reading.rain,
            'soilMoisture': reading.moisture_pct, 'soilRaw': reading.soil_raw,
            'receivedAt': reading.received_at.isoformat(),
        } for reading in readings],
        'summary': summary, 'rainfallSummary': rainfall_summary,
    }, headers={'Cache-Control': 'no-store'})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def prediction_history(request):
	window = _resolve_history_window(request)
	days = window['days']
	start_dt = window['start_dt']
	end_dt = window['end_dt']
	bucket_mode = window['bucket_mode']

	predictions = Prediction.objects.filter(
		user=request.user,
		created_at__gte=start_dt,
		created_at__lt=end_dt,
	).order_by('created_at')
	leaf_predictions = predictions.filter(prediction_type='leaf')
	maturity_predictions = predictions.filter(prediction_type='rambutan')

	def build_daily_series(queryset):
		day_buckets = defaultdict(list)
		for item in queryset:
			local_dt = timezone.localtime(item.created_at)
			if bucket_mode == 'month':
				bucket_key = local_dt.strftime('%Y-%m')
			else:
				bucket_key = local_dt.date().isoformat()
			day_buckets[bucket_key].append(item)

		series = []
		if bucket_mode == 'month':
			keys = []
			current = start_dt.date().replace(day=1)
			end_date = (end_dt - timedelta(seconds=1)).date().replace(day=1)
			while current <= end_date:
				keys.append(current.strftime('%Y-%m'))
				if current.month == 12:
					current = current.replace(year=current.year + 1, month=1)
				else:
					current = current.replace(month=current.month + 1)
		else:
			keys = []
			current = start_dt.date()
			end_date = (end_dt - timedelta(seconds=1)).date()
			while current <= end_date:
				keys.append(current.isoformat())
				current += timedelta(days=1)

		for key in keys:
			label = datetime.strptime(key, '%Y-%m').strftime('%b %y' if window['range_param'] == 'all' else '%b') if bucket_mode == 'month' else datetime.strptime(key, '%Y-%m-%d').strftime('%b %d' if days > 31 else '%a')
			items = day_buckets[key]
			confidences = [float(obj.confidence) * 100 for obj in items if obj.confidence is not None]
			series.append({
				'time': label,
				'count': len(items),
				'avgConfidence': round(sum(confidences) / len(confidences), 1) if confidences else 0,
			})
		return series

	def build_label_breakdown(queryset):
		counter = defaultdict(int)
		for item in queryset:
			counter[item.label] += 1
		return [
			{'label': label, 'count': count}
			for label, count in sorted(counter.items(), key=lambda pair: (-pair[1], pair[0]))
		]

	def build_summary(queryset):
		confidences = [float(obj.confidence) * 100 for obj in queryset if obj.confidence is not None]
		labels = [obj.label for obj in queryset]
		top_label = None
		if labels:
			counts = defaultdict(int)
			for label in labels:
				counts[label] += 1
			top_label = sorted(counts.items(), key=lambda pair: (-pair[1], pair[0]))[0][0]
		return {
			'totalScans': queryset.count(),
			'avgConfidence': round(sum(confidences) / len(confidences), 1) if confidences else None,
			'topLabel': top_label,
		}

	return Response({
		'leafDetectionData': build_daily_series(leaf_predictions),
		'fruitMaturityData': build_daily_series(maturity_predictions),
		'leafLabelBreakdown': build_label_breakdown(leaf_predictions),
		'fruitLabelBreakdown': build_label_breakdown(maturity_predictions),
		'leafSummary': build_summary(leaf_predictions),
		'fruitSummary': build_summary(maturity_predictions),
		'predictionRecords': [
			{
				'id': item.id,
				'type': item.prediction_type,
				'label': item.label,
				'confidence': round(float(item.confidence) * 100, 1),
				'imageName': item.image_name,
				'createdAt': item.created_at.isoformat(),
			}
			for item in predictions
		],
	})


@api_view(['POST'])
@permission_classes([HostedAccountRequired])
def nlp_summary(request):
	try:
		payload = request.data if hasattr(request, 'data') else json.loads(request.body.decode('utf-8'))
	except Exception:
		return Response({'error': 'Invalid JSON payload'}, status=400)

	if not isinstance(payload, dict):
		return Response({'error': 'Expected a JSON object'}, status=400)
	kind = payload.get('kind')
	data = payload.get('payload') or {}
	if kind not in ('environmental', 'historical', 'leaf_detection', 'fruit_maturity') or not isinstance(data, dict):
		return Response({'error': 'A supported kind and an object payload are required'}, status=400)
	try:
		# Validate the fallback before making a paid provider request.
		_fallback_nlp_summary(kind, data)
	except (TypeError, ValueError, AttributeError):
		return Response({'error': 'Invalid summary values'}, status=400)

	summary_text, used_ai = _generate_nlp_summary(kind, data)
	return Response({
		'summary': summary_text,
		'source': 'ai' if used_ai else 'fallback',
	})


@api_view(['POST'])
@permission_classes([HostedAccountRequired])
def disease_recommendation(request):
	"""Return safe, structured guidance after a classifier result.
	The current sensor reading is read on the server. Client-provided environmental
	values are deliberately ignored so the API never fabricates farm conditions.
	"""
	if not isinstance(request.data, dict):
		return Response({'error': 'Expected a JSON object'}, status=400)
	disease = request.data.get('disease') or request.data.get('label') or ''
	if not isinstance(disease, str):
		return Response({'error': 'disease must be text'}, status=400)
	disease = disease.strip()
	if not disease:
		return Response({'error': 'disease is required'}, status=400)
	try:
		confidence = float(request.data.get('confidence'))
	except (TypeError, ValueError):
		confidence = None
	if confidence is not None and (not math.isfinite(confidence) or not 0 <= confidence <= 100):
		return Response({'error': 'confidence must be between 0 and 100'}, status=400)

	latest = current_reading(SensorReading.objects.exclude(device_id='temporary-simulator').order_by('-received_at').first())
	environment = {
		'temperature': latest.temperature if latest else None,
		'humidity': latest.humidity if latest else None,
		'rainfall': None,  # The device rain field is not a calibrated millimeter measurement.
		'rain_detected': _stable_rain_status(latest),
		'soil_moisture': latest.moisture_pct if latest else None,
		'wind_speed': None,
		'leaf_wetness': None,
	}
	language = 'tl' if request.data.get('language') in ('tl', 'fil', 'tagalog') else 'en'
	base = fallback_recommendation(disease, confidence, environment, language)
	recommendation, used_ai = recommend_with_openai(base, request.data.get('image'), language)
	recommendation['environment'] = environment
	recommendation['provider'] = (
    'openai'
    if used_ai
    else 'verified_knowledge_fallback'
)
	return Response(recommendation)


@csrf_exempt
def telemetry(request):
	"""Accept JSON POST from devices and store as SensorReading."""
	if request.method != 'POST':
		return JsonResponse({'error': 'POST required'}, status=405)
	device_key = getattr(settings, 'TELEMETRY_API_KEY', '')
	if device_key or getattr(settings, 'TELEMETRY_REQUIRE_AUTH', False):
		provided = request.headers.get('X-Telemetry-Key', '')
		if not device_key or not secrets.compare_digest(provided.encode('utf-8'), device_key.encode('utf-8')):
			return JsonResponse({'error': 'Device authentication required.'}, status=401)

	try:
		payload = json.loads(request.body.decode('utf-8'))
	except Exception:
		return JsonResponse({'error': 'invalid json'}, status=400)

	try:
		values = validate_telemetry(payload)
	except ValueError as exc:
		return JsonResponse({'error': str(exc)}, status=400)
	sr = SensorReading.objects.create(**values)
	return JsonResponse({'status': 'ok', 'id': sr.id})


@api_view(['POST'])
@permission_classes([HostedAccountRequired])
def predict_leaf(request):
    """
    POST endpoint that accepts form file 'image'
    and returns leaf disease prediction.

    Response JSON:
    {
        'type': 'leaf',
        'label': <str>|'unknown',
        'confidence': <float>
    }
    """
    global _leaf_model, _LEAF_MODEL_PATH

    if 'image' not in request.FILES:
        return Response({
            'error': 'POST with form file "image" required'
        }, status=400)

    # Dependencies
    try:
        import io
        import numpy as np
        import tensorflow as tf
        from PIL import Image, ImageOps
    except Exception as e:
        return Response({
            'error': 'Server missing dependencies',
            'details': str(e)
        }, status=500)

    # ---------------------------------------
    # 1. READ IMAGE ONCE
    # ---------------------------------------
    img_file = request.FILES['image']

    try:
        raw_bytes = img_file.read()

        img = ImageOps.exif_transpose(
            Image.open(io.BytesIO(raw_bytes))
        ).convert('RGB')

    except Exception as e:
        return Response({
            'error': 'Please upload a valid JPG, PNG, or WebP image.',
            'details': str(e)
        }, status=400)

    # ---------------------------------------
    # 2. VERIFY THAT IMAGE IS A LEAF
    # ---------------------------------------
    try:
        verification = verify_leaf(img)

    except VerifierUnavailable:
        return Response({
            'error': 'The leaf check is unavailable. Please try again later.',
            'code': 'leaf_verifier_unavailable',
            'leaf_verified': False,
        }, status=503)

    if not verification['verified']:
        return Response({
            'type': 'not_leaf',
            'label': 'not_leaf',
            'confidence': None,
            'leaf_verified': False,
            'message': (
                'Leaves only. Take a clear close-up of one leaf '
                'with its edges visible.'
            ),
        })

    # ---------------------------------------
    # 3. LOAD LEAF DISEASE MODEL
    # ---------------------------------------
    try:
        if _leaf_model is None:
            candidates = []

            if _LEAF_MODEL_PATH:
                candidates.append(_LEAF_MODEL_PATH)

            candidates += [
                BASE_DIR / 'model_leaf_disease_checkpoint.keras',
                BASE_DIR / 'modelkeras_leaf' / 'trained_leaf_disease_model.keras',
                BASE_DIR / 'model_checkpoint.keras',
                BASE_DIR / 'model_checkpoint.h5',
                BASE_DIR / 'model_leaf.keras',
                'model_leaf_disease_checkpoint.keras',
                'model_checkpoint.keras',
                'model_checkpoint.h5',
                'model_leaf.keras',
                BASE_DIR / 'modelkeras' / 'trained_corn_disease_model.keras',
                BASE_DIR / 'modelh5' / 'trained_corn_disease_model.h5',
            ]

            last_exc = None

            for mp in candidates:
                try:
                    _leaf_model = tf.keras.models.load_model(
                        str(mp),
                        compile=False
                    )

                    _leaf_model._class_names = load_model_classes(
                        mp,
                        int(_leaf_model.output_shape[-1]),
                        'leaf',
                        BASE_DIR / 'modelkeras_leaf' / 'leaf_classes.json',
                    )

                    _LEAF_MODEL_PATH = str(mp)
                    break

                except Exception as e:
                    _leaf_model = None
                    last_exc = e

            if _leaf_model is None:
                raise Exception(
                    f"Tried paths: {candidates}; last error: {last_exc}"
                )

    except Exception as e:
        return Response({
            'error': 'Failed to load model',
            'details': str(e)
        }, status=500)

    # ---------------------------------------
    # 5. PREPROCESS ORIGINAL IMAGE
    # ---------------------------------------
    try:
        model_height, model_width = _leaf_model.input_shape[1:3]
        img_resized = img.resize((int(model_width), int(model_height)))

        arr = np.asarray(
            img_resized
        ).astype('float32') / 255.0

        x = np.expand_dims(arr, axis=0)

    except Exception as e:
        return Response({
            'error': 'Image preprocessing failed',
            'details': str(e)
        }, status=400)

    # ---------------------------------------
    # 6. PREDICT
    # ---------------------------------------
    try:
        model_classes = list(getattr(_leaf_model, '_class_names', []) or [])
        if not model_classes:
            raise ValueError('Leaf model has no class names.')
        probs = validate_probabilities(
            _leaf_model.predict(x), len(model_classes), expected_samples=1,
        )[0]

        idx = int(np.argmax(probs))
        conf = float(np.max(probs))

    except Exception as e:
        return Response({
            'error': 'Prediction failed',
            'details': str(e)
        }, status=500)

    # ---------------------------------------
    # 7. CLASS NAMES
    # ---------------------------------------
    try:
        n_classes = int(len(probs))

        # The loaded model already carries the class order from its metadata.
        # Reusing it avoids repeated file-system reads on every analysis.
        leaf_classes = model_classes

        if len(leaf_classes) != n_classes:
            leaf_classes = None

        candidates = [
            BASE_DIR / 'modelkeras_leaf' / 'leaf_classes.json',
            BASE_DIR / 'modelkeras_leaf' / 'class_names.json',
            BASE_DIR / 'modelkeras' / 'leaf_classes.json',
            BASE_DIR / 'model_classes.json',
            BASE_DIR / 'classes.json',
            'leaf_classes.json',
            'model_classes.json',
            'classes.json',
        ]

        if leaf_classes is None:
            for cf in candidates:
                try:
                    if Path(cf).exists():
                        with open(cf, 'r', encoding='utf-8') as fh:
                            vals = json.load(fh)

                        if (
                            isinstance(vals, list)
                            and len(vals) == n_classes
                        ):
                            leaf_classes = vals
                            break

                except Exception:
                    pass

        hardcoded_classes = [
            'Algal Leaf Spot',
            'Anthracnose',
            'Leaf Curl',
            'Powdery Mildew',
            'sooty mold',
        ]

        if (
            leaf_classes is None
            and len(hardcoded_classes) == n_classes
        ):
            leaf_classes = hardcoded_classes

        if leaf_classes is None:
            leaf_classes = [
                f'class_{i}'
                for i in range(n_classes)
            ]

    except Exception:
        leaf_classes = [
            f'class_{i}'
            for i in range(len(probs))
        ]

    # ---------------------------------------
    # 8. LOW CONFIDENCE
    # ---------------------------------------
    if conf < LEAF_CONF_THRESHOLD:
        return Response({
            'type': 'leaf',
            'label': 'unknown',
            'leaf_verified': True,
            'confidence': conf,
            'raw_probs': probs.tolist(),
            'class_names': leaf_classes,
            'message': (
                'The model is uncertain. '
                'Try a clear close-up of one leaf '
                'in good lighting.'
            )
        })

    # ---------------------------------------
    # 9. FINAL CLASSIFICATION
    # ---------------------------------------
    raw_label = (
        leaf_classes[idx]
        if idx < len(leaf_classes)
        else str(idx)
    )
    label = _normalize_leaf_label(raw_label)

    if label.lower() in [
        'not_leaf',
        'notleaf',
        'not a leaf',
        'unknown'
    ]:
        return Response({
            'type': 'not_leaf',
            'label': label,
            'confidence': conf,
            'raw_probs': probs.tolist(),
            'class_names': leaf_classes
        })

    # ---------------------------------------
    # 10. SAVE PREDICTION
    # ---------------------------------------
    user_obj = request.user if request.user.is_authenticated else None
    storage = save_prediction(
        user=user_obj, prediction_type='leaf', label=label, confidence=conf,
        image_name=getattr(img_file, 'name', '') or '',
        raw_probs=json.dumps(probs.tolist()),
    )

    # ---------------------------------------
    # 11. RESPONSE
    # ---------------------------------------
    return Response({
        'type': 'leaf',
        'label': label,
        'leaf_verified': True,
        'confidence': conf,
        'storage': storage,
        'raw_probs': probs.tolist(),
        'class_names': leaf_classes
    })


# Global rambutan model cache
_rambutan_model = None
_RAMBUTAN_MODEL_PATH = None


@api_view(['POST'])
@permission_classes([HostedAccountRequired])
def predict_rambutan(request):
    """
    POST endpoint that accepts form file 'image'
    and returns rambutan ripeness prediction.
    """
    global _rambutan_model, _RAMBUTAN_MODEL_PATH

    try:
        import io
        from PIL import Image, ImageOps
        import numpy as np
        import tensorflow as tf
    except Exception as e:
        return Response({
            'error': 'Server missing dependencies',
            'details': str(e)
        }, status=500)

    if 'image' not in request.FILES:
        return Response({
            'error': 'POST with form file "image" required'
        }, status=400)

    # Get uploaded image
    img_file = request.FILES['image']

    # Open image
    try:
        img = ImageOps.exif_transpose(
            Image.open(io.BytesIO(img_file.read()))
        ).convert('RGB')
    except Exception as e:
        return Response({
            'error': 'Please upload a valid JPG, PNG, or WebP image.',
            'details': str(e)
        }, status=400)

    # Verify that the uploaded image contains rambutan
    try:
        verification = verify_rambutan(img)
    except VerifierUnavailable:
        return Response({
            'error': 'The fruit check is unavailable. Please try again later.',
            'code': 'fruit_verifier_unavailable',
            'rambutan_verified': False,
        }, status=503)

    if not verification['verified']:
        return Response({
            'type': 'rambutan',
            'label': 'not_rambutan',
            'confidence': None,
            'rambutan_verified': False,
            'message': (
                'Rambutan was not confirmed. Take a close-up of '
                'rambutan showing its skin and soft hairs.'
            ),
        })

    # Load the maturity model once per Django worker. The verifier above only
    # establishes that the image is a rambutan; this model determines maturity.
    try:
        if _rambutan_model is None:
            candidates = []
            if _RAMBUTAN_MODEL_PATH:
                candidates.append(_RAMBUTAN_MODEL_PATH)
            candidates += [
                BASE_DIR / 'model_rambutan_checkpoint.keras',
                BASE_DIR / 'modelkeras_rambutan' / 'trained_rambutan_maturity_model.keras',
                BASE_DIR / 'model_rambutan.keras',
                BASE_DIR / 'modelkeras' / 'rambutan_ripeness_model.keras',
                BASE_DIR / 'modelh5' / 'rambutan_ripeness_model.h5',
                'model_rambutan_checkpoint.keras',
            ]
            last_exc = None
            for model_path in candidates:
                try:
                    _rambutan_model = tf.keras.models.load_model(str(model_path), compile=False)
                    _rambutan_model._class_names = load_model_classes(
                        model_path, int(_rambutan_model.output_shape[-1]), 'rambutan',
                        BASE_DIR / 'modelkeras_rambutan' / 'rambutan_classes.json',
                    )
                    _RAMBUTAN_MODEL_PATH = str(model_path)
                    break
                except Exception as exc:
                    _rambutan_model = None
                    last_exc = exc
            if _rambutan_model is None:
                raise RuntimeError(f'Tried paths: {candidates}; last error: {last_exc}')

        rambutan_classes = list(getattr(_rambutan_model, '_class_names', []) or [])
        if not rambutan_classes:
            raise ValueError('Rambutan model has no class names.')
        model_height, model_width = _rambutan_model.input_shape[1:3]
        img_resized = img.resize((int(model_width), int(model_height)), Image.Resampling.BICUBIC)
        x = np.expand_dims(np.asarray(img_resized).astype('float32') / 255.0, axis=0)
    except Exception as exc:
        return Response({'error': 'Failed to load or preprocess rambutan model', 'details': str(exc)}, status=500)

    try:
        probs = validate_probabilities(
            _rambutan_model.predict(x), len(rambutan_classes), expected_samples=1,
        )[0]
        idx = int(np.argmax(probs))
        conf = float(np.max(probs))
    except Exception as exc:
        return Response({'error': 'Prediction failed', 'details': str(exc)}, status=500)

    raw_label = rambutan_classes[idx] if idx < len(rambutan_classes) else str(idx)
    label = _normalize_rambutan_label(raw_label)
    threshold = RAMBUTAN_BINARY_CONF_THRESHOLD if len(rambutan_classes) == 2 else RAMBUTAN_CONF_THRESHOLD
    if (
        conf < threshold
        or raw_label.lower() == 'not_rambutan'
        or label not in ('mature', 'immature')
    ):
        rejected_label = 'not_rambutan' if raw_label.lower() == 'not_rambutan' else 'unknown'
        return Response({
            'type': 'rambutan', 'label': rejected_label,
            'rambutan_verified': rejected_label != 'not_rambutan',
            'confidence': conf, 'raw_probs': probs.tolist(), 'class_names': rambutan_classes,
            'message': (
                'Not classified as a rambutan fruit. Please try again with a clear image of rambutan.'
                if rejected_label == 'not_rambutan'
                else 'Maturity is uncertain. Try a closer, clearer photo of the rambutan fruit.'
            ),
        })

    user_obj = request.user if request.user.is_authenticated else None
    image_name = getattr(img_file, 'name', '') or ''
    saved_image_name = None
    if user_obj is not None:
        image_buffer = io.BytesIO()
        img.save(image_buffer, format='JPEG', quality=90, optimize=True)
        try:
            saved_image_name = default_storage.save(
                f'maturity_assessments/{uuid.uuid4().hex}.jpg',
                ContentFile(image_buffer.getvalue()),
            )
        except OSError:
            logger.exception('Could not store maturity assessment image')
            return Response({
                'error': 'Could not save this maturity assessment image.',
                'code': 'maturity_image_storage_failed',
            }, status=503)
        image_name = saved_image_name

    storage = save_prediction(
        user=user_obj, prediction_type='rambutan', label=label, confidence=conf,
        image_name=image_name, raw_probs=json.dumps(probs.tolist()),
    )
    if saved_image_name and not storage.get('saved'):
        default_storage.delete(saved_image_name)

    classification = 'ripe' if label == 'mature' else 'unripe'

    return Response({
        'type': 'rambutan', 'label': label, 'rambutan_verified': True,
        'classification': classification,
        'image_url': (
            f"/api/predictions/{storage['prediction_id']}/image/"
            if user_obj is not None and storage.get('saved') else None
        ),
        'storage': storage,
        'confidence': conf, 'raw_probs': probs.tolist(), 'class_names': rambutan_classes,
        'message': f'Rambutan detected as {label} with {conf * 100:.1f}% confidence',
    })

@api_view(['POST'])
@permission_classes([IsAdminUser])
def confirm_prediction(request):
	"""Accepts JSON: { image_name, prediction_type, label, confidence, raw_probs }
	Saves a new Prediction record or updates existing one.
	"""
	try:
		payload = request.data if hasattr(request, 'data') else json.loads(request.body.decode('utf-8'))
	except Exception:
		return Response({'error': 'Invalid JSON payload'}, status=400)

	image_name = payload.get('image_name', '')
	pred_type = payload.get('prediction_type', 'leaf')
	label = payload.get('label')
	confidence = payload.get('confidence')
	raw_probs = payload.get('raw_probs')

	if not label:
		return Response({'error': 'label is required'}, status=400)
	if not isinstance(label, str) or not re.fullmatch(r'[A-Za-z0-9 _()-]{1,128}', label):
		return Response({'error': 'Invalid label'}, status=400)
	if image_name and (not isinstance(image_name, str) or Path(image_name).name != image_name or '/' in image_name or '\\' in image_name):
		return Response({'error': 'Invalid image name'}, status=400)

	try:
		user_obj = request.user if hasattr(request, 'user') and request.user.is_authenticated else None

		rec = None
		if image_name:
			rec = Prediction.objects.filter(image_name=image_name, prediction_type=pred_type).first()

		if rec:
			rec.label = label
			if confidence is not None:
				rec.confidence = float(confidence)
			if raw_probs is not None:
				rec.raw_probs = json.dumps(raw_probs) if not isinstance(raw_probs, str) else raw_probs
			rec.user = user_obj or rec.user
			rec.save()
		else:
			rec = Prediction.objects.create(
				user=user_obj,
				prediction_type=pred_type,
				label=label,
				confidence=float(confidence) if confidence is not None else 0.0,
				image_name=image_name or '',
				raw_probs=json.dumps(raw_probs) if raw_probs is not None and not isinstance(raw_probs, str) else (raw_probs or '')
			)

		storage = prediction_storage_status(rec)

		# If an uploaded image exists in collected/uploads, move it to train/<label>/ for retraining
		moved = False
		triggered = False
		try:
			import os, shutil, subprocess, sys
			BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
			uploads_dir = os.path.join(BASE_DIR, 'collected', 'uploads')
			src_path = None
			if image_name:
				src_path = os.path.join(uploads_dir, image_name)

			if src_path and os.path.exists(src_path):
				train_dir = os.path.join(BASE_DIR, 'train', label)
				os.makedirs(train_dir, exist_ok=True)
				dest_path = os.path.join(train_dir, os.path.basename(src_path))
				try:
					shutil.move(src_path, dest_path)
					moved = True
				except Exception:
					moved = False

			total = 0
			for _, _, files in os.walk(os.path.join(BASE_DIR, 'train')):
				total += len(files)

			if total and RETRAIN_THRESHOLD and total % RETRAIN_THRESHOLD == 0:
				try:
					cmd = [
						sys.executable,
						os.path.join(BASE_DIR, RETRAIN_SCRIPT),
						'--root', BASE_DIR,
						'--epochs', str(RETRAIN_EPOCHS),
						'--batch', '16',
						'--img-size', '224'
					]
					subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
					triggered = True
				except Exception:
					triggered = False
		except Exception:
			moved = False

		return Response({'status': 'saved', 'storage': storage, 'moved': moved, 'retrain_triggered': triggered})

	except Exception as e:
		return Response({'error': 'Failed to save confirmation', 'details': str(e)}, status=500)


@api_view(['GET', 'POST'])
def logout_view(request):
	"""Log out the current session.

	- If the client expects JSON (AJAX/XHR), return JSON confirmation.
	- Otherwise redirect the browser to the login page (`/login`).
	"""
	try:
		auth_logout(request)
	except Exception:
		pass

	is_xhr = request.META.get('HTTP_X_REQUESTED_WITH') == 'XMLHttpRequest'
	accept = (request.META.get('HTTP_ACCEPT') or '').lower()

	if is_xhr or 'application/json' in accept:
		return Response({'message': 'Successfully logged out'})

	return redirect('/login')


def _normalize_weather_query(q):
	return ' '.join(str(q or '').strip().lower().split())


def _weather_response(payload, status=200):
	return Response(payload, status=status, headers={'Cache-Control': 'no-store'})


def _forecast_coverage(payload, days):
	from zoneinfo import ZoneInfo
	today = timezone.now().astimezone(ZoneInfo(FARM_WEATHER_TIMEZONE)).date()
	expected_dates = [(today + timedelta(days=index)).isoformat() for index in range(days)]
	available = {day.get('date'): day for day in payload.get('forecast', [])}
	payload['forecast'] = [available[date] for date in expected_dates if date in available]
	payload['requested_days'] = days
	payload['returned_days'] = len(payload['forecast'])
	payload['forecast_complete'] = payload['returned_days'] == days
	return payload


def _save_weather_cache(q, days, payload):
	# Existing databases can contain several forecasts for the same location.
	# Update the latest matching duration without assuming location is unique.
	cached = WeatherCache.objects.filter(
		normalized_q=_normalize_weather_query(q), days=days,
	).order_by('-fetched_at', '-pk').first()
	if cached:
		cached.requested_q = q
		cached.payload = payload
		cached.save(update_fields=['requested_q', 'payload', 'fetched_at'])
	else:
		WeatherCache.objects.create(
			normalized_q=_normalize_weather_query(q), requested_q=q, days=days, payload=payload,
		)


def _weather_cache_response(q, days, error_message):
	normalized_q = _normalize_weather_query(q)
	try:
		recent = WeatherCache.objects.filter(
			normalized_q=normalized_q, fetched_at__gte=timezone.now() - timedelta(hours=3),
		).order_by('-fetched_at')
		cached = recent.filter(days__gte=days).first() or recent.first()
	except Exception:
		cached = None

	if not cached:
		return _weather_response({
			'ok': False,
			'error': str(error_message),
			'cache_available': False,
		}, status=502)

	payload = dict(cached.payload or {})
	if payload.get('current_provider') != 'open_meteo' or payload.get('forecast_provider') != 'open_meteo':
		return _weather_response({
			'ok': False,
			'error': str(error_message),
			'cache_available': False,
		}, status=502)
	payload['ok'] = True
	payload['source'] = 'cache'
	payload['stale'] = True
	payload['cache_available'] = True
	payload['cached_at'] = cached.fetched_at.isoformat()
	payload['cache_days'] = cached.days
	payload['external_error'] = str(error_message)

	if isinstance(payload.get('forecast'), list):
		from zoneinfo import ZoneInfo
		today = timezone.now().astimezone(ZoneInfo(FARM_WEATHER_TIMEZONE)).date().isoformat()
		payload['forecast'] = [day for day in payload['forecast'] if day.get('date', '') >= today][:days]

	return _weather_response(_forecast_coverage(payload, days))


def _open_meteo_condition(weather_code):
	"""Convert Open-Meteo WMO weather codes into the condition text used by the UI."""
	return condition_for_code(weather_code)


@api_view(['GET'])
def weather(request):
	"""
	Return a weather forecast for the requested city or lat/lon.

	Usage examples:
	  /api/weather/?q=Victoria, Oriental Mindoro, Philippines
	  /api/weather/?q=Lipa, Batangas, Philippines
	  /api/weather/?q=14.5496,121.0687&days=7  (lat,lon is most accurate)
	"""
	q = request.GET.get('q') or 'Victoria, Oriental Mindoro, Philippines'
	days = request.GET.get('days') or '7'
	try:
		days = int(days)
	except Exception:
		days = 7
	if days < 1:
		days = 1
	if days > 14:
		days = 14

	try:
		import requests
		from datetime import datetime

		latitude = None
		longitude = None
		location_name = str(q)
		location_region = ''
		location_country = ''

		query_text = str(q or '').strip()
		lat_lon_match = re.match(r'^\s*([-+]?\d+(?:\.\d+)?)\s*,\s*([-+]?\d+(?:\.\d+)?)\s*$', query_text)
		if lat_lon_match:
			latitude = float(lat_lon_match.group(1))
			longitude = float(lat_lon_match.group(2))
			if not (-90 <= latitude <= 90 and -180 <= longitude <= 180):
				return _weather_response({'error': 'Invalid latitude or longitude.'}, status=400)
		else:
			# The default farm has a known location; do not guess another city
			# when an arbitrary user query cannot be resolved.
			if query_text.lower() == 'victoria, oriental mindoro, philippines':
				latitude, longitude = 13.1772, 121.2781
				location_name, location_region, location_country = 'Victoria', 'Oriental Mindoro', 'Philippines'
		if latitude is None:
			geocode_response = requests.get('https://geocoding-api.open-meteo.com/v1/search', params={
				'name': query_text,
				'count': 1,
				'language': 'en',
				'format': 'json',
			}, timeout=15)
			if not geocode_response.ok:
				return _weather_cache_response(q, days, f'Weather provider returned HTTP {geocode_response.status_code}.')
			geocode_data = geocode_response.json()
			results = geocode_data.get('results') or []
			if results:
				selected = results[0]
				latitude = selected.get('latitude')
				longitude = selected.get('longitude')
				location_name = selected.get('name') or location_name
				location_region = selected.get('admin1') or selected.get('admin2') or location_region
				location_country = selected.get('country') or location_country
			if latitude is None or longitude is None:
				return _weather_response({'error': 'Location not found. Use latitude,longitude for your farm.'}, status=400)

		open_meteo_key = os.environ.get('OPEN_METEO_API_KEY', '').strip()
		weather_url = 'https://customer-api.open-meteo.com/v1/forecast' if open_meteo_key else 'https://api.open-meteo.com/v1/forecast'
		response = requests.get(weather_url, params={
			**({'apikey': open_meteo_key} if open_meteo_key else {}),
			'latitude': latitude,
			'longitude': longitude,
			'current': 'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,rain,is_day,precipitation,cloud_cover',
			'hourly': 'temperature_2m,precipitation_probability,rain,precipitation,weather_code',
			'daily': 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,rain_sum,precipitation_probability_max,wind_speed_10m_max,uv_index_max,sunrise,sunset,daylight_duration,sunshine_duration,precipitation_hours',
			'timezone': FARM_WEATHER_TIMEZONE,
			'forecast_days': days,
		}, timeout=15)
		if not response.ok:
			return _weather_cache_response(q, days, f'Weather provider returned HTTP {response.status_code}.')
		data = response.json()
		if not data.get('current') or not data.get('daily', {}).get('time'):
			return _weather_cache_response(q, days, 'Weather provider returned incomplete data.')

		def measurement(value, required=False):
			if value is None and not required:
				return None
			if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
				raise ValueError('Invalid weather measurement')
			return value

		def rounded(value, digits=0):
			return round(measurement(value), digits) if value is not None else None

		daily = data.get('daily') or {}
		forecast = []
		for i, date_str in enumerate(daily.get('time') or []):
			def daily_value(name):
				values = daily.get(name) or []
				return measurement(values[i] if i < len(values) else None)

			def daily_time(name):
				values = daily.get(name) or []
				value = values[i] if i < len(values) else None
				if value is not None and not isinstance(value, str):
					raise ValueError('Invalid weather time')
				return value

			weather_code = daily_value('weather_code')
			forecast.append({
				'dayIndex': i,
				'day': datetime.strptime(date_str, '%Y-%m-%d').strftime('%a'),
				'date': date_str,
				'temperature': {
					'max': round(measurement(daily_value('temperature_2m_max'), required=True)),
					'min': round(measurement(daily_value('temperature_2m_min'), required=True)),
				},
				'condition': _open_meteo_condition(weather_code),
				'rainfall': rounded(daily_value('precipitation_sum'), 1),
				'rainSum': rounded(daily_value('rain_sum'), 1),
				'precipitationSum': rounded(daily_value('precipitation_sum'), 1),
				'precipitationHours': rounded(daily_value('precipitation_hours'), 1),
				'rainChance': rounded(daily_value('precipitation_probability_max')),
				'wind': rounded(daily_value('wind_speed_10m_max')),
				'uv': daily_value('uv_index_max'),
				'weatherCode': weather_code,
				'sunrise': daily_time('sunrise'),
				'sunset': daily_time('sunset'),
				'daylightDuration': rounded(daily_value('daylight_duration')),
				'sunshineDuration': rounded(daily_value('sunshine_duration')),
			})

		current = data.get('current') or {}
		current_is_day = measurement(current.get('is_day'))
		if current_is_day is not None and current_is_day not in (0, 1):
			raise ValueError('Invalid daylight status')
		current_weather = {
			'temp': round(measurement(current.get('temperature_2m'), required=True)),
			'condition': _open_meteo_condition(current.get('weather_code')),
			'humidity': measurement(current.get('relative_humidity_2m')),
			'wind': rounded(current.get('wind_speed_10m')),
			'feelslike': rounded(current.get('apparent_temperature')),
			'uv': None,
			'rain': rounded(current.get('rain'), 1),
			'precipitation': rounded(current.get('precipitation'), 1),
			'isDay': None if current_is_day is None else bool(current_is_day),
			'cloudCover': rounded(current.get('cloud_cover')),
			'weatherCode': measurement(current.get('weather_code')),
			'last_updated': current.get('time'),
		}

		hourly_data = data.get('hourly') or {}
		hourly_forecast = []
		hourly_times = hourly_data.get('time') or []
		from zoneinfo import ZoneInfo
		local_now = timezone.now().astimezone(ZoneInfo(FARM_WEATHER_TIMEZONE)).strftime('%Y-%m-%dT%H:00')
		start_index = next((index for index, value in enumerate(hourly_times) if value >= local_now), len(hourly_times))
		for i in range(start_index, min(start_index + 13, len(hourly_times))):
			hour_string = hourly_times[i]
			try:
				hour_value = datetime.strptime(hour_string, '%Y-%m-%dT%H:%M')
			except ValueError:
				continue
			def hourly_value(name):
				values = hourly_data.get(name) or []
				return measurement(values[i] if i < len(values) else None)

			hourly_weather_code = hourly_value('weather_code')
			hourly_forecast.append({
				'time': hour_string,
				'label': hour_value.strftime('%I %p').lstrip('0'),
				'temperature': rounded(hourly_value('temperature_2m')),
				'condition': _open_meteo_condition(hourly_weather_code),
				'rainChance': rounded(hourly_value('precipitation_probability')),
				'rain': rounded(hourly_value('rain'), 1),
				'precipitation': rounded(hourly_value('precipitation'), 1),
				'weatherCode': hourly_weather_code,
			})

		location_info = {
			'name': location_name,
			'region': location_region,
			'country': location_country,
			'lat': latitude,
			'lon': longitude,
		}
		logger.info(
			'Open-Meteo weather: coordinates=(%s, %s), timezone=%s, '
			'current_weather_code=%s, current_condition=%s, daily=%s',
			latitude, longitude, FARM_WEATHER_TIMEZONE,
			current_weather['weatherCode'], current_weather['condition'],
			[
				{
					'date': day['date'],
					'weather_code': day['weatherCode'],
					'rainfall_mm': day['rainSum'],
					'precipitation_probability_max': day['rainChance'],
					'precipitation_hours': day['precipitationHours'],
				}
				for day in forecast[:7]
			],
		)

		payload = {
			'ok': True,
			'source': 'live',
			'current_provider': 'open_meteo',
			'forecast_provider': 'open_meteo',
			'stale': False,
			'fetched_at': timezone.now().isoformat(),
			'requested_q': q,
			'resolved_location': {
				'name': location_info.get('name'),
				'region': location_info.get('region'),
				'country': location_info.get('country'),
				'lat': location_info.get('lat'),
				'lon': location_info.get('lon'),
				'timezone': FARM_WEATHER_TIMEZONE,
			},
			'forecast': forecast,
			'current': current_weather,
			'hourly': hourly_forecast,
			'location': {
				'name': location_info.get('name', ''),
				'region': location_info.get('region', ''),
				'country': location_info.get('country', '')
			}
		}

	except Exception:
		return _weather_cache_response(q, days, 'Live weather is unavailable. Please try refreshing shortly.')

	payload = _forecast_coverage(payload, days)
	try:
		_save_weather_cache(q, days, payload)
	except Exception:
		pass
	return _weather_response(payload)
