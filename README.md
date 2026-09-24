# Smart Farming System

React/Vite frontend and Django backend for farm monitoring, weather, leaf disease,
and rambutan maturity checks.

This repository starts with a fresh source snapshot. Local credentials, account
databases, sensor data, datasets, dependencies, and downloaded verifier weights
are excluded. Keep the original working folder as a backup when migrating.

Original UI design: https://www.figma.com/design/LfK7S9ENumlM8BqkIOOiWV/Smart-Farming-System

For Railway hosting with Supabase, follow [the deployment guide](RAILWAY.md).
The Dockerfile builds the frontend and serves it with the API on one HTTPS domain.
Local accounts and historical ownership require a separate migration review.

## First-time setup (Windows / PowerShell)

Use Python 3.12 and Node.js. From the project root:

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend/requirements.txt
npm.cmd ci
```

On a **new checkout**, copy `backend/.env.example` to `backend/.env`. Fill in
`DJANGO_SECRET_KEY`. SQLite is the default; set `DATABASE_URL` to use
Supabase/PostgreSQL. Open-Meteo weather works without a key for the local demo.
Do not replace an existing local `.env` file.
If your `.env` already uses separate `DB_HOST`, `DB_USER`, `DB_PASSWORD` and
`DB_NAME` values, set `DB_ENGINE=postgresql` to select those credentials. Without
`DATABASE_URL` or an explicit database engine, the application uses local SQLite.
To send only sensor readings to Supabase while keeping existing local accounts
and sessions, set `SENSOR_DB_ENGINE=postgresql` with those same `DB_*` credentials.
Telemetry, monitoring, sensor history, and sensor-based advice then use the
Supabase `api_sensorreading` table. Restart Django after changing `.env`.
To generate a new Django secret:

```powershell
.\.venv\Scripts\python.exe -c "import secrets; print(secrets.token_urlsafe(50))"
```

Download the shared local fruit and leaf verifier once (approximately 600 MB):

```powershell
.\.venv\Scripts\python.exe backend/scripts/setup_rambutan_guard.py
```

The trained Keras models need their matching `.classes.json` files. Read
[training instructions](backend/TRAINING.md),
[rambutan verification and measured limits](backend/RAMBUTAN_CHECK.md), and
[leaf verification and measured limits](backend/LEAF_CHECK.md).
Datasets and downloaded verifier weights are kept outside Git.

## Run

Start Django in one terminal:

```powershell
.\.venv\Scripts\python.exe backend/manage.py migrate
.\.venv\Scripts\python.exe backend/manage.py runserver 0.0.0.0:8000
```

Start the frontend in another:

```powershell
npm.cmd run dev
```

Vite serves the app on port 3000 and forwards `/api` to `127.0.0.1:8000`.
The IoT device sends JSON readings to `http://<PC-LAN-IP>:8000/api/telemetry/`.
Use the PC's current Wi-Fi or hotspot address in the device code and include
that address in Django's `ALLOWED_HOSTS`. The dashboard fetches the latest
saved reading from `/api/sensors/` every 5 seconds.
Restart Django after replacing trained model files. Weather refreshes every
five minutes and also has a manual refresh button.

Open-Meteo supplies the forecast; see [weather setup](backend/WEATHER.md).
Add the PC's LAN address to `DJANGO_ALLOWED_HOSTS` for phone/device access.
The Vite proxy preserves the request host for session and CSRF validation.
If using `VITE_API_BASE` for a separate backend origin, configure
`DJANGO_CSRF_TRUSTED_ORIGINS` with the frontend origin as well.

Login establishes a Django session. Browser storage alone does not authorize
profile access. Existing browser-only logins need to sign in again. Prediction
history belongs to the signed-in user; older anonymous records are not assigned
to an arbitrary farmer. Gmail signup/reset needs OAuth configuration.
AI recommendations use `OPENAI_API_KEY` when available and identify built-in
guidance when the provider is unavailable.

Telemetry accepts numeric temperature, humidity, soil_raw, moisture_pct and
rain values. Missing measurements remain unavailable. The raw `rain` value is
not calibrated rainfall in millimeters; history does not sum it as rainfall.
Readings older than two minutes do not drive live monitoring or disease advice.

## Scan results in Supabase

With the `sensors` PostgreSQL connection configured above, set
`PREDICTION_SYNC_DATABASE=sensors` in `backend/.env`. Generate one UUID for
`PREDICTION_SYNC_NAMESPACE` and keep it with the local database; this identifies
its scan records and makes repeated syncs update the same cloud rows.

Run `.venv\Scripts\python.exe backend/manage.py sync_predictions --prepare`
from the project root once, then restart Django. This adds source columns to
Supabase's existing `api_prediction` table and copies saved results, keeping
original scan times. Run `sync_predictions` again to retry failed cloud writes;
`--ids 12 13` limits it to selected local records.

Accepted leaf and fruit scans save to local history and Supabase. Rejected or
uncertain images are not recorded as diagnoses. The result panel reports save
failures instead of hiding them. Existing local accounts and private history
remain intact. Cloud `source_user_id` identifies the original local owner;
`user_id` stays empty because Supabase's account IDs are unrelated. Anonymous
records remain anonymous. Records contain scan results and image filenames;
this does not upload image files to Supabase Storage.

## Google sign-in on localhost

For the Web application OAuth client used by this app, add `http://localhost`
and `http://localhost:3000` under **Authorized JavaScript origins** in
[Google Cloud's Clients page](https://console.cloud.google.com/auth/clients).
If you also use `http://127.0.0.1:3000`, authorize that exact origin separately.
This is a Google Cloud setting; Django CORS settings cannot authorize it.

When using your own client, set `VITE_GOOGLE_CLIENT_ID` in the project's
`.env.local` and the matching `GOOGLE_CLIENT_ID` in `backend/.env`, then restart
Vite and Django. These are public client IDs, not client secrets. Vite stays
on port 3000 so it cannot silently move to an unauthorized origin, and the
frontend and API send `Cross-Origin-Opener-Policy: same-origin-allow-popups`.
See [Google's setup guide](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid).

A password-login `400` with `Incorrect email or password.` is separate from
Google sign-in. Use the password created for the app; a Google account's
password is not an app password. Use **Forgot password?** to reset it if needed.

## Checks before a commit

```powershell
.\.venv\Scripts\python.exe backend/manage.py check
.\.venv\Scripts\python.exe backend/manage.py test api --settings=backend.test_settings
npm.cmd test
npm.cmd run build
.\.venv\Scripts\python.exe scripts/check_push.py
```

Review `git diff --stat` and `git diff --cached --stat` before committing.
Never commit `.env`, API keys, database passwords, `backend/db.sqlite3`, `.venv`,
`node_modules`, cache files, generated builds, or datasets. `.gitignore` does not remove files
that were already tracked; review those separately instead of using `git add .`.

The archived [system check report](SYSTEM_CHECK_REPORT.md) describes the original
working repository before this clean snapshot. Its old-history push blockers do
not describe this repository. The original repository and any remote copies of
it retain their history; review them separately for previously exposed data.
This repository is configured for local development; review production settings
separately before deployment.
