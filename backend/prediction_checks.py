"""Validate softmax outputs before displaying or evaluating predictions."""

import numpy as np


def validate_probabilities(predictions, num_classes, expected_samples=None):
    probabilities = np.asarray(predictions, dtype=np.float64)
    if (probabilities.ndim != 2 or probabilities.shape[0] == 0
            or probabilities.shape[1] != num_classes
            or (expected_samples is not None and probabilities.shape[0] != expected_samples)):
        raise ValueError("Prediction shape does not match the images and class names.")
    if not np.isfinite(probabilities).all():
        raise ValueError("Model returned non-finite probabilities.")
    if (np.any(probabilities < -1e-6) or np.any(probabilities > 1.0 + 1e-6)
            or not np.allclose(probabilities.sum(axis=1), 1.0, atol=1e-5)):
        raise ValueError("Model output is not a valid softmax probability distribution.")
    return probabilities
