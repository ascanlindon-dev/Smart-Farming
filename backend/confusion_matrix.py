"""Generate a confusion matrix from a saved classifier model.

This evaluates an existing model on a test or validation folder. It does not
train or fine-tune the model.

Usage from the project root:
python backend/confusion_matrix.py --type leaf
python backend/confusion_matrix.py --type rambutan

Optional:
python backend/confusion_matrix.py --type leaf --split val
"""

import argparse
import csv
import json
import zipfile
from pathlib import Path

import numpy as np
from dataset_checks import validate_dataset
from model_metadata import load_model_classes, read_class_names
from prediction_checks import validate_probabilities
from training_visualization import TrainingReport


MODEL_CONFIGS = {
    "leaf": {
        "model": "backend/modelkeras_leaf/trained_leaf_disease_model.keras",
        "classes": "backend/modelkeras_leaf/leaf_classes.json",
        "dataset": "datasets/leaf_split",
    },
    "rambutan": {
        "model": "backend/modelkeras_rambutan/trained_rambutan_maturity_model.keras",
        "classes": "backend/modelkeras_rambutan/rambutan_classes.json",
        "dataset": "datasets/rambutan_clean_split",
    },
}


def load_class_names(path):
    with path.open("r", encoding="utf-8") as fh:
        class_names = json.load(fh)
    if not isinstance(class_names, list) or not class_names:
        raise ValueError(f"Invalid class file: {path}")
    return class_names


def build_generator(data_dir, class_names, img_size, batch_size):
    from tensorflow.keras.preprocessing.image import ImageDataGenerator

    datagen = ImageDataGenerator(rescale=1.0 / 255)
    return datagen.flow_from_directory(
        str(data_dir),
        target_size=(img_size, img_size),
        batch_size=batch_size,
        class_mode="categorical",
        classes=class_names,
        shuffle=False,
        interpolation="bicubic",
    )


def compute_confusion_matrix(y_true, y_pred, num_classes):
    y_true, y_pred = np.asarray(y_true), np.asarray(y_pred)
    if y_true.ndim != 1 or y_pred.ndim != 1 or len(y_true) != len(y_pred):
        raise ValueError("Actual and predicted labels must have matching lengths.")
    for labels in (y_true, y_pred):
        if (not np.isfinite(labels).all() or np.any(labels < 0)
                or np.any(labels >= num_classes) or np.any(labels != np.floor(labels))):
            raise ValueError("Class indices must be integers within the model's class range.")
    matrix = np.zeros((num_classes, num_classes), dtype=int)
    for true_label, predicted_label in zip(y_true, y_pred):
        matrix[int(true_label), int(predicted_label)] += 1
    return matrix


def save_matrix_csv(matrix, class_names, path):
    with path.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh)
        writer.writerow(["Actual \\ Predicted", *class_names])
        for class_name, row in zip(class_names, matrix):
            writer.writerow([class_name, *row.tolist()])


def save_matrix_png(matrix, class_names, path):
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    fig, ax = plt.subplots(figsize=(max(6, len(class_names) * 1.4), max(5, len(class_names) * 1.2)))
    image = ax.imshow(matrix, interpolation="nearest", cmap="Blues")
    fig.colorbar(image, ax=ax)

    ax.set(
        xticks=np.arange(len(class_names)),
        yticks=np.arange(len(class_names)),
        xticklabels=class_names,
        yticklabels=class_names,
        ylabel="Actual",
        xlabel="Predicted",
        title="Confusion Matrix",
    )
    plt.setp(ax.get_xticklabels(), rotation=35, ha="right", rotation_mode="anchor")

    threshold = matrix.max() / 2 if matrix.size and matrix.max() else 0
    for row_index in range(matrix.shape[0]):
        for col_index in range(matrix.shape[1]):
            value = matrix[row_index, col_index]
            color = "white" if value > threshold else "black"
            ax.text(col_index, row_index, str(value), ha="center", va="center", color=color)

    fig.tight_layout()
    fig.savefig(path, dpi=160)
    plt.close(fig)


def maybe_save_classification_report(y_true, y_pred, class_names, path):
    try:
        from sklearn.metrics import classification_report
    except Exception:
        return False

    report = classification_report(y_true, y_pred, labels=list(range(len(class_names))), target_names=class_names, digits=4, zero_division=0)
    path.write_text(report, encoding="utf-8")
    return True


def remove_config_key(value, key_to_remove):
    if isinstance(value, dict):
        return {
            key: remove_config_key(item, key_to_remove)
            for key, item in value.items()
            if key != key_to_remove
        }
    if isinstance(value, list):
        return [remove_config_key(item, key_to_remove) for item in value]
    return value


def create_compatible_model_copy(model_path, output_dir):
    output_dir.mkdir(parents=True, exist_ok=True)
    compatible_path = output_dir / f"{model_path.stem}_compatible.keras"

    with zipfile.ZipFile(model_path, "r") as src, zipfile.ZipFile(compatible_path, "w") as dst:
        for item in src.infolist():
            data = src.read(item.filename)
            if item.filename == "config.json":
                config = json.loads(data.decode("utf-8"))
                config = remove_config_key(config, "quantization_config")
                data = json.dumps(config).encode("utf-8")
            dst.writestr(item, data)

    return compatible_path


