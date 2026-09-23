import argparse
import hashlib
import math
import random
import shutil
from pathlib import Path


IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".ppm", ".tif", ".tiff"}


def sha1_file(path: Path) -> str:
    h = hashlib.sha1()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def collect_unique_images(source_roots, classes):
    by_class = {}
    labels_by_hash = {}
    for class_name in classes:
        seen = {}
        for root in source_roots:
            class_dir = root / class_name
            if not class_dir.exists():
                continue
            for file_path in sorted(class_dir.rglob("*")):
                if not file_path.is_file() or file_path.suffix.lower() not in IMAGE_EXTS:
                    continue
                digest = sha1_file(file_path)
                if digest in labels_by_hash and labels_by_hash[digest] != class_name:
                    raise ValueError(f"Identical image has conflicting labels: {file_path} and class {labels_by_hash[digest]}")
                labels_by_hash[digest] = class_name
                seen.setdefault(digest, file_path)
        by_class[class_name] = list(seen.values())
    return by_class


def discover_classes(source_roots):
    class_names = set()
    for root in source_roots:
        if not root.exists():
            continue
        for item in root.iterdir():
            if item.is_dir():
                class_names.add(item.name)
    return sorted(class_names)


def ensure_clean_dir(path: Path):
    # Never delete an uploaded dataset or an earlier prepared split.
    if path.exists():
        raise ValueError(f"Output already exists: {path}. Choose a new --output folder.")
    path.mkdir(parents=True)


def validate_split_ratios(train_ratio, val_ratio):
    if (not math.isfinite(train_ratio) or not math.isfinite(val_ratio)
            or train_ratio <= 0 or val_ratio <= 0 or train_ratio + val_ratio >= 1):
        raise ValueError("Invalid split ratios. Use positive finite ratios with train_ratio + val_ratio < 1.")


def validate_unique_classes(by_class):
    if len(by_class) < 2 or any(len(items) < 3 for items in by_class.values()):
        raise ValueError("Need at least two classes and three unique images per class for train/val/test.")


def split_items(items, train_ratio, val_ratio):
    validate_split_ratios(train_ratio, val_ratio)
    total = len(items)
    train_count = int(total * train_ratio)
    val_count = int(total * val_ratio)
    test_count = total - train_count - val_count

    if total >= 3:
        if train_count == 0:
            train_count = 1
        if val_count == 0:
            val_count = 1
        test_count = total - train_count - val_count
        if test_count == 0:
            test_count = 1
            if train_count > val_count and train_count > 1:
                train_count -= 1
            elif val_count > 1:
                val_count -= 1

    return (
        items[:train_count],
        items[train_count:train_count + val_count],
        items[train_count + val_count:],
    )


def unique_target_path(dest_dir: Path, source_path: Path) -> Path:
    target = dest_dir / source_path.name
    if not target.exists():
        return target

    stem = source_path.stem
    suffix = source_path.suffix
    index = 1
    while True:
        candidate = dest_dir / f"{stem}_{index}{suffix}"
        if not candidate.exists():
            return candidate
        index += 1


def copy_items(items, split_name, class_name, output_root: Path):
    dest_dir = output_root / split_name / class_name
    dest_dir.mkdir(parents=True, exist_ok=True)
    for src in items:
        if src.suffix.lower() == ".webp":
            from PIL import Image

            dst = unique_target_path(dest_dir, src.with_suffix(".png"))
            with Image.open(src) as image:
                image.convert("RGB").save(dst)
        else:
            dst = unique_target_path(dest_dir, src)
            shutil.copy2(src, dst)


def main():
    parser = argparse.ArgumentParser(description="Create a clean deduplicated train/val/test split.")
    parser.add_argument("--root", default=".", help="Project root used to resolve relative paths")
    parser.add_argument("--source", default=None, help="Dataset containing class folders, or existing train/val/test splits")
    parser.add_argument("--output", default="datasets/leaf_split", help="Output dataset root")
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--train-ratio", type=float, default=0.7)
    parser.add_argument("--val-ratio", type=float, default=0.15)
    parser.add_argument("--include", nargs="+", default=None, help="Optional explicit class list")
    args = parser.parse_args()

    root = Path(args.root).resolve()
    output_root = (root / args.output).resolve()
    if not output_root.is_relative_to(root) or output_root == root:
        raise SystemExit("Output must be a new folder inside the project root.")
    if output_root.exists():
        raise SystemExit(f"Output already exists: {output_root}. Choose a new --output folder.")
    if args.source:
        source_root = (root / args.source).resolve()
        source_roots = ([source_root / split for split in ("train", "val", "test")]
                        if (source_root / "train").is_dir() else [source_root])
    else:
        source_roots = [root / "train", root / "val", root / "test"]

    try:
        validate_split_ratios(args.train_ratio, args.val_ratio)
    except ValueError as exc:
        raise SystemExit(str(exc))

    if not any(path.exists() for path in source_roots):
        raise SystemExit(f"No source dataset folders found in: {source_roots}")

    rng = random.Random(args.seed)
    class_names = args.include or discover_classes(source_roots)
    if not class_names:
        raise SystemExit("No class folders found in the source dataset.")

    try:
        by_class = collect_unique_images(source_roots, class_names)
        validate_unique_classes(by_class)
    except ValueError as exc:
        raise SystemExit(str(exc))

    ensure_clean_dir(output_root)

    print("Source roots:")
    for source_root in source_roots:
        print(f"  - {source_root}")
    print("Unique image counts:")
    for class_name, items in by_class.items():
        rng.shuffle(items)
        train_items, val_items, test_items = split_items(items, args.train_ratio, args.val_ratio)
        copy_items(train_items, "train", class_name, output_root)
        copy_items(val_items, "val", class_name, output_root)
        copy_items(test_items, "test", class_name, output_root)
        print(
            f"{class_name}: total={len(items)} train={len(train_items)} "
            f"val={len(val_items)} test={len(test_items)}"
        )

    print(f"Clean split written to: {output_root}")


if __name__ == "__main__":
    main()
