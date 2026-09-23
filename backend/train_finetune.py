"""Train the leaf disease classifier using matching class folders in each split.

Expected layout: train/<class>/*, val/<class>/* and optional test/<class>/*.
Class names are discovered from train/ and used in the same order everywhere.
The current dataset contains algal leaf spot, anthracnose, healthy, sooty mold.

From the project root:
    .venv/Scripts/python.exe backend/train_finetune.py --check-only
    .venv/Scripts/python.exe backend/train_finetune.py --unfreeze
"""

import argparse
from pathlib import Path

from training_common import add_training_arguments, build_classifier, build_generator, run_training


def build_generators(train_dir, val_dir, img_size=(224, 224), batch_size=16):
    classes = sorted(p.name for p in Path(train_dir).iterdir() if p.is_dir() and not p.name.startswith("."))
    return (
        build_generator(train_dir, classes, img_size, batch_size, training=True),
        build_generator(val_dir, classes, img_size, batch_size),
    )


def build_test_generator(test_dir, img_size=(224, 224), batch_size=16, class_names=None):
    if class_names is None:
        train_dir = Path(test_dir).parent / "train"
        class_names = sorted(p.name for p in train_dir.iterdir() if p.is_dir() and not p.name.startswith("."))
    return build_generator(test_dir, class_names, img_size, batch_size)


def build_model(num_classes, input_shape=(224, 224, 3), base_trainable=False, weights="imagenet"):
    return build_classifier(num_classes, input_shape, base_trainable, dropout=0.3, weights=weights)


def main(args):
    return run_training(args, "leaf", build_model)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    add_training_arguments(parser, "datasets/leaf_split")
    raise SystemExit(main(parser.parse_args()))
