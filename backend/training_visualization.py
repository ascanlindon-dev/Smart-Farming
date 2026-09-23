"""Offline training graphs and a browser-readable report from real metrics."""

import base64
import csv
import html
import json
from datetime import datetime
from pathlib import Path

import numpy as np

from prediction_checks import validate_probabilities


def plotting():
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    return plt


def save_training_curves(rows, path, title):
    plt = plotting()
    fig, axes = plt.subplots(1, 2, figsize=(12, 4.5), constrained_layout=True)
    epochs = [row["epoch"] for row in rows]
    for ax, metric, label in zip(axes, ("accuracy", "loss"), ("Accuracy", "Loss")):
        for key, legend, color in ((metric, "Training", "#16835b"), (f"val_{metric}", "Validation", "#426acb")):
            ax.plot(epochs, [row.get(key, np.nan) for row in rows], label=legend, color=color, marker="o", markersize=3)
        ax.set(xlabel="Epoch", ylabel=label, title=label)
        ax.grid(alpha=0.2)
        ax.xaxis.get_major_locator().set_params(integer=True)
        if metric == "accuracy":
            ax.set_ylim(0, 1.05)
        fine_epochs = [row["epoch"] for row in rows if row.get("stage") == "fine_tuning"]
        if fine_epochs:
            ax.axvline(fine_epochs[0] - 0.5, color="#999999", linestyle="--", label="Fine-tuning starts")
        ax.legend(fontsize=8)
    fig.suptitle(title)
    fig.savefig(path, dpi=160)
    plt.close(fig)


def save_confusion_panels(matrix, names, path, title):
    plt = plotting()
    totals = matrix.sum(axis=1, keepdims=True)
    normalized = np.divide(matrix, totals, out=np.zeros_like(matrix, dtype=float), where=totals != 0)
    size = max(5, len(names) * 1.3)
    fig, axes = plt.subplots(1, 2, figsize=(size * 2.2, size), constrained_layout=True)
    for ax, values, subtitle in zip(axes, (matrix, normalized), ("Image counts", "Percent of each actual class")):
        percent = subtitle.startswith("Percent")
        image = ax.imshow(values, cmap="Blues", vmin=0, vmax=1 if percent else max(1, matrix.max()))
        fig.colorbar(image, ax=ax, shrink=0.8)
        ax.set(xticks=range(len(names)), yticks=range(len(names)), xticklabels=names,
               yticklabels=names, xlabel="Predicted class", ylabel="Actual class", title=subtitle)
        plt.setp(ax.get_xticklabels(), rotation=35, ha="right", rotation_mode="anchor")
        threshold = 0.5 if percent else matrix.max() / 2
        for row in range(len(names)):
            for col in range(len(names)):
                value = values[row, col]
                label = f"{value:.1%}" if percent else str(int(value))
                ax.text(col, row, label, ha="center", va="center", color="white" if value > threshold else "#172b3a")
    fig.suptitle(title)
    fig.savefig(path, dpi=160)
    plt.close(fig)


def save_class_metrics(metrics, names, path, title):
    plt = plotting()
    fig, ax = plt.subplots(figsize=(max(8, len(names) * 1.8), 4.8), constrained_layout=True)
    positions = np.arange(len(names))
    for offset, key, color in ((-0.25, "precision", "#16835b"), (0, "recall", "#426acb"), (0.25, "f1", "#bb7930")):
        ax.bar(positions + offset, [row[key] for row in metrics], width=0.24, label=key.upper() if key == "f1" else key.title(), color=color)
    ax.set(xticks=positions, xticklabels=names, ylabel="Score", ylim=(0, 1.1), title=title)
    plt.setp(ax.get_xticklabels(), rotation=20, ha="right")
    ax.grid(axis="y", alpha=0.2)
    ax.legend(loc="upper right", ncols=3)
    fig.savefig(path, dpi=160)
    plt.close(fig)


