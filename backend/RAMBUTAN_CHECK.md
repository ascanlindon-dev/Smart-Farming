# Rambutan-only maturity scans

The API checks the photo before calling the existing mature/immature model.
It uses a separate local [OpenCLIP](https://github.com/mlfoundations/open_clip)
ViT-B-32 model with LAION-2B weights. It compares rambutan descriptions with
other fruits, leaves, people, everyday objects, and blank photos. It does not
send uploaded photos to an external API.

An image must have rambutan similarity of at least 0.25 and exceed the strongest
competing description by at least 0.02. These are conservative screening rules,
not probability percentages. The maturity model still uses its separate 60%
confidence threshold.

- Rejected photos get a request to take another photo, with no maturity advice.
- Rejected and uncertain scans are not saved in prediction history.
- Missing weights/dependencies return 503 instead of skipping the check.
- The first request loads the verifier into memory and takes longer.

## Install on a new computer

From the project root, install `backend/requirements.txt` and run:

```powershell
.\.venv\Scripts\python.exe backend/scripts/setup_rambutan_guard.py
```

The script downloads approximately 600 MB into `backend/models/rambutan_guard`.
The model weights are ignored by Git. The download is pinned to revision
`1a25a446712ba5ee05982a381eed697ef9b435cf` of
[`laion/CLIP-ViT-B-32-laion2B-s34B-b79K`](https://huggingface.co/laion/CLIP-ViT-B-32-laion2B-s34B-b79K).
Restart Django after installation. Prediction uses the downloaded file offline.

## Measured limits

The check is stricter than the original maturity classifier. On the 63 held-out
rambutan images, 51 passed and 12 required a retake. It rejected all 277 held-out
leaf images and four additional photos: an apple, a banana, lychees, and people
near a bus. Details are in `evaluation/rambutan_guard/report.json`.

This small set of other objects does not establish accuracy for all non-rambutan
photos. Some real rambutan photos are rejected too. No classifier can guarantee
that every unrelated object is rejected. Collect separate train, validation,
and test photos of other fruits, people, tools, and backgrounds from the actual
farm for a trained rambutan/not-rambutan classifier and broader evaluation.
Keep genuine rambutan from both maturity stages in that evaluation.

To evaluate another negative-photo folder without writing database records:

```powershell
.\.venv\Scripts\python.exe backend/check_rambutan_guard.py --negative-root datasets/non_rambutan_test
```

The additional public test photos are local evaluation fixtures, not training
data or application assets:

- [Apple](https://commons.wikimedia.org/wiki/File:Red_Apple.jpg)
- [Banana](https://commons.wikimedia.org/wiki/File:Banana-Single.jpg)
- [Lychees, Peggy Greb / USDA ARS, public domain](https://commons.wikimedia.org/wiki/File:ARS_Litchi_chinensis.jpg)
- [People near a bus, Ultralytics sample](https://github.com/ultralytics/assets/blob/main/im/bus.jpg)

## Simple advice

`src/lib/maturityAdvice.mjs` supplies short English and Tagalog steps. Advice
changes with the selected language and appears only for accepted maturity
results. It avoids technical storage settings, claimed sugar content, quality
grades, and exact harvest dates that cannot be measured from the photo.
The fruit screen also requests an optional generated summary for accepted
results. Built-in harvesting guidance stays available if that request fails.

The picking and handling text follows [FAO rambutan guidance](https://www.fao.org/4/ad523e/ad523e04.htm)
and [University of Hawaii postharvest guidance](https://www.ctahr.hawaii.edu/oc/freepubs/pdf/F_N-33.pdf).
