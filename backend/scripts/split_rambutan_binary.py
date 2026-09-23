"""Build a 2-class (immature/mature) rambutan split from the raw dataset.

Merges: unripe -> immature; ripe + overripe -> mature.
Reuses the dedup/split/copy helpers from split_dataset.py.
"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from split_dataset import (  # noqa: E402
    IMAGE_EXTS, sha1_file, split_items, copy_items, ensure_clean_dir,
    validate_split_ratios, validate_unique_classes,
)

CLASS_MAP = {
    "unripe": "immature",
    "ripe": "mature",
    "overripe": "mature",
}


def collect_unique_images(source_root: Path, class_map):
    seen_by_target = {target: {} for target in class_map.values()}
    labels_by_hash = {}
    for src_name, dst_name in class_map.items():
        class_dir = source_root / src_name
        if not class_dir.exists():
            continue
        seen = seen_by_target[dst_name]
        for file_path in sorted(class_dir.rglob("*")):
            if not file_path.is_file() or file_path.suffix.lower() not in IMAGE_EXTS:
                continue
            digest = sha1_file(file_path)
            if digest in labels_by_hash and labels_by_hash[digest] != dst_name:
                raise ValueError(f"Identical image has conflicting maturity labels: {file_path}")
            labels_by_hash[digest] = dst_name
            seen.setdefault(digest, file_path)
    return {name: list(files.values()) for name, files in seen_by_target.items()}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Create the immature/mature rambutan split.")
    parser.add_argument("--root", default=".", help="Project root used to resolve relative paths")
    parser.add_argument("--source", default="datasets/raw_rambutan_maturity")
    parser.add_argument("--output", default="datasets/rambutan_split")
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--train-ratio", type=float, default=0.7)
    parser.add_argument("--val-ratio", type=float, default=0.15)
    return parser.parse_args()


def main() -> None:
    import random

    args = parse_args()
    root = Path(args.root).resolve()
    source_root = (root / args.source).resolve()
    output_root = (root / args.output).resolve()
    if not output_root.is_relative_to(root) or output_root == root:
        raise SystemExit("Output must be a new folder inside the project root.")
    if output_root.exists():
        raise SystemExit(f"Output already exists: {output_root}. Choose a new --output folder.")
    try:
        validate_split_ratios(args.train_ratio, args.val_ratio)
    except ValueError as exc:
        raise SystemExit(str(exc))

    if not source_root.exists():
        raise SystemExit(f"Source dataset not found: {source_root}")

    rng = random.Random(args.seed)
    try:
        by_class = collect_unique_images(source_root, CLASS_MAP)
        validate_unique_classes(by_class)
    except ValueError as exc:
        raise SystemExit(str(exc))

    ensure_clean_dir(output_root)

    print(f"Source root: {source_root}")
    print("Unique image counts (merged into immature/mature):")
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
