"""Evaluate the object check on real positive and negative photos, without DB writes."""
import argparse
import json
from pathlib import Path

from PIL import Image
from rambutan_guard import verify_rambutan, MIN_MARGIN, MIN_SIMILARITY, MODEL_NAME

ROOT = Path(__file__).resolve().parents[1]
EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp', '.bmp'}


def image_paths(directory):
    paths = sorted(p for p in directory.rglob('*') if p.suffix.lower() in EXTENSIONS)
    if not paths:
        raise ValueError(f'No photos found in {directory}')
    return paths


def main(args):
    samples = [(p, True) for p in image_paths(ROOT / args.positive_root)]
    for directory in args.negative_root:
        samples.extend((p, False) for p in image_paths(ROOT / directory))
    results = []
    counts = {'rambutan_accepted': 0, 'rambutan_rejected': 0, 'other_accepted': 0, 'other_rejected': 0}
    for index, (path, expected) in enumerate(samples, 1):
        with Image.open(path) as image:
            result = verify_rambutan(image)
        prefix = 'rambutan' if expected else 'other'
        counts[f'{prefix}_{"accepted" if result["verified"] else "rejected"}'] += 1
        results.append({'path': str(path.relative_to(ROOT)) if path.is_relative_to(ROOT) else str(path),
                        'is_rambutan': expected, **result})
        if index % 25 == 0:
            print(f'Checked {index}/{len(samples)} photos', flush=True)
    report = {'model': MODEL_NAME, 'min_similarity': MIN_SIMILARITY, 'min_margin': MIN_MARGIN,
              'counts': counts, 'results': results,
              'scope': 'This measures only the supplied photos. It is not a guarantee for unseen objects.'}
    output = ROOT / args.output
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(counts), flush=True)
    print(f'Report: {output}', flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--positive-root', default='datasets/rambutan_clean_split/test')
    parser.add_argument('--negative-root', action='append', required=True,
                        help='Folder of photos without rambutan; can be supplied multiple times')
    parser.add_argument('--output', default='backend/evaluation/rambutan_guard/report.json')
    main(parser.parse_args())
