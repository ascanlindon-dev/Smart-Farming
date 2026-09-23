"""Regression checks for dataset validation, class order and fine-tuning."""

import contextlib
import io
import json
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import numpy as np
from PIL import Image

from dataset_checks import validate_dataset
from model_metadata import class_sidecar, load_model_classes
from scripts.split_dataset import collect_unique_images, ensure_clean_dir
from scripts.split_dataset import split_items, validate_unique_classes
from scripts import split_rambutan_binary
from prediction_checks import validate_probabilities
from confusion_matrix import compute_confusion_matrix


class DatasetValidationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        for i, split in enumerate(("train", "val", "test")):
            for j, name in enumerate(("mature", "immature")):
                folder = self.root / split / name
                folder.mkdir(parents=True)
                Image.new("RGB", (8, 8), (i * 50, j * 70, 30)).save(folder / "image.png")

    def validate(self):
        with contextlib.redirect_stdout(io.StringIO()):
            return validate_dataset(self.root, ["mature", "immature"])

    def test_class_order_and_optional_test_split(self):
        names, counts = self.validate()
        self.assertEqual(names, ["mature", "immature"])
        self.assertEqual(counts["train"], {"mature": 1, "immature": 1})

    def test_empty_class_is_rejected(self):
        (self.root / "val" / "mature" / "image.png").unlink()
        with self.assertRaisesRegex(ValueError, "no supported images"):
            self.validate()

    def test_missing_or_renamed_class_is_rejected(self):
        (self.root / "val" / "mature").rename(self.root / "val" / "ripe")
        with self.assertRaisesRegex(ValueError, "missing classes.*mature.*unexpected classes.*ripe"):
            self.validate()

    def test_duplicate_across_splits_is_rejected(self):
        (self.root / "val" / "mature" / "image.png").write_bytes((self.root / "train" / "mature" / "image.png").read_bytes())
        with self.assertRaisesRegex(ValueError, "repeated across splits"):
            self.validate()

    def test_conflicting_labels_are_rejected_before_copying(self):
        (self.root / "train" / "immature" / "image.png").write_bytes((self.root / "train" / "mature" / "image.png").read_bytes())
        with self.assertRaisesRegex(ValueError, "Conflicting labels"):
            self.validate()
        with self.assertRaisesRegex(ValueError, "conflicting labels"):
            collect_unique_images([self.root / "train"], ["mature", "immature"])

    def test_corrupt_image_is_rejected(self):
        (self.root / "train" / "mature" / "bad.jpg").write_bytes(b"not an image")
        with self.assertRaisesRegex(ValueError, "Unreadable image"):
            self.validate()

    def test_splitter_refuses_existing_output(self):
        with self.assertRaisesRegex(ValueError, "Output already exists"):
            ensure_clean_dir(self.root)
        self.assertTrue((self.root / "train" / "mature" / "image.png").exists())


class ModelClassTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.model = self.root / "best.keras"
        self.fallback = self.root / "classes.json"

    def test_model_sidecar_wins_over_stale_global_labels(self):
        self.fallback.write_text(json.dumps(["immature", "mature"]))
        class_sidecar(self.model).write_text(json.dumps(["mature", "immature"]))
        self.assertEqual(load_model_classes(self.model, 2, "rambutan", self.fallback), ["mature", "immature"])

    def test_legacy_model_retains_old_labels(self):
        self.fallback.write_text(json.dumps(["mature", "immature"]))
        self.assertEqual(load_model_classes(self.model, 3, "rambutan", self.fallback), ["ripe", "unripe", "overripe"])

    def test_binary_model_without_matching_labels_is_rejected(self):
        self.fallback.write_text(json.dumps(["ripe", "unripe", "overripe"]))
        with self.assertRaisesRegex(ValueError, "Missing class order"):
            load_model_classes(self.model, 2, "rambutan", self.fallback)

    def test_invalid_model_sidecar_does_not_fall_back_silently(self):
        class_sidecar(self.model).write_text(json.dumps(["mature"]))
        with self.assertRaisesRegex(ValueError, "do not match"):
            load_model_classes(self.model, 2, "rambutan", self.fallback)


