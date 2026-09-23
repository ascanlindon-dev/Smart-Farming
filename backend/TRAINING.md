# Training the leaf and rambutan classifiers

Run these PowerShell commands from the project root. The existing `.venv` has
the required packages. TensorFlow currently detects a CPU on this computer.

## Prepared datasets

The uploaded folders were copied into new, deduplicated splits using seed 42
and approximately 70% training / 15% validation / 15% testing per class.
The original folders and existing trained models were preserved.

| Dataset used for training | Class | Train | Validation | Test |
| --- | --- | ---: | ---: | ---: |
| `datasets/rambutan_clean_split` | mature | 146 | 31 | 32 |
| `datasets/rambutan_clean_split` | immature | 142 | 30 | 31 |
| `datasets/leaf_split` | algal leaf spot | 239 | 51 | 52 |
| `datasets/leaf_split` | anthracnose | 350 | 75 | 75 |
| `datasets/leaf_split` | healthy | 350 | 75 | 75 |
| `datasets/leaf_split` | sooty mold | 344 | 73 | 75 |

There are 412 distinct fruit files and 1,834 distinct leaf files. The original
fruit folders contained 458 files, including four groups repeated across
splits. The original leaf folders contained 2,000 files, including 41 groups
repeated across splits. Copies within each split were also removed.
All prepared images passed decoding. A further review found no images with
identical decoded RGB pixels shared between the prepared splits, including
the WebP images converted to PNG. The routine `--check-only` command checks
file bytes. Neither check detects near-duplicates, multiple views of the
same plant, or incorrect disease labels; keep related photos together when
preparing a future dataset. Folder labels were preserved, not medically or
visually reclassified.

## Check without training

```powershell
& .\.venv\Scripts\python.exe -B backend/train_rambutan.py --check-only
& .\.venv\Scripts\python.exe -B backend/train_finetune.py --check-only
```

Checks reject missing or empty classes, corrupt images, conflicting labels,
and identical images shared between splits. Each split must contain the same
class folders. `test/` is optional, but if present it must be complete.
WebP files must be converted to PNG or JPEG; the preparation script does this.

## Train

Run one command at a time:

```powershell
& .\.venv\Scripts\python.exe -B backend/train_rambutan.py --epochs 20 --batch 16 --unfreeze
& .\.venv\Scripts\python.exe -B backend/train_finetune.py --epochs 20 --batch 16 --unfreeze
```

Use `--batch 4` if memory is limited. `--unfreeze` adds up to ten fine-tuning
epochs after the initial classifier training; `--epochs-finetune` changes this.
Both scripts start from ImageNet MobileNetV2 weights, not the existing project
classifier. The required weights are already cached locally.

The fruit output order is **mature=0, immature=1**. Leaf classes are discovered
alphabetically from `train/`. The model stores a preprocessing layer that
converts the API's `[0, 1]` pixel range to MobileNetV2's `[-1, 1]` range. The
backbone's batch normalization statistics stay frozen during fine-tuning,
following the [Keras guide](https://keras.io/guides/transfer_learning/).

Training first writes temporary artifacts. After training and optional test
evaluation succeed, the best validation checkpoint across both stages replaces
the task's backend checkpoint and final model. Each model gets a matching
`.classes.json` file; the familiar `leaf_classes.json` and
`rambutan_classes.json` are also updated. The API caches labels with the loaded
model. **Restart the backend after training** to load the new model and labels.
The saved model and its matching class metadata are replaced only after the
training command finishes successfully.

## Visualization during and after training

The normal training commands now generate a report automatically:

- Fruit: `backend/evaluation/rambutan/report.html`
- Leaf: `backend/evaluation/leaf/report.html`

Open the corresponding HTML file in a browser. It refreshes every ten seconds
while training is running, with graphs updated after each completed epoch.
In VS Code, the PNG files can also be opened directly in an image preview.

Each report includes:

- **Accuracy and loss curves:** training versus validation across epochs.
- **Confusion matrix:** raw image counts and percentages within each actual class.
- **Class metrics:** precision, recall and F1 scores, plus the number of images.
- **Downloadable files:** `training_curves.png`, `confusion_matrix.png`,
  `class_metrics.png`, `confusion_matrix.csv`, `classification_report.txt`, and
  `metrics.json` in the report folder. The HTML embeds its charts and can be
  shared as one file without an internet connection.

The confusion matrix is generated after training from the **best checkpoint**
on the test split. If there is no test split, it uses validation and labels
that clearly. Training curves show every completed epoch, which may have
different results from the selected checkpoint.

PowerShell example to open an existing fruit report:

```powershell
Start-Process .\backend\evaluation\rambutan\report.html
```

Use `--report-dir backend/evaluation/experiment_2` to keep a separate report
for another run. The default report folder is refreshed for each new run.
An already-running training process does not reload these new callbacks;
after that process finishes, generate its report using the evaluation command
below. Do not restart training just to get the visualizations.

## Evaluate after training

```powershell
& .\.venv\Scripts\python.exe -B backend/confusion_matrix.py --type rambutan
& .\.venv\Scripts\python.exe -B backend/confusion_matrix.py --type leaf
```

Evaluation uses the prepared test split, saved model input size, and matching
class metadata. It also generates the HTML report and graphs, using the
matching training CSV when available. Reports are written under
`backend/evaluation/`. Old reports
do not measure performance on these new splits or classes.
Evaluation rejects missing predictions, invalid class indices, NaN/infinite
values, and invalid softmax probabilities before writing a new report.

For a custom model, provide the CSV from that same training run explicitly:

```powershell
& .\.venv\Scripts\python.exe -B backend/confusion_matrix.py --type rambutan --history backend/training_rambutan_log.csv
```

If no history is available, the report still includes evaluation graphs but
does not invent training curves. Older CSV files do not record the boundary
between initial training and fine-tuning; newly generated live reports do.

## Uncertain predictions in the app

The two-class fruit model uses an initial confidence cutoff of 60%. Below
that, the API returns `unknown` and the app displays "Uncertain Maturity".
The previous 35% cutoff could never reject a two-class softmax prediction:
one of the two scores must be at least 50%.

This 60% value is a starting setting, not a measured accuracy guarantee.
Tune `RAMBUTAN_BINARY_CONF_THRESHOLD` in `backend/api/views.py` using validation
results after full training, keeping the test split for final evaluation.
An uncertain maturity prediction does not prove that the picture is not a
rambutan. The API now runs a separate local object verifier before the maturity
classifier. A photo that does not pass returns `not_rambutan`, with no maturity
score or saved prediction. If the verifier cannot load, the API returns 503
and does not bypass the check. See [RAMBUTAN_CHECK.md](RAMBUTAN_CHECK.md).
Invalid model output causes an error instead of being stored as a prediction.

## Adding or replacing images

Add images to your source folders, then prepare a **new output folder**:

```powershell
& .\.venv\Scripts\python.exe -B backend/scripts/split_dataset.py --source datasets/rambutan_split --output datasets/rambutan_clean_split_v2 --include mature immature
& .\.venv\Scripts\python.exe -B backend/scripts/split_dataset.py --source datasets/raw_leaf_disease --output datasets/leaf_split_v2
```

Pass the new folder to training with `--root`, and to evaluation with
`--dataset`. The preparation script accepts raw class folders or existing
train/val/test folders. It refuses to overwrite an existing output folder.
Prepared copies do not automatically include later changes to the source.
Both preparation scripts reject invalid split ratios. The legacy
`split_rambutan_binary.py` helper also requires both maturity classes, at least
three unique images per class, and no identical images with conflicting labels.
