"""Send email through the Gmail API using OAuth2 (refresh-token) credentials.

Requires these environment variables to be set before starting the Django server:
  GMAIL_CLIENT_ID      - OAuth2 client ID from Google Cloud Console
  GMAIL_CLIENT_SECRET  - OAuth2 client secret
  GMAIL_REFRESH_TOKEN  - refresh token obtained once via backend/setup_gmail_oauth.py
  GMAIL_SENDER_EMAIL   - the Gmail address the token was authorized for (used as "From")

See backend/setup_gmail_oauth.py for a one-time script that produces these values.
"""
import base64
import json
import os
from email.mime.text import MIMEText
from pathlib import Path

import requests
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials

GMAIL_SCOPES = ['https://www.googleapis.com/auth/gmail.send']
GMAIL_SEND_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send'
LOCAL_CREDENTIALS_FILE = Path(__file__).resolve().parents[1] / 'gmail_credentials.json'


class GmailNotConfigured(Exception):
	pass


def _get_access_token():
	config = {}
	if LOCAL_CREDENTIALS_FILE.exists():
		config = json.loads(LOCAL_CREDENTIALS_FILE.read_text(encoding='utf-8'))

	client_id = os.environ.get('GMAIL_CLIENT_ID') or config.get('client_id')
	client_secret = os.environ.get('GMAIL_CLIENT_SECRET') or config.get('client_secret')
	refresh_token = os.environ.get('GMAIL_REFRESH_TOKEN') or config.get('refresh_token')

	if not client_id or not client_secret or not refresh_token:
		raise GmailNotConfigured(
			'Gmail API is not configured. Set GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET and '
			'GMAIL_REFRESH_TOKEN (see backend/setup_gmail_oauth.py).'
		)

	creds = Credentials(
		token=None,
		refresh_token=refresh_token,
		token_uri='https://oauth2.googleapis.com/token',
		client_id=client_id,
		client_secret=client_secret,
		scopes=GMAIL_SCOPES,
	)
	creds.refresh(Request())
	return creds.token


def send_gmail_email(to_email, subject, body_text):
	"""Send a plain-text email via the Gmail API. Raises on failure."""
	config = {}
	if LOCAL_CREDENTIALS_FILE.exists():
		config = json.loads(LOCAL_CREDENTIALS_FILE.read_text(encoding='utf-8'))
	sender = os.environ.get('GMAIL_SENDER_EMAIL') or config.get('sender_email') or 'me'
	access_token = _get_access_token()

	message = MIMEText(body_text)
	message['to'] = to_email
	message['from'] = sender
	message['subject'] = subject
	raw = base64.urlsafe_b64encode(message.as_bytes()).decode('utf-8')

	response = requests.post(
		GMAIL_SEND_URL,
		headers={
			'Authorization': f'Bearer {access_token}',
			'Content-Type': 'application/json',
		},
		json={'raw': raw},
		timeout=15,
	)
	if not response.ok:
		raise RuntimeError(f'Gmail API returned {response.status_code}: {response.text}')
	return response.json()