class TrainingReport:
    def __init__(self, output_dir, task, class_names, dataset_root=None, model_path=None):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.task = task
        self.class_names = list(class_names)
        self.dataset_root = str(dataset_root) if dataset_root else None
        self.model_path = str(model_path) if model_path else None
        self.rows = []
        self.evaluation = None
        self.status = "training"
        self.started_at = datetime.now().astimezone().isoformat(timespec="seconds")
        self.path = self.output_dir / "report.html"

    def record_epoch(self, epoch, logs, stage="training"):
        row = {"epoch": int(epoch) + 1, "stage": stage}
        for key in ("accuracy", "val_accuracy", "loss", "val_loss", "learning_rate"):
            if key in logs:
                value = float(logs[key])
                row[key] = value if np.isfinite(value) else None
        self.rows.append(row)
        save_training_curves(self.rows, self.output_dir / "training_curves.png", f"{self.task.title()} training history")
        self.write()

    def load_csv(self, path):
        with Path(path).open(newline="", encoding="utf-8-sig") as handle:
            for row in csv.DictReader(handle):
                if not row.get("epoch"):
                    continue
                values = {key: float(row[key]) for key in ("accuracy", "val_accuracy", "loss", "val_loss", "learning_rate") if row.get(key)}
                self.rows.append({"epoch": int(row["epoch"]) + 1, "stage": row.get("stage", "training"),
                                  **{key: value if np.isfinite(value) else None for key, value in values.items()}})
        if self.rows:
            save_training_curves(self.rows, self.output_dir / "training_curves.png", f"{self.task.title()} training history")

    def finish(self, y_true, predictions, split, loss=None):
        # Import locally so the standalone confusion-matrix command can reuse
        # this report without an import cycle.
        from confusion_matrix import compute_confusion_matrix, save_matrix_csv, maybe_save_classification_report

        y_true = np.asarray(y_true)
        probabilities = validate_probabilities(predictions, len(self.class_names), len(y_true))
        y_pred = probabilities.argmax(axis=1)
        matrix = compute_confusion_matrix(y_true, y_pred, len(self.class_names))
        per_class = []
        for index, name in enumerate(self.class_names):
            true_positive = int(matrix[index, index])
            support = int(matrix[index].sum())
            predicted_count = int(matrix[:, index].sum())
            precision = true_positive / predicted_count if predicted_count else 0.0
            recall = true_positive / support if support else 0.0
            f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
            per_class.append(dict(name=name, precision=precision, recall=recall, f1=f1, support=support))
        self.evaluation = dict(split=split, samples=len(y_true), accuracy=float(np.mean(y_true == y_pred)),
                               macro_f1=float(np.mean([row["f1"] for row in per_class])),
                               loss=float(loss) if loss is not None else None,
                               confusion_matrix=matrix.tolist(), per_class=per_class)
        save_matrix_csv(matrix, self.class_names, self.output_dir / "confusion_matrix.csv")
        save_confusion_panels(matrix, self.class_names, self.output_dir / "confusion_matrix.png", f"{self.task.title()} — {split} split")
        save_class_metrics(per_class, self.class_names, self.output_dir / "class_metrics.png", f"{self.task.title()} — {split} class scores")
        maybe_save_classification_report(y_true, y_pred, self.class_names, self.output_dir / "classification_report.txt")
        self.status = "complete"
        self.write()
        return self.evaluation

    def write(self):
        updated = datetime.now().astimezone().isoformat(timespec="seconds")
        payload = dict(task=self.task, status=self.status, started_at=self.started_at, updated_at=updated,
                       class_names=self.class_names, dataset_root=self.dataset_root,
                       model_path=self.model_path, epochs=self.rows, evaluation=self.evaluation)
        (self.output_dir / "metrics.json").write_text(json.dumps(payload, indent=2, allow_nan=False), encoding="utf-8")
        title = f"{self.task.title()} model report"
        escape = html.escape
        cards = [("Epochs completed", str(len(self.rows))), ("Classes", str(len(self.class_names)))]
        if self.evaluation:
            cards.extend([(f"{self.evaluation['split'].title()} accuracy", f"{self.evaluation['accuracy']:.1%}"),
                          ("Macro F1", f"{self.evaluation['macro_f1']:.3f}")])
        elif self.rows and self.rows[-1].get("val_accuracy") is not None:
            cards.append(("Latest validation accuracy", f"{self.rows[-1]['val_accuracy']:.1%}"))
        card_html = "".join(f'<div class="card"><span>{escape(label)}</span><strong>{escape(value)}</strong></div>' for label, value in cards)
        sections = []

        def chart(filename, heading, description):
            data = base64.b64encode((self.output_dir / filename).read_bytes()).decode("ascii")
            return f'<section><h2>{escape(heading)}</h2><p>{escape(description)}</p><img alt="{escape(heading)}" src="data:image/png;base64,{data}"></section>'

        if self.rows:
            sections.append(chart("training_curves.png", "Accuracy and loss", "Compare training and validation across epochs. Lower loss means less prediction error. These curves describe the training run; the evaluation below uses its best saved checkpoint."))
        else:
            sections.append('<section><h2>Training history</h2><p>No epoch history is available yet. A saved model alone cannot reconstruct past training curves.</p></section>')
        if self.evaluation:
            split = self.evaluation["split"]
            note = f"Evaluated on {self.evaluation['samples']} {split} images. Rows are actual classes; columns are predictions. Diagonal cells are correct predictions."
            if split == "val":
                note += " This is validation performance, not an independent test result."
            sections.append(chart("confusion_matrix.png", "Confusion matrix", note))
            sections.append(chart("class_metrics.png", "Precision, recall and F1", "Precision: how often a predicted class is correct. Recall: how many actual examples are found. F1 combines precision and recall."))
            table_rows = "".join(f'<tr><td>{escape(row["name"])}</td><td>{row["precision"]:.3f}</td><td>{row["recall"]:.3f}</td><td>{row["f1"]:.3f}</td><td>{row["support"]}</td></tr>' for row in self.evaluation["per_class"])
            sections.append('<section><h2>Class results</h2><div class="table"><table><thead><tr><th>Class</th><th>Precision</th><th>Recall</th><th>F1</th><th>Images</th></tr></thead><tbody>' + table_rows + '</tbody></table></div></section>')
        else:
            sections.append('<section><h2>Confusion matrix</h2><p>Available after training finishes and the best checkpoint is evaluated.</p></section>')
        refresh = '<meta http-equiv="refresh" content="10">' if self.status in ("training", "evaluating") else ""
        content = f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">{refresh}<title>{escape(title)}</title>
