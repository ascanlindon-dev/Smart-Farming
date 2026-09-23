"""Keep prediction class order tied to the model that was actually loaded."""

import json
from pathlib import Path


LEGACY_CLASSES = {
    "leaf": {5: ["Algal Leaf Spot", "Anthracnose", "Leaf Curl", "Powdery Mildew", "sooty mold"]},
    "rambutan": {
        3: ["ripe", "unripe", "overripe"],
        4: ["not_rambutan", "ripe", "unripe", "overripe"],
    },
}


def class_sidecar(model_path):
    return Path(model_path).with_suffix(".classes.json")


def read_class_names(path, num_classes=None):
    names = json.loads(Path(path).read_text(encoding="utf-8"))
    if (not isinstance(names, list) or not names
            or any(not isinstance(name, str) or not name.strip() for name in names)
            or len(set(names)) != len(names)
            or (num_classes is not None and len(names) != num_classes)):
        raise ValueError(f"Class names do not match the model: {path}")
    return names


def load_model_classes(model_path, num_classes, task, fallback_path=None):
    sidecar = class_sidecar(model_path)
    if sidecar.exists():
        return read_class_names(sidecar, num_classes)
    if fallback_path and Path(fallback_path).exists():
        try:
            return read_class_names(fallback_path, num_classes)
        except ValueError:
            pass
    legacy = LEGACY_CLASSES[task].get(num_classes)
    if legacy:
        return list(legacy)
    # In particular, do not guess whether binary index 0 is mature or immature.
    raise ValueError(f"Missing class order for {model_path}. Train with the updated script or provide {sidecar.name}.")
