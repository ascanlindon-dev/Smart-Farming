# Deploy to Railway with Supabase

The root Dockerfile builds React and serves it with Django on one HTTPS domain.
It installs CPU inference dependencies and downloads the pinned 577 MiB verifier
during the build. Gunicorn uses one process to avoid duplicating model memory.
There is no separate frontend service and no `VITE_API_BASE` to configure.

## Redeploy after local development

Push this checkout's changes to the branch connected to your existing Railway
service, then deploy that latest commit. A redeploy of an older commit will not
include these fixes. Keep the service root at the repository root and remove
old custom build/start commands so Railway uses `Dockerfile` and its Gunicorn
startup script. The script always selects `backend.production` and listens on
Railway's `PORT`.

Remove any old `VITE_API_BASE` variable. Every browser request now uses a relative
`/api/...` URL, including login, signup, Google sign-in, scans, and both history
tables. The local Vite proxy is development-only and is not part of the deployed
server. Production CSRF/CORS origins come from the public HTTPS hostnames.

Use the existing Supabase database's `DATABASE_URL` to retain its sensor readings;
an empty new database will have no history. Do not copy the local `.env` into
Railway. Leave `SENSOR_DB_ENGINE` and `PREDICTION_SYNC_DATABASE` unset on the
hosted service, and supply the public hostname and credentials listed below.

Useful routes after deployment:

| Path | Expected behavior |
| --- | --- |
| `/` and browser navigation paths | React app; refreshing a nested path loads the app |
| `/api/ping/` | API availability check |
| `/api/csrf/` | Session-safe token for login and other writes |
| `/api/predictions/transactions/?page_size=50` | Latest predictions for the signed-in account |
| `/api/sensors/readings/?page_size=50` | Latest readings from the existing sensor table; requires login |
| `/healthz/` | Railway readiness check |

Unknown API URLs and missing static files return 404. The old `/api/ping`,
`/api/login`, and `/api/logout` URLs remain supported without redirects.

## Before the first deployment

Use the clean `Smart-Farming` repository, not the archived original folder.
Commit and push the deployment files before connecting Railway to the branch.

For this computer, open `C:\wamp64\www\Smart-Farming` with VS Code's
**File > Open Folder** and keep future app edits in that checkout. The original
`Smart Farming System (1)` folder still points to the older `RAMBUTECH` repository;
changes do not automatically sync between the two folders. Keep it for the local
database, training datasets, and other original files.

Before committing or pushing, verify the destination in the terminal:

```powershell
Set-Location 'C:\wamp64\www\Smart-Farming'
git remote get-url origin
git status --short --branch
```

The remote must be `https://github.com/ascanlindon-dev/Smart-Farming.git`.
Commit the reviewed app and deployment files here, then push `main`. Railway's
service source must also be `ascanlindon-dev/Smart-Farming`, branch `main`.
Copying the old `.git` directory or merging its commits would bring back the
large history; transfer reviewed source changes as ordinary file edits instead.

The hosted application uses one Supabase PostgreSQL database for users, sessions,
sensor readings, and scan history. It does not copy results between databases.
Local SQLite accounts are **not automatically migrated**. Old cloud scan copies
with `user_id=NULL` are not automatically assigned to a signed-in user, even when
their `source_user_id` happens to match. Plan account/history migration separately;
preserve the original SQLite file and its sync namespace as the backup.

Back up the existing Supabase database and inspect its Django migration history
before applying migrations. Existing manually created tables can require schema
reconciliation. Do not resolve conflicts with `--fake`, table deletion, or an
unreviewed import of local numeric user IDs.

## Railway setup

1. Create a Railway project from `ascanlindon-dev/Smart-Farming`, branch `main`.
   Keep the service root at the repository root so it finds `Dockerfile` and
   `railway.json`. No custom build or start command is needed.
2. Under Networking, generate a public domain. Add variables using
   [backend/railway.env.example](backend/railway.env.example) as the reference.
