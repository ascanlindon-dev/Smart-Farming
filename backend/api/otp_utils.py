"""Helpers for generating, sending and verifying email one-time-passcodes (OTP)."""
import secrets
from datetime import timedelta

from django.utils import timezone

from .gmail_service import send_gmail_email
from .models import EmailOTP

OTP_TTL_MINUTES = 10
OTP_RESEND_COOLDOWN_SECONDS = 45
MAX_VERIFY_ATTEMPTS = 5

SUBJECTS = {
	'signup': 'Verify your RAMBUTECH account',
	'login': 'Your RAMBUTECH login code',
	'reset': 'Reset your RAMBUTECH password',
}


def _cooldown_remaining(email, purpose):
	last = EmailOTP.objects.filter(email=email, purpose=purpose).order_by('-created_at').first()
	if not last:
		return 0
	elapsed = (timezone.now() - last.created_at).total_seconds()
	return max(0, int(OTP_RESEND_COOLDOWN_SECONDS - elapsed))


def create_and_send_otp(email, purpose):
	"""Generate a 6-digit OTP, store it, and email it via Gmail.

	Returns (ok: bool, error_message: str | None).
	"""
	cooldown = _cooldown_remaining(email, purpose)
	if cooldown > 0:
		return False, f'Please wait {cooldown}s before requesting another code.'

	code = f'{secrets.randbelow(1_000_000):06d}'
	otp = EmailOTP.objects.create(
		email=email,
		code=code,
		purpose=purpose,
		expires_at=timezone.now() + timedelta(minutes=OTP_TTL_MINUTES),
	)

	subject = SUBJECTS.get(purpose, 'Your RAMBUTECH verification code')
	body_text = (
		f'Your RAMBUTECH verification code is: {code}\n\n'
		f'This code expires in {OTP_TTL_MINUTES} minutes. '
		'If you did not request this, you can safely ignore this email.'
	)
	try:
		send_gmail_email(email, subject, body_text)
	except Exception as e:
		otp.delete()
		return False, f'Failed to send verification email: {e}'
	return True, None


def verify_otp_code(email, code, purpose):
	"""Validate a submitted OTP code. Returns (ok: bool, error_message: str | None)."""
	otp = EmailOTP.objects.filter(email=email, purpose=purpose, consumed=False).order_by('-created_at').first()
	if not otp:
		return False, 'No verification code found. Please request a new one.'
	if otp.attempts >= MAX_VERIFY_ATTEMPTS:
		return False, 'Too many attempts. Please request a new code.'
	if timezone.now() > otp.expires_at:
		return False, 'This code has expired. Please request a new one.'
	if otp.code != str(code).strip():
		otp.attempts += 1
		otp.save(update_fields=['attempts'])
		return False, 'Incorrect code. Please try again.'

	otp.consumed = True
	otp.save(update_fields=['consumed'])
	return True, None
