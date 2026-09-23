"""Train the two-class rambutan fruit classifier.

Expected layout: train/, val/ and optional test/, each containing mature/ and
immature/. The saved class order is mature=0, immature=1.

From the project root:
    .venv/Scripts/python.exe backend/train_rambutan.py --check-only
    .venv/Scripts/python.exe backend/train_rambutan.py --unfreeze

The default uses the deduplicated copy in datasets/rambutan_clean_split.
Use --root datasets/rambutan_split to check the original uploaded folders.
"""

import argparse

from training_common import add_training_arguments, build_classifier, build_generator, run_training


RAMBUTAN_CLASSES = ["mature", "immature"]


def build_generators(train_dir, val_dir, img_size=(224, 224), batch_size=16):
    return (
        build_generator(train_dir, RAMBUTAN_CLASSES, img_size, batch_size, training=True, rotation=25),
        build_generator(val_dir, RAMBUTAN_CLASSES, img_size, batch_size),
    )


def build_test_generator(test_dir, img_size=(224, 224), batch_size=16):
    return build_generator(test_dir, RAMBUTAN_CLASSES, img_size, batch_size)


def build_model(num_classes, input_shape=(224, 224, 3), base_trainable=False, weights="imagenet"):
    return build_classifier(num_classes, input_shape, base_trainable, dropout=0.35, weights=weights)


def main(args):
    return run_training(args, "rambutan", build_model, RAMBUTAN_CLASSES)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    add_training_arguments(parser, "datasets/rambutan_clean_split")
    raise SystemExit(main(parser.parse_args()))
