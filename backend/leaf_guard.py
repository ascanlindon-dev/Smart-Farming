"""Verify a leaf before disease classification; leaf color alone is insufficient."""
import numpy as np

from image_verifier import compare_descriptions, VerifierUnavailable
from rambutan_guard import RAMBUTAN_DESCRIPTIONS, OTHER_DESCRIPTIONS as FRUIT_ALTERNATIVES

MIN_SIMILARITY = 0.25
MIN_MARGIN = 0.02
LEAF_DESCRIPTIONS = (
    'a leaf',
    'plant leaves',
    'green leaves on a tree branch',
    'a close-up of rambutan leaves',
    'a close-up of a healthy green plant leaf',
    'a close-up of a diseased plant leaf with spots',
    'a close-up of a dry brown plant leaf',
    'a close-up of a yellow plant leaf',
    'a close-up of a dark plant leaf covered in sooty mold',
    'plant leaves with spots and holes',
    'a plant leaf held in a hand',
)
OTHER_DESCRIPTIONS = RAMBUTAN_DESCRIPTIONS + tuple(
    description for description in FRUIT_ALTERNATIVES
    if description not in {'plant leaves', 'a diseased leaf'}
) + (
    'a whole tree in a garden', 'a green plastic bottle', 'green fabric',
    'a green toy', 'a flower petal', 'a paper cutout shaped like a leaf',
)


def assess_similarities(similarities):
    values = np.asarray(similarities, dtype=np.float64)
    expected = len(LEAF_DESCRIPTIONS) + len(OTHER_DESCRIPTIONS)
    if values.shape != (expected,) or not np.all(np.isfinite(values)):
        raise VerifierUnavailable('Invalid leaf verifier output')
    positive = float(values[:len(LEAF_DESCRIPTIONS)].max())
    negative = float(values[len(LEAF_DESCRIPTIONS):].max())
    margin = positive - negative
    return {'verified': positive >= MIN_SIMILARITY and margin >= MIN_MARGIN,
            'similarity': positive, 'margin': margin}


def verify_leaf(image):
    return assess_similarities(compare_descriptions(image, LEAF_DESCRIPTIONS + OTHER_DESCRIPTIONS))
