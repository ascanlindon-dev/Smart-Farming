"""Shared MobileNetV2 training and export for fruit and leaf classifiers."""

import json
import shutil
import tempfile
from pathlib import Path

import numpy as np
import tensorflow as tf
from tensorflow.keras import callbacks, layers, models
from tensorflow.keras.preprocessing.image import ImageDataGenerator

from dataset_checks import validate_dataset
from model_metadata import class_sidecar
from training_visualization import TrainingReport


def build_classifier(num_classes, input_shape=(224, 224, 3), base_trainable=False, dropout=0.3, weights="imagenet"):
    base = tf.keras.applications.MobileNetV2(input_shape=input_shape, include_top=False, weights=weights)
    base.trainable = base_trainable
    inputs = layers.Input(shape=input_shape)
    # The API and generators supply [0, 1]. MobileNetV2 needs [-1, 1].
    # Store this conversion in the model so old and new exports share the API.
    x = layers.Rescaling(2.0, offset=-1.0, name="mobilenet_preprocessing")(inputs)
    x = base(x, training=False)
    x = layers.GlobalAveragePooling2D()(x)
    x = layers.Dropout(dropout)(x)
    x = layers.Dense(256, activation="relu")(x)
    x = layers.Dropout(dropout)(x)
    outputs = layers.Dense(num_classes, activation="softmax")(x)
    model = models.Model(inputs, outputs)
    model.backbone = base
    return model


def unfreeze_backbone(model):
    model.backbone.trainable = True
    # Preserve the ImageNet moving means and variances while fine-tuning.
    for layer in model.backbone.layers:
        if isinstance(layer, layers.BatchNormalization):
            layer.trainable = False


def build_generator(directory, class_names, img_size, batch_size, training=False, seed=42, rotation=20):
    augmentation = dict(
        rotation_range=rotation, width_shift_range=0.1, height_shift_range=0.1,
        brightness_range=(0.75, 1.25), shear_range=0.1, zoom_range=0.2,
        horizontal_flip=True, fill_mode="reflect",
    ) if training else {}
    datagen = ImageDataGenerator(rescale=1.0 / 255, **augmentation)
    return datagen.flow_from_directory(
        str(directory), target_size=img_size, batch_size=batch_size,
        classes=class_names, class_mode="categorical", color_mode="rgb",
        interpolation="bicubic", shuffle=training, seed=seed,
    )


def compile_model(model, learning_rate):
    model.compile(optimizer=tf.keras.optimizers.Adam(learning_rate), loss="categorical_crossentropy", metrics=["accuracy"])


class EpochVisualization(callbacks.Callback):
    def __init__(self, report):
        super().__init__()
        self.report = report
        self.stage = "training"

    def on_epoch_end(self, epoch, logs=None):
        self.report.record_epoch(epoch, logs or {}, self.stage)