3. Set `DJANGO_ALLOWED_HOSTS` to your exact hostname, without `https://` or a
   trailing slash. `RAILWAY_PUBLIC_DOMAIN` is also recognized automatically.
   Railway's healthcheck host is added separately.
4. Set `DJANGO_SECRET_KEY` and `TELEMETRY_API_KEY` to **different** random values.
   Generate each privately with `python -c "import secrets; print(secrets.token_urlsafe(50))"`.
5. Set `DATABASE_URL` from Supabase's **Connect** dialog. Prefer the Session
   pooler string when using an IPv4 connection, with SSL. Percent-encode reserved
   characters in the database password. This is a server secret, not a Supabase
   public API key. Do not put it in a `VITE_` variable or Git.
6. Leave `SENSOR_DB_ENGINE`, `PREDICTION_SYNC_DATABASE`, and
   `PREDICTION_SYNC_NAMESPACE` unset. Those belong to the old local-to-cloud setup.
7. Configure Google and Gmail as described below, then review and apply the
   database migrations before starting the app.

Use a Railway service with enough memory for TensorFlow, PyTorch, the verifier,
and the trained classifiers together. Measure memory during real scans; model
file size alone is not a reliable RAM requirement. Keep one replica initially.
The first build downloads large dependencies and weights and can take time.
HTTPS redirection and secure cookies are enforced. HSTS lasts one hour on the
exact hostname. Subdomain coverage and browser preload are deliberately off;
their two optional Django recommendations (W005/W021) are explicitly silenced
until the domain owner chooses that policy.

## Database preparation

On a machine with the project's Python dependencies and an authenticated Railway
CLI, run these from the repository root against the selected Railway service:

```sh
railway run python backend/manage.py showmigrations
railway run python backend/manage.py migrate --plan
```

After checking the plan and reconciling any existing table/account conflicts:

```sh
railway run python backend/manage.py migrate --noinput
```

These commands use the **hosted database**, not the local SQLite file. The app's
start script only runs `migrate --check`; it never silently changes the existing
database on a redeploy. Pending migrations stop startup until the reviewed
migration step is completed. For an approved migration plan, Railway's temporary
Pre-deploy Command can also run `python backend/manage.py migrate --noinput`.
Remove that command afterward if migrations will continue to be reviewed manually.

## Login, email, and devices

- Set `GOOGLE_CLIENT_ID` and build variable `VITE_GOOGLE_CLIENT_ID` to the same
  Web application client ID. Authorize `https://YOUR-DOMAIN` in Google Cloud's
  **Authorized JavaScript origins**. Changing the Vite variable requires a rebuild.
- Set the Gmail OAuth variables for signup verification and password resets.
  Without them, those email flows will not work; Google sign-in is separate.
- Change the device telemetry URL to `https://YOUR-DOMAIN/api/telemetry/` and
  send `X-Telemetry-Key: <TELEMETRY_API_KEY>` in every upload. Configure HTTPS
  certificate verification in the device firmware. Keep the key out of the React
  frontend and do not put it in query strings. Old device firmware without the
  header will receive HTTP 401 from the hosted app.
- Hosted scan and recommendation endpoints require a signed-in account. Local
  development keeps its existing behavior. API requests have basic per-process
  rate limits; add a shared limiter before increasing workers or replicas.

## Verify the deployed app

The deployment healthcheck is `/healthz/`. It requires a database connection, the
frontend build, and the verifier file; it does not run model inference. Test the
homepage, signup/reset email, Google login, a real leaf scan, a real fruit scan,
and an authenticated device upload. Confirm saved records survive a redeploy.
Old private history must only become visible after an explicit ownership-aware
migration. This deployment saves scan results and image filenames, not uploaded
image files in Supabase Storage.

Source references: [Railway Dockerfiles](https://docs.railway.com/builds/dockerfiles),
[Railway healthchecks](https://docs.railway.com/deployments/healthchecks),
[Railway migrations](https://docs.railway.com/deployments/pre-deploy-command),
[Supabase connections](https://supabase.com/docs/guides/database/connecting-to-postgres).
