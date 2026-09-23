"""Validate classification folders before any training artifacts are written."""

import hashlib
from pathlib import Path

from PIL import Image


# The formats accepted by Keras' DirectoryIterator (WebP is not included).
IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".ppm", ".tif", ".tiff"}


def image_paths(directory):
    return sorted(p for p in Path(directory).rglob("*") if p.is_file() and p.suffix.lower() in IMAGE_EXTS)


def image_digest(path):
    with Path(path).open("rb") as handle:
        return hashlib.file_digest(handle, "sha256").hexdigest()


def validate_dataset(root, class_names=None):
    """Require matching, nonempty classes, readable images and disjoint splits.

    Returns the class order and per-split image counts. An existing test/ folder
    is validated too; omit it entirely when no test set has been prepared.
    """
    root = Path(root)
    if not (root / "train").is_dir() or not (root / "val").is_dir():
        raise ValueError(f"Expected train/ and val/ class folders under {root}")
    if class_names is None:
        class_names = sorted(p.name for p in (root / "train").iterdir() if p.is_dir() and not p.name.startswith("."))
    class_names = list(class_names)
    if len(class_names) < 2 or len(set(class_names)) != len(class_names):
        raise ValueError("At least two distinct classes are required.")

    counts, seen, errors = {}, {}, []
    for split in ("train", "val", "test"):
        split_dir = root / split
        if split == "test" and not split_dir.exists():
            continue
        actual = {p.name for p in split_dir.iterdir() if p.is_dir() and not p.name.startswith(".")}
        if actual != set(class_names):
            errors.append(f"{split}: missing classes {sorted(set(class_names) - actual)}; unexpected classes {sorted(actual - set(class_names))}")
        counts[split] = {}
        for loose_file in split_dir.iterdir():
            if loose_file.is_file() and loose_file.suffix.lower() in IMAGE_EXTS | {".webp"}:
                errors.append(f"Image needs a class folder: {loose_file.relative_to(root)}")
        for class_name in class_names:
            class_dir = split_dir / class_name
            files = image_paths(class_dir)
            counts[split][class_name] = len(files)
            if not files:
                errors.append(f"{split}/{class_name}: no supported images")
            for path in class_dir.rglob("*"):
                if path.is_file() and path.suffix.lower() == ".webp":
                    errors.append(f"Convert WebP to PNG or JPEG before training: {path.relative_to(root)}")
            for path in files:
                try:
                    digest = image_digest(path)
                    if digest in seen:
                        old_split, old_class, old_path = seen[digest]
                        if old_class != class_name:
                            errors.append(f"Conflicting labels: {old_path} and {path.relative_to(root)}")
                        elif old_split != split:
                            errors.append(f"Image repeated across splits: {old_path} and {path.relative_to(root)}")
                    else:
                        with Image.open(path) as image:
                            image.convert("RGB").load()
                        seen[digest] = (split, class_name, path.relative_to(root))
                except (OSError, ValueError, Image.DecompressionBombError) as exc:
                    errors.append(f"Unreadable image {path.relative_to(root)}: {exc}")
    for split, class_counts in counts.items():
        print(f"{split}: " + ", ".join(f"{name}={count}" for name, count in class_counts.items()), flush=True)
    if errors:
        detail = "\n".join(f"- {error}" for error in errors[:12])
        if len(errors) > 12:
            detail += f"\n- ... {len(errors) - 12} more issues"
        raise ValueError(f"Dataset is not ready:\n{detail}")
    return class_names, counts
