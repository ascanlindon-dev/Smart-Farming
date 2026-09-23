"""Validate device readings and exclude stale measurements from live advice."""
import math
from django.utils import timezone


def current_reading(reading):
    if reading is None:
        return None
    age = (timezone.now() - reading.received_at).total_seconds()
    return reading if -60 <= age <= 120 else None


def validate_telemetry(payload):
    if not isinstance(payload, dict):
        raise ValueError('Expected a JSON object.')
    device_id = payload.get('device_id', 'esp01')
    if not isinstance(device_id, str) or not device_id.strip() or len(device_id) > 64:
        raise ValueError('device_id must be a nonempty string of at most 64 characters.')
    result = {'device_id': device_id.strip()}
    fields = {
        'temperature': (-80, 100, False),
        'humidity': (0, 100, False),
        'soil_raw': (0, 65535, True),
        'moisture_pct': (0, 100, True),
        # Preserve device rain values without claiming they are calibrated mm.
        'rain': (0, 65535, True),
    }
    for field, (minimum, maximum, integer) in fields.items():
        value = payload.get(field)
        if value is None:
            continue
        if isinstance(value, bool) and field != 'rain':
            raise ValueError(f'{field} must be numeric.')
        if not isinstance(value, (int, float, str)):
            raise ValueError(f'{field} must be numeric.')
        try:
            number = float(value)
        except (ValueError, TypeError):
            raise ValueError(f'{field} must be numeric.') from None
        if not math.isfinite(number) or not minimum <= number <= maximum or (integer and not number.is_integer()):
            raise ValueError(f'{field} is outside the supported range.')
        result[field] = int(number) if integer else number
    if len(result) == 1:
        raise ValueError('At least one sensor measurement is required.')
    return result
