"""Evaluate leaf verification on labeled photos without changing database records."""
import argparse
import json
from pathlib import Path

from PIL import Image
from check_rambutan_guard import image_paths
from leaf_guard import verify_leaf, MIN_SIMILARITY, MIN_MARGIN

ROOT = Path(__file__).resolve().parents[1]


def main(args):
    samples = [(p, True) for p in image_paths(ROOT / args.positive_root)]
    for directory in args.negative_root:
        samples.extend((p, False) for p in image_paths(ROOT / directory))
    results = []
    counts = {'leaf_accepted': 0, 'leaf_rejected': 0, 'other_accepted': 0, 'other_rejected': 0}
    for index, (path, expected) in enumerate(samples, 1):
        with Image.open(path) as image:
            result = verify_leaf(image)
        prefix = 'leaf' if expected else 'other'
        counts[f'{prefix}_{"accepted" if result["verified"] else "rejected"}'] += 1
        results.append({'path': str(path.relative_to(ROOT)) if path.is_relative_to(ROOT) else str(path),
                        'expected_leaf': expected, **result})
        if index % 25 == 0:
            print(f'Checked {index}/{len(samples)} photos', flush=True)
    report = {'min_similarity': MIN_SIMILARITY, 'min_margin': MIN_MARGIN,
              'counts': counts, 'results': results,
              'scope': 'Folder labels are used as supplied, including whole-tree photos. Results apply only to these samples.'}
    output = ROOT / args.output
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(counts), flush=True)
    print(f'Report: {output}', flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--positive-root', default='datasets/leaf_split/test')
    parser.add_argument('--negative-root', action='append', required=True)
    parser.add_argument('--output', default='backend/evaluation/leaf_guard/report.json')
    main(parser.parse_args())
