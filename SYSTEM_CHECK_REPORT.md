# System check — September 22, 2026

> Archived report for the original working repository, before the new repository
> was created. The history, staging, database, and validation observations below
> describe that earlier snapshot; they are not the current publishing status.

The tested local workflows work after the fixes below. **The repository is not
ready to push in its current state.** Fruit verification also needs more real
phone-photo evaluation before claiming reliable field performance.

## Feature results

| Area | Result and evidence | Remaining limit |
| --- | --- | --- |
| Disease detection | Actual local verifier and classifier returned the expected label for 8 held-out photos, covering all 4 leaf classes. Blank image rejected. Regression tests cover invalid uploads, uncertain results, missing verifier and class order. | This small sample is not a new accuracy evaluation. |
| Fruit maturity | Actual pipeline: 2 correct accepted results, 1 uncertain result, and 1 genuine mature fruit rejected by the verifier, from 4 photos. Blank image rejected. Accepted, rejected and retry UI flows pass. | The false rejection is a model limitation. No thresholds were weakened to hide it. |
| Responsive design/buttons | Five main screens checked at 375, 768 and 1440 px: no horizontal overflow or uncaught JavaScript errors. Navigation, sensor refresh, uploads, analyze, clear, retry and camera capture exercised. | Browser checks used mocked API responses and a simulated camera; real phone camera permissions remain device-dependent. |
| Sensors | Isolated database tests verify telemetry storage/retrieval, real zero values, rejected invalid values, missing data and stale-reading exclusion. Browser refresh hides stale values. | Device was offline, as confirmed by the user. Physical transmission and rain-sensor polarity/calibration were not verified. |
| AI recommendation | A live provider call with synthetic data returned generated advice. Tests cover malformed output and fallback. UI displays generated text with the correct source label. | Email/Google account flows were not exercised against external accounts. |
| API/weather | Session login, profile ownership, CSRF, password updates, private prediction history and telemetry passed tests. Live Open-Meteo returned a complete 7-day forecast. | Application remains configured for local development; this is not a production deployment audit. |

## Fixed issues

- Upload/analyze/clear and camera actions now wrap to the available card width,
  keep 44 px minimum touch targets, and support long Tagalog labels. Scan/result
  cards use one column below 1280 px to account for the desktop sidebar.
- Notifications were clipped by the dashboard header. They now render in a
  portaled popover above the dashboard with viewport collision handling,
  keyboard dismissal, and working open/remove/close actions.
- Sensor monitoring now distinguishes an empty database, a recent device
  reading, stale data, and request failure. It displays device/reading/check
  timestamps and retains automatic 30-second polling plus manual refresh.
  A conflicting responsive width rule that squeezed the status text behind
  the refresh button was also corrected.

- Monitoring crashed because `fetchFailed`/`setFetchFailed` did not exist. Fixed
  request state and removed unreachable duplicate polling. Added manual refresh.
- Monitoring claimed normal sensors without data. Missing/stale values now stay
  unavailable, including notification and disease-advice inputs.
- Raw rain readings were being added as millimeters. API/history now keep raw
  values separate and report calibrated rainfall amounts as unavailable.
- Uncertain leaf results were saved as diagnoses. They now request a retake
  without creating a prediction record. Failed leaf model metadata loading no
  longer leaves a partially initialized model cached.
- The maturity camera capture button lacked its label. Added English/Tagalog
  labels; camera streams are stopped on cleanup. Disease capture checks camera
  readiness and mobile capture cancellation releases the navigation lock.
- AI output could overwrite protected guidance fields or return objects where
  React expects text. Validated the response schema and limited accepted fields.
  Corrected generated/fallback labels and cleared old recommendation text when
  starting another result. Removed assumed disease severity from fallback copy.
- Login did not establish a server session; profiles could be selected/updated
  by supplying someone else's email. Login now establishes sessions, profiles
  require the session user, and browser storage is checked against the server.
- The account password button reported success without saving anything. It now
  calls a validated backend endpoint. Prediction history is scoped to its owner.
- Added shared API URL/session/CSRF handling and preserved the host through the
  Vite proxy. Restricted the dataset-confirmation endpoint to admins and rejected
  path-containing filenames/labels. OTP codes now use cryptographic randomness.