def train_and_export(model, train_gen, val_gen, test_gen, args, model_dir, checkpoint_path, final_path, class_file, class_names, log_path, report_dir=None, task=None):
    """Export the best checkpoint across both stages only after training succeeds."""
    model_dir.mkdir(parents=True, exist_ok=True)
    task = task or model_dir.name.removeprefix("modelkeras_")
    report_dir = Path(report_dir) if report_dir else model_dir.parent / "evaluation" / task
    report = TrainingReport(report_dir, task, class_names, Path(train_gen.directory).parent, final_path)
    report.write()
    visualization = EpochVisualization(report)
    print(f"Live training report: {report.path.resolve()}")
    print("Open report.html in your browser; it refreshes every 10 seconds during training.")
    # A failed run must not replace the application's existing model or labels.
    with tempfile.TemporaryDirectory(prefix="training_", dir=model_dir) as work:
        staged_checkpoint = Path(work) / "best.keras"
        staged_log = Path(work) / "training.csv"
        checkpoint = callbacks.ModelCheckpoint(str(staged_checkpoint), monitor="val_accuracy", mode="max", save_best_only=True)

        def callback_list():
            return [checkpoint,
                    callbacks.EarlyStopping(monitor="val_accuracy", mode="max", patience=6, restore_best_weights=True),
                    callbacks.ReduceLROnPlateau(monitor="val_loss", factor=0.5, patience=3, min_lr=1e-6),
                    callbacks.CSVLogger(str(staged_log), append=staged_log.exists()),
                    visualization]

        counts = np.bincount(train_gen.classes, minlength=len(class_names))
        class_weights = {i: float(counts.sum() / (len(counts) * count)) for i, count in enumerate(counts)}
        compile_model(model, 1e-3)
        history = model.fit(train_gen, validation_data=val_gen, epochs=args.epochs,
                            class_weight=class_weights, callbacks=callback_list())
        if args.unfreeze:
            visualization.stage = "fine_tuning"
            unfreeze_backbone(model)
            compile_model(model, 1e-5)
            first_epoch = len(history.epoch)
            model.fit(train_gen, validation_data=val_gen, initial_epoch=first_epoch,
                      epochs=first_epoch + args.epochs_finetune, class_weight=class_weights,
                      callbacks=callback_list())

        best_model = tf.keras.models.load_model(staged_checkpoint, compile=False)
        report.status = "evaluating"
        report.write()
        if test_gen is not None:
            compile_model(best_model, 1e-5)
            loss, accuracy = best_model.evaluate(test_gen, verbose=1)
            print(f"Best model test loss: {loss:.4f}; accuracy: {accuracy:.4f}")
        else:
            loss = None
        evaluation_gen = test_gen if test_gen is not None else val_gen
        evaluation_gen.reset()
        predictions = best_model.predict(evaluation_gen, verbose=1)
        report.finish(evaluation_gen.classes, predictions, "test" if test_gen is not None else "val", loss)
        labels = json.dumps(class_names, indent=2, ensure_ascii=False) + "\n"
        for destination in (checkpoint_path, final_path):
            shutil.copy2(staged_checkpoint, destination)
            class_sidecar(destination).write_text(labels, encoding="utf-8")
        class_file.write_text(labels, encoding="utf-8")
        shutil.copy2(staged_log, log_path)
    print(f"Training complete. Best model: {final_path}")
    print(f"Graphs and confusion matrix: {report.path.resolve()}")
    print("Restart the backend to load the new model and class order.")


def run_training(args, task, model_builder, class_names=None):
    repo_root = Path(__file__).resolve().parents[1]
    root = (repo_root / args.root).resolve()
    if args.batch < 1 or args.epochs < 1 or args.epochs_finetune < 1 or args.img_size < 32:
        print("Use positive batch/epoch values and an image size of at least 32.")
        return 1
    try:
        class_names, counts = validate_dataset(root, class_names)
    except (ValueError, OSError) as exc:
        print(exc)
        return 1
    print("Class order:", class_names)
    if args.check_only:
        print("Dataset check passed. No training or model files changed.")
        return 0

    tf.keras.utils.set_random_seed(args.seed)
    img_size = (args.img_size, args.img_size)
    train_gen = build_generator(root / "train", class_names, img_size, args.batch, training=True, seed=args.seed, rotation=25 if task == "rambutan" else 20)
    val_gen = build_generator(root / "val", class_names, img_size, args.batch)
    test_gen = build_generator(root / "test", class_names, img_size, args.batch) if "test" in counts else None
    model = model_builder(len(class_names), input_shape=(*img_size, 3))
    model.summary()
    model_dir = repo_root / "backend" / f"modelkeras_{task}"
    stem = "rambutan_maturity" if task == "rambutan" else "leaf_disease"
    checkpoint_stem = "rambutan" if task == "rambutan" else "leaf_disease"
    train_and_export(
        model, train_gen, val_gen, test_gen, args, model_dir,
        repo_root / "backend" / f"model_{checkpoint_stem}_checkpoint.keras",
        model_dir / f"trained_{stem}_model.keras", model_dir / f"{task}_classes.json",
        class_names, repo_root / "backend" / f"training_{checkpoint_stem}_log.csv",
        report_dir=(repo_root / args.report_dir).resolve() if getattr(args, "report_dir", None) else None,
        task=task,
    )
    return 0


def add_training_arguments(parser, default_root):
    parser.add_argument("--root", default=default_root, help="Dataset root containing train/ and val/ class folders")
    parser.add_argument("--epochs", type=int, default=20)
    parser.add_argument("--batch", type=int, default=16)
    parser.add_argument("--img-size", type=int, default=224)
    parser.add_argument("--unfreeze", action="store_true", help="Fine-tune the backbone after training the classifier head")
    parser.add_argument("--epochs-finetune", type=int, default=10)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--check-only", action="store_true", help="Validate all dataset splits without training or overwriting models")
    parser.add_argument("--report-dir", help="Optional output folder for report.html, graphs and confusion matrix")
