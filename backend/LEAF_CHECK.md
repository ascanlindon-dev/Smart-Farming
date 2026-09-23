# Leaf-only disease scans

The API verifies that the uploaded photo shows a leaf before loading or calling
the disease model. Disease confidence alone cannot establish that an object is
a leaf. A green-color check alone also misses brown or heavily diseased leaves.

`leaf_guard.py` compares healthy, spotted, yellow, brown, and dark leaf
descriptions against fruits, people, everyday objects, and backgrounds. It uses
the same local OpenCLIP encoder and downloaded weights as the rambutan check;
`image_verifier.py` loads one shared encoder per server process. Photos are
processed locally. This change does not retrain the disease model.

The leaf similarity must reach 0.25 and exceed the strongest competing
description by at least 0.02. These scores are screening thresholds, not
probability percentages or a guarantee against every unrelated object.

## App behavior

- Rejected photos return `type: not_leaf` and `leaf_verified: false`, with no
  disease label, treatment, or saved prediction.
- Accepted leaves return `leaf_verified: true`. If the disease model is
  uncertain, the app requests a clearer photo without saving a diagnosis.
- Missing verifier weights or dependencies return HTTP 503. The disease model
  cannot bypass an unavailable leaf check.
- The frontend sends the complete photo and shows a persistent "Leaves only" /
  "Dahon lamang" message when rejected.
- Disease example cards use their own sample photos and an "Example" /
  "Halimbawa" label. They never attach sample diagnoses or confidence scores
  to an unverified uploaded photo.

## Setup

The existing rambutan verifier installation also enables leaf verification.
On a new checkout, install `backend/requirements.txt`, then run from the root:

```powershell
.\.venv\Scripts\python.exe backend/scripts/setup_rambutan_guard.py
```

Restart Django after installation. The first scan takes longer while the
shared encoder loads. See [the verifier setup](RAMBUTAN_CHECK.md) for the
download location and pinned model revision.

## Measured results and limits

On the current test folders, the check accepted 273 of 277 leaf photos and
rejected all 67 non-leaf photos: 63 rambutan photos plus an apple, a banana,
lychees, and people near a bus. Four genuine leaf photos were rejected: one
heavily spotted brown leaf and three green-leaf photos with outdoor backgrounds.
The per-photo results are in `evaluation/leaf_guard/report.json`.

The descriptions were adjusted using a separate validation sample before this
test run. Final validation results are in `validation_samples.json`: 18 of 19
photos in the leaf folders passed, with the remaining photo showing a whole
orchard; all 12 non-leaf photos were rejected.

Live requests through the frontend proxy rejected all five tested non-leaf
uploads (`live_api_checks.json`). In-process requests with the actual models
accepted three leaf samples while intercepting history writes
(`pipeline_checks.json`). This verifies the request flow, not perfect disease
accuracy: the brown sample labeled anthracnose in the dataset was classified
as Sooty Mold by the existing disease model.

These results apply to the supplied photos. They do not measure performance
on every other object or prove that a leaf belongs to a particular species.
Test additional real phone photos of tools, people, backgrounds, other fruits,
and healthy/diseased leaves when expanding the evaluation.

To evaluate labeled folders without writing database records:

```powershell
.\.venv\Scripts\python.exe backend/check_leaf_guard.py --negative-root datasets/rambutan_clean_split/test --negative-root datasets/non_leaf_test
```

The default positive folder is `datasets/leaf_split/test`. Every image in each
negative folder must be a non-leaf example. Folder labels are used as supplied.

## Regression checks

```powershell
.\.venv\Scripts\python.exe backend/manage.py test api
node --test src/lib/leafScanResponse.test.mjs src/lib/maturityAdvice.test.mjs
npm.cmd run build
```