def load_saved_model(model_path):
    import tensorflow as tf

    return tf.keras.models.load_model(str(model_path), compile=False)


def resolve_config(args, repo_root):
    config = MODEL_CONFIGS[args.type].copy()
    model_path = repo_root / config["model"]
    classes_path = repo_root / config["classes"]
    dataset_root = repo_root / config["dataset"]

    if args.model:
        model_path = Path(args.model)
        if not model_path.is_absolute():
            model_path = repo_root / model_path
    if args.classes:
        classes_path = Path(args.classes)
        if not classes_path.is_absolute():
            classes_path = repo_root / classes_path
    if args.dataset:
        dataset_root = Path(args.dataset)
        if not dataset_root.is_absolute():
            dataset_root = repo_root / dataset_root

    return model_path, classes_path, dataset_root / args.split


def main(args):
    if args.batch < 1:
        raise ValueError("Batch size must be positive.")
    repo_root = Path(__file__).resolve().parents[1]
    model_path, classes_path, data_dir = resolve_config(args, repo_root)

    if not model_path.exists():
        raise FileNotFoundError(f"Model not found: {model_path}")
    if not data_dir.exists():
        raise FileNotFoundError(f"Dataset split not found: {data_dir}")

    output_dir = repo_root / "backend" / "evaluation"
    output_dir.mkdir(parents=True, exist_ok=True)

    try:
        model = load_saved_model(model_path)
    except TypeError as exc:
        if "quantization_config" not in str(exc):
            raise
        compatible_model_path = create_compatible_model_copy(model_path, output_dir)
        print(f"Created compatible model copy: {compatible_model_path}")
        model = load_saved_model(compatible_model_path)

    num_classes = int(model.output_shape[-1])
    class_names = (read_class_names(classes_path, num_classes) if args.classes
                   else load_model_classes(model_path, num_classes, args.type, classes_path))
    validate_dataset(data_dir.parent, class_names)
    img_size = int(model.input_shape[1])
    if args.img_size is not None and args.img_size != img_size:
        raise ValueError(f"Model expects image size {img_size}, not {args.img_size}.")
    generator = build_generator(data_dir, class_names, img_size, args.batch)
    predictions = validate_probabilities(model.predict(generator, verbose=1), len(class_names), generator.samples)
    y_pred = np.argmax(predictions, axis=1)
    y_true = generator.classes

    matrix = compute_confusion_matrix(y_true, y_pred, len(class_names))
    accuracy = float(np.mean(y_true == y_pred)) if len(y_true) else 0.0

    stem = f"{args.type}_{args.split}_confusion_matrix"
    csv_path = output_dir / f"{stem}.csv"
    png_path = output_dir / f"{stem}.png"
    report_path = output_dir / f"{args.type}_{args.split}_classification_report.txt"

    save_matrix_csv(matrix, class_names, csv_path)
    save_matrix_png(matrix, class_names, png_path)
    report_saved = maybe_save_classification_report(y_true, y_pred, class_names, report_path)

    print("Confusion matrix")
    print(matrix)
    print(f"Accuracy: {accuracy:.4f}")
    print(f"Saved CSV: {csv_path}")
    print(f"Saved PNG: {png_path}")
    if report_saved:
        print(f"Saved report: {report_path}")
    else:
        print("Classification report skipped because scikit-learn is not installed.")

    visual_dir = (repo_root / args.report_dir).resolve() if getattr(args, "report_dir", None) else output_dir / args.type
    report = TrainingReport(visual_dir, args.type, class_names, data_dir.parent, model_path)
    history_path = getattr(args, "history", None)
    if history_path:
        history_path = (repo_root / history_path).resolve()
        report.load_csv(history_path)
    else:
        default_log = repo_root / "backend" / ("training_rambutan_log.csv" if args.type == "rambutan" else "training_leaf_disease_log.csv")
        # Never pair an older run's history with a new or custom model.
        if not args.model and default_log.exists() and default_log.stat().st_mtime >= model_path.stat().st_mtime:
            report.load_csv(default_log)
    report.finish(y_true, predictions, args.split)
    print(f"Visual report: {report.path.resolve()}")

    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--type", choices=sorted(MODEL_CONFIGS), required=True)
    parser.add_argument("--split", choices=["test", "val"], default="test")
    parser.add_argument("--img-size", type=int, default=None, help="Defaults to the saved model's input size")
    parser.add_argument("--batch", type=int, default=16)
    parser.add_argument("--model", help="Optional custom model path")
    parser.add_argument("--classes", help="Optional custom class JSON path")
    parser.add_argument("--dataset", help="Optional custom dataset root with test/val folders")
    parser.add_argument("--history", help="Optional training CSV from the same model run, for accuracy/loss graphs")
    parser.add_argument("--report-dir", help="Optional output folder for report.html and visualizations")
    raise SystemExit(main(parser.parse_args()))