class SplitPreparationTests(unittest.TestCase):
    def test_invalid_ratios_are_rejected(self):
        for train, val in ((0, 0.15), (0.8, 0.3), (-0.1, 0.2), (float('nan'), 0.15), (0.7, float('inf'))):
            with self.subTest(train=train, val=val), self.assertRaisesRegex(ValueError, 'Invalid split ratios'):
                split_items(list(range(10)), train, val)

    def test_small_valid_split_keeps_every_image_once(self):
        parts = split_items([1, 2, 3], 0.7, 0.15)
        self.assertEqual([len(part) for part in parts], [1, 1, 1])
        self.assertEqual([item for part in parts for item in part], [1, 2, 3])

    def test_binary_split_rejects_conflicting_labels(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            for name in ('ripe', 'unripe'):
                (root / name).mkdir()
                Image.new('RGB', (8, 8), 'green').save(root / name / 'image.png')
            with self.assertRaisesRegex(ValueError, 'conflicting maturity labels'):
                split_rambutan_binary.collect_unique_images(root, split_rambutan_binary.CLASS_MAP)

    def test_binary_split_rejects_missing_class(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / 'unripe').mkdir()
            for index in range(3):
                Image.new('RGB', (8, 8), (index * 50, 90, 0)).save(root / 'unripe' / f'{index}.png')
            by_class = split_rambutan_binary.collect_unique_images(root, split_rambutan_binary.CLASS_MAP)
            with self.assertRaisesRegex(ValueError, 'three unique images per class'):
                validate_unique_classes(by_class)

    def test_binary_split_checks_output_before_writing(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp) / 'workspace'
            root.mkdir()
            args = SimpleNamespace(root=str(root), source='source', output='../outside', seed=42, train_ratio=0.7, val_ratio=0.15)
            with patch.object(split_rambutan_binary, 'parse_args', return_value=args), self.assertRaisesRegex(SystemExit, 'inside the project root'):
                split_rambutan_binary.main()
            self.assertFalse((Path(temp) / 'outside').exists())


class PredictionValidationTests(unittest.TestCase):
    def test_invalid_softmax_outputs_are_rejected(self):
        cases = [[[float('nan'), 0.5]], [[float('inf'), 0]], [[-0.2, 1.2]], [[0.2, 0.2]], [0.5, 0.5], []]
        for values in cases:
            with self.subTest(values=values), self.assertRaises(ValueError):
                validate_probabilities(values, 2, 1)

    def test_prediction_count_must_match_images(self):
        with self.assertRaisesRegex(ValueError, 'Prediction shape'):
            validate_probabilities([[0.8, 0.2]], 2, 2)

    def test_confusion_matrix_counts_every_image(self):
        probabilities = validate_probabilities([[0.8, 0.2], [0.6, 0.4], [0.2, 0.8]], 2, 3)
        matrix = compute_confusion_matrix([0, 1, 1], np.argmax(probabilities, axis=1), 2)
        np.testing.assert_array_equal(matrix, [[1, 0], [1, 1]])

    def test_confusion_matrix_rejects_truncated_or_invalid_labels(self):
        for actual, predicted in (([0, 1], [0]), ([0], [-1]), ([0], [2]), ([0], [0.5])):
            with self.subTest(actual=actual, predicted=predicted), self.assertRaises(ValueError):
                compute_confusion_matrix(actual, predicted, 2)


class ModelTrainingTests(unittest.TestCase):
    def test_backbone_updates_but_batch_norm_statistics_stay_frozen(self):
        import tensorflow as tf
        from training_common import build_classifier, compile_model, unfreeze_backbone

        tf.keras.utils.set_random_seed(42)
        # Small input and random initial weights keep this regression test offline.
        model = build_classifier(2, input_shape=(32, 32, 3), weights=None)
        conv = next(layer for layer in model.backbone.layers if isinstance(layer, tf.keras.layers.Conv2D))
        bn = next(layer for layer in model.backbone.layers if isinstance(layer, tf.keras.layers.BatchNormalization))
        x = np.random.default_rng(42).random((2, 32, 32, 3), dtype=np.float32)
        y = np.eye(2, dtype=np.float32)
        compile_model(model, 1e-3)
        before_conv = conv.kernel.numpy().copy()
        model.train_on_batch(x, y)
        np.testing.assert_array_equal(before_conv, conv.kernel.numpy())
        unfreeze_backbone(model)
        self.assertTrue(model.backbone.trainable)
        self.assertFalse(bn.trainable)
        compile_model(model, 1e-3)
        before_mean = bn.moving_mean.numpy().copy()
        before_variance = bn.moving_variance.numpy().copy()
        model.train_on_batch(x, y)
        self.assertTrue(np.any(before_conv != conv.kernel.numpy()))
        np.testing.assert_array_equal(before_mean, bn.moving_mean.numpy())
        np.testing.assert_array_equal(before_variance, bn.moving_variance.numpy())
        expected = model(x, training=False).numpy()
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "roundtrip.keras"
            model.save(path)
            loaded = tf.keras.models.load_model(path, compile=False)
            np.testing.assert_allclose(loaded(x, training=False).numpy(), expected, atol=1e-6)
            actual = loaded.get_layer("mobilenet_preprocessing")(np.array([0.0, 0.5, 1.0])).numpy()
            np.testing.assert_allclose(actual, [-1.0, 0.0, 1.0])
        tf.keras.backend.clear_session()


if __name__ == "__main__":
    unittest.main()
