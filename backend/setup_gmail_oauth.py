"""One-time helper to obtain a Gmail API refresh token for sending OTP emails.

Steps:
1. In Google Cloud Console (https://console.cloud.google.com/), create/select a
   project and enable the "Gmail API" (APIs & Services > Library).
2. Configure the OAuth consent screen (External is fine for testing; add the
   Gmail address you'll send from as a test user).
3. Create OAuth client credentials of type "Desktop app" (APIs & Services >
   Credentials) and download the JSON file. Save it next to this script as
   client_secret.json. Do NOT commit this file to git.
4. Run:  python setup_gmail_oauth.py
   A browser window opens; sign in with the Gmail account that should send
   the OTP emails and approve the "Send email on your behalf" permission.
5. The script writes the authorized sender credentials to
   gmail_credentials.json in this folder. Keep this file private.
"""
import json
from pathlib import Path

from google_auth_oauthlib.flow import InstalledAppFlow

SCOPES = ['https://www.googleapis.com/auth/gmail.send']


def main():
   credential_file = Path(__file__).with_name('client_secret.json')
   if not credential_file.exists():
      matches = list(Path(__file__).parent.glob('client_secret*.json'))
      if len(matches) == 1:
         credential_file = matches[0]
      else:
         raise FileNotFoundError(
            'Place the downloaded Google OAuth client JSON in the backend folder. '
            f'Expected {credential_file.name}.'
         )

   flow = InstalledAppFlow.from_client_secrets_file(str(credential_file), SCOPES)
   # Force a fresh consent grant so a newly-created OAuth client receives a
   # refresh token associated with that client, rather than reusing an older
   # authorization grant.
   creds = flow.run_local_server(port=0, prompt='consent')
   sender_email = input('Enter the Gmail account you just authorized: ').strip()
   if not sender_email:
      raise ValueError('A sender Gmail address is required.')

   config_file = Path(__file__).with_name('gmail_credentials.json')
   config_file.write_text(json.dumps({
      'client_id': creds.client_id,
      'client_secret': creds.client_secret,
      'refresh_token': creds.refresh_token,
      'sender_email': sender_email,
   }, indent=2), encoding='utf-8')
   print(f'\nSuccess! Gmail sender {sender_email} is configured.')
   print('You can now start the backend with: python manage.py runserver')


if __name__ == '__main__':
   main()
