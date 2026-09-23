"""Checks that training reports reflect real histories and evaluation labels."""

import json
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace

import numpy as np
from PIL import Image

from training_visualization import TrainingReport


class VisualizationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.report = TrainingReport(self.root / "report", "rambutan", ["mature", "immature"])

    def test_live_report_keeps_both_training_stages(self):
        from training_common import EpochVisualization

        callback = EpochVisualization(self.report)
        callback.on_epoch_end(0, {"accuracy": 0.5, "val_accuracy": 0.6, "loss": 1.0, "val_loss": 0.8})
        callback.stage = "fine_tuning"
        callback.on_epoch_end(1, {"accuracy": 0.75, "val_accuracy": 0.7, "loss": 0.6, "val_loss": 0.7})
        payload = json.loads((self.report.output_dir / "metrics.json").read_text())
        self.assertEqual([row["epoch"] for row in payload["epochs"]], [1, 2])
        self.assertEqual(payload["epochs"][1]["stage"], "fine_tuning")
        self.assertIn('http-equiv="refresh"', self.report.path.read_text())
        self.assertIsNone(payload["evaluation"])

    def test_windows_csv_history_uses_actual_epoch_values(self):
        csv_path = self.root / "history.csv"
        csv_path.write_bytes(b"epoch,accuracy,loss,val_accuracy,val_loss\r\n\r\n0,0.5,1,0.6,0.8\r\n\r\n1,0.75,0.6,0.7,0.7\r\n")
        self.report.load_csv(csv_path)
        self.assertEqual([row["epoch"] for row in self.report.rows], [1, 2])
        self.assertEqual(self.report.rows[-1]["val_accuracy"], 0.7)
        self.assertTrue((self.report.output_dir / "training_curves.png").is_file())

    def test_report_confusion_matrix_and_scores_match_known_predictions(self):
        result = self.report.finish([0, 0, 1], [[0.9, 0.1], [0.2, 0.8], [0.3, 0.7]], "test")
        self.assertEqual(result["confusion_matrix"], [[1, 1], [0, 1]])
        self.assertAlmostEqual(result["accuracy"], 2 / 3)
        self.assertEqual(result["per_class"][0]["precision"], 1.0)
        self.assertEqual(result["per_class"][0]["recall"], 0.5)
        content = self.report.path.read_text(encoding="utf-8")
        self.assertIn("data:image/png;base64,", content)
        self.assertNotIn('http-equiv="refresh"', content)
        self.assertIn("No epoch history is available", content)
        for name in ("confusion_matrix.png", "class_metrics.png"):
            with Image.open(self.report.output_dir / name) as image:
                image.verify()

    def test_missing_test_split_is_clearly_identified_as_validation(self):
        self.report.finish([0, 1], [[0.9, 0.1], [0.1, 0.9]], "val")
        self.assertIn("not an independent test result", self.report.path.read_text())

    def test_new_run_does_not_display_previous_confusion_matrix(self):
        self.report.finish([0, 1], [[0.9, 0.1], [0.1, 0.9]], "test")
        new_report = TrainingReport(self.report.output_dir, "rambutan", ["mature", "immature"])
        new_report.write()
        self.assertNotIn("data:image/png;base64,", new_report.path.read_text())
        self.assertIsNone(json.loads((new_report.output_dir / "metrics.json").read_text())["evaluation"])

    def test_training_automatically_exports_model_and_visual_report(self):
        import tensorflow as tf
        from training_common import build_generator, train_and_export

        names = ["mature", "immature"]
        for index, split in enumerate(("train", "val", "test")):
            for class_index, name in enumerate(names):
                folder = self.root / "data" / split / name
                folder.mkdir(parents=True)
                Image.new("RGB", (8, 8), (20 + index * 10, class_index * 150, 60)).save(folder / "image.png")
        generators = [build_generator(self.root / "data" / split, names, (8, 8), 2, training=split == "train") for split in ("train", "val", "test")]
        model = tf.keras.Sequential([tf.keras.layers.Input((8, 8, 3)), tf.keras.layers.Flatten(), tf.keras.layers.Dense(2, activation="softmax")])
        model_dir = self.root / "modelkeras_rambutan"
        model_dir.mkdir()
        train_and_export(model, *generators, SimpleNamespace(epochs=1, unfreeze=False), model_dir,
                         model_dir / "checkpoint.keras", model_dir / "final.keras", model_dir / "classes.json",
                         names, model_dir / "training.csv", report_dir=self.root / "automatic_report", task="rambutan")
        payload = json.loads((self.root / "automatic_report" / "metrics.json").read_text())
        self.assertEqual(payload["status"], "complete")
        self.assertEqual(payload["evaluation"]["samples"], 2)
        self.assertEqual(len(payload["epochs"]), 1)
        self.assertTrue((model_dir / "final.classes.json").exists())
        tf.keras.backend.clear_session()


if __name__ == "__main__":
    unittest.main()
