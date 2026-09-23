"""Local object verification before the two-class maturity classifier runs.

OpenCLIP compares the photo against rambutan and competing object descriptions.
These similarity thresholds are screening rules, not calibrated probabilities
or a guarantee that every possible non-rambutan object will be rejected.
"""
from image_verifier import compare_descriptions, VerifierUnavailable, WEIGHTS, MODEL_NAME

import numpy as np

MIN_SIMILARITY = 0.25
MIN_MARGIN = 0.02
RAMBUTAN_DESCRIPTIONS = (
    'rambutan fruit',
    'ripe red rambutan fruits with hairy skin',
    'unripe green rambutan fruits growing on a tree',
    'a bunch of yellow rambutan fruits with hairy skin',
)
OTHER_DESCRIPTIONS = (
    'lychee fruit', 'longan fruit', 'pulasan fruit', 'durian fruit', 'jackfruit',
    'red apples', 'green apples', 'oranges', 'mangoes', 'bananas', 'guavas',
    'strawberries', 'grapes', 'pineapple', 'dragon fruit', 'mangosteen',
    'tomatoes', 'chili peppers', 'coconuts', 'avocado', 'watermelon',
    'plant leaves', 'a diseased leaf', 'flowers', 'grass', 'tree bark',
    'a person', 'a human face', 'a hand', 'a dog', 'a cat',
    'a phone', 'a computer keyboard', 'a computer screen', 'a chair',
    'a plastic bottle', 'a cup', 'food on a plate', 'a toy', 'a ball',
    'a car', 'a house', 'a landscape', 'soil', 'rocks', 'a plain wall',
    'a blank image', 'a document with text', 'a logo',
)


def assess_similarities(similarities):
    values = np.asarray(similarities, dtype=np.float64)
    if values.shape != (len(RAMBUTAN_DESCRIPTIONS) + len(OTHER_DESCRIPTIONS),) or not np.all(np.isfinite(values)):
        raise VerifierUnavailable('Invalid verifier output')
    positive = float(values[:len(RAMBUTAN_DESCRIPTIONS)].max())
    negative = float(values[len(RAMBUTAN_DESCRIPTIONS):].max())
    margin = positive - negative
    return {'verified': positive >= MIN_SIMILARITY and margin >= MIN_MARGIN,
            'similarity': positive, 'margin': margin}


def verify_rambutan(image):
    return assess_similarities(compare_descriptions(image, RAMBUTAN_DESCRIPTIONS + OTHER_DESCRIPTIONS))