<style>body{{margin:0;background:#eff4f1;color:#17362c;font:16px/1.6 system-ui,sans-serif}}main{{max-width:1180px;margin:auto;padding:32px 20px}}h1{{font-size:32px;line-height:1.2}}h2{{font-size:22px}}p,span{{color:#52665f}}.cards{{display:flex;gap:16px;flex-wrap:wrap}}.card,section{{background:white;border:1px solid #dce6df;border-radius:14px;padding:22px;margin:16px 0}}.card{{flex:1;min-width:170px}}strong{{display:block;font-size:30px;color:#167653}}img{{display:block;width:100%;height:auto}}.table{{overflow:auto}}table{{border-collapse:collapse;width:100%;text-align:left}}th,td{{padding:10px;border-bottom:1px solid #e2e9e5}}.source{{overflow-wrap:anywhere;font-size:13px}}.badge{{color:#167653;font-weight:700}}</style></head>
<body><main><p class="badge">SMART FARMING · {escape(self.status.upper())}</p><h1>{escape(title)}</h1><p>Updated {escape(updated)}. Classes: {escape(', '.join(self.class_names))}.</p><div class="cards">{card_html}</div>{''.join(sections)}<p class="source">Dataset: {escape(self.dataset_root or 'Not recorded')}<br>Model: {escape(self.model_path or 'Not recorded')}</p></main></body></html>'''
        temporary = self.path.with_suffix(".html.tmp")
        temporary.write_text(content, encoding="utf-8")
        temporary.replace(self.path)