- Open-Meteo responses lacked coverage metadata, mislabeled the provider,
  invented zero measurements and could silently switch an unresolved location
  to Victoria. Corrected these, hourly start times, cache failure handling and
  error redaction. Tests/docs now match the requested Open-Meteo default.
- Removed the hardcoded secret from working settings; it comes from `.env`.
  Added missing Google dependencies, an isolated test database configuration,
  `npm test`, and a read-only push check. Removed a direct Windows-only npm
  dependency while retaining the appropriate optional native package.

## Validation

- 54 Django API tests passed; the final sensor/session subset (14) also passed
  after the last API response adjustment.
- 27 training/visualization tests passed using temporary fixtures. Existing
  trained application models were not retrained or replaced.
- 25 frontend helper tests passed.
- Production Vite build passed. It still warns about a large main JavaScript
  bundle; this is a performance improvement opportunity, not a build failure.
- Django system check passed; no missing model migrations were detected.
- Working-tree `git diff --check` passed.
- Follow-up production-browser checks passed: 24 upload/clear layouts across
  English/Tagalog and 320, 375, 640, 768, 1024 and 1440 px; notifications above
  dashboard content at four widths; all four sensor states at six widths.
  No uncaught browser JavaScript errors were recorded. API states were mocked.
- Local evidence: `.cache/model-results.json`, `.cache/provider-results.json`,
  `.cache/browser-check/results.json`, `.cache/browser-check/followup-results.json`,
  and screenshots in `.cache/browser-check`.

## Live sensor diagnosis

- Both the backend sensor URL and the frontend development proxy return HTTP
  200. The currently selected SQLite database's latest reading is July 23,
  2026, with temperature and humidity missing. A successful fetch cannot make
  this a current device reading.
- The existing `.env` also contains separate Supabase/PostgreSQL credentials,
  but neither `DATABASE_URL` nor `DB_ENGINE` selected them. A read-only query
  found 8,864 sensor rows in Supabase; its latest reading is September 17,
  2026. The Django model can read it, including temperature and humidity.
- Added support for explicitly selecting these existing credentials with
  `DB_ENGINE=postgresql`. The user's database choice is pending; `.env` remains
  unchanged and the running application still uses SQLite. To select Supabase,
  set that option and restart Django. No cloud migrations or farm-data writes
  were performed.
- Both sources are stale as of this check. Reconnect the device and confirm
  that `received_at` advances before expecting live measurements or advice.

## Push blockers

The read-only `python scripts/check_push.py` check reports:

1. **4,871 ignored/generated/private files are still tracked**, including
   datasets, dependencies, caches and `backend/db.sqlite3`. Adding ignore rules
   does not remove existing Git entries. The database can contain private data.
2. **The downloaded verifier is already committed as a 605,143,316-byte blob**
   (577.1 MiB): `backend/models/rambutan_guard/open_clip_model.safetensors`.
   It has a setup/download script and should not travel as an ordinary source
   blob. Removing it in a new commit leaves the old blob in history.
3. **The staged settings and existing commit still contain a hardcoded Django
   secret.** Working settings are fixed, but the Git index has not been replaced.
   Rotate exposed credentials and review/remove sensitive history before public
   publication. Deleting a current file does not erase old copies.
4. **The existing staged changes fail the whitespace/conflict check.** Review and
   stage the intended corrected source after repository cleanup; do not use an
   indiscriminate `git add .`.

No commit, push, history rewrite, index cleanup, credential rotation or real farm
database mutation was performed. Existing staged work was preserved. History
cleanup must be coordinated if these commits have already been shared.

## Running the corrected application

Restart Django and Vite. Sign in again to establish the new backend session;
the previous browser-only login is no longer sufficient. Existing anonymous
prediction records are not automatically reassigned to a user.

Use `backend/.env.example` as a reference; keep the existing `.env` intact.
For devices/phones, include the computer's current LAN address in
`DJANGO_ALLOWED_HOSTS`. With a separate backend origin, also configure the
frontend origin in `DJANGO_CSRF_TRUSTED_ORIGINS`.

Run the repeatable checks from the project root:

```powershell
.\.venv\Scripts\python.exe backend/manage.py check
.\.venv\Scripts\python.exe backend/manage.py test api --settings=backend.test_settings
npm.cmd test
npm.cmd run build
.\.venv\Scripts\python.exe scripts/check_push.py
```
