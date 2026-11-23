"""Open-Meteo helpers for extended daily forecasts."""
from datetime import datetime, timedelta
import math
import os
from zoneinfo import ZoneInfo

import requests
from django.utils import timezone


class ForecastUnavailable(RuntimeError):
    pass


# WMO weather interpretation codes used by Open-Meteo.
CONDITIONS = {
    0: ('Clear Sky', '\u2600\ufe0f'),
    1: ('Mainly Clear', '\U0001f324\ufe0f'),
    2: ('Partly Cloudy', '\u26c5'),
    3: ('Overcast', '\u2601\ufe0f'),
    45: ('Fog', '\U0001f32b\ufe0f'),
    48: ('Fog', '\U0001f32b\ufe0f'),
    51: ('Drizzle', '\U0001f326\ufe0f'),
    53: ('Drizzle', '\U0001f326\ufe0f'),
    55: ('Drizzle', '\U0001f327\ufe0f'),
    56: ('Freezing Drizzle', '\U0001f327\ufe0f'),
    57: ('Freezing Drizzle', '\U0001f327\ufe0f'),
    61: ('Rain', '\U0001f327\ufe0f'),
    63: ('Rain', '\U0001f327\ufe0f'),
    65: ('Rain', '\U0001f327\ufe0f'),
    66: ('Freezing Rain', '\U0001f327\ufe0f'),
    67: ('Freezing Rain', '\U0001f327\ufe0f'),
    71: ('Snow', '\U0001f328\ufe0f'),
    73: ('Snow', '\U0001f328\ufe0f'),
    75: ('Snow', '\U0001f328\ufe0f'),
    77: ('Snow', '\U0001f328\ufe0f'),
    80: ('Rain Showers', '\U0001f326\ufe0f'),
    81: ('Rain Showers', '\U0001f327\ufe0f'),
    82: ('Rain Showers', '\U0001f327\ufe0f'),
    85: ('Snow Showers', '\U0001f328\ufe0f'),
    86: ('Snow Showers', '\U0001f328\ufe0f'),
    95: ('Thunderstorm', '\u26c8\ufe0f'),
    96: ('Thunderstorm', '\u26c8\ufe0f'),
    99: ('Thunderstorm', '\u26c8\ufe0f'),
}
DAILY_FIELDS = (
    'weather_code', 'temperature_2m_max', 'temperature_2m_min',
    'rain_sum', 'precipitation_sum', 'precipitation_probability_max',
    'precipitation_hours', 'wind_speed_10m_max', 'uv_index_max',
    'relative_humidity_2m_mean',
)


def condition_for_code(weather_code):
    if isinstance(weather_code, bool):
        return 'Unknown'
    try:
        code = int(weather_code)
    except (TypeError, ValueError):
        return 'Unknown'
    if isinstance(weather_code, float) and not weather_code.is_integer():
        return 'Unknown'
    return CONDITIONS.get(code, ('Unknown', '\u2601\ufe0f'))[0]


def fetch_extended_forecast(location, days):
    latitude, longitude = float(location['lat']), float(location['lon'])
    if not (-90 <= latitude <= 90 and -180 <= longitude <= 180):
        raise ForecastUnavailable('Invalid forecast coordinates')
    zone_name = location.get('timezone') or 'UTC'
    zone = ZoneInfo(zone_name)
    params = {
        'latitude': latitude, 'longitude': longitude, 'timezone': zone_name,
        'forecast_days': days, 'daily': ','.join(DAILY_FIELDS),
        'temperature_unit': 'celsius', 'wind_speed_unit': 'kmh',
        'precipitation_unit': 'mm',
    }
    key = os.getenv('OPEN_METEO_API_KEY', '').strip()
    host = 'customer-api.open-meteo.com' if key else 'api.open-meteo.com'
    if key:
        params['apikey'] = key
    response = requests.get(f'https://{host}/v1/forecast', params=params, timeout=12)
    if not response.ok:
        raise ForecastUnavailable('Extended weather provider is unavailable')
    daily = response.json().get('daily', {})
    today = timezone.now().astimezone(zone).date()
    dates = [(today + timedelta(days=index)).isoformat() for index in range(days)]
    if daily.get('time') != dates:
        raise ForecastUnavailable('Extended forecast dates are incomplete')

    def number(field, index, digits=0):
        values = daily.get(field)
        if not isinstance(values, list) or len(values) != days:
            raise ForecastUnavailable('Extended forecast values are incomplete')
        value = values[index]
        if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
            raise ForecastUnavailable('Extended forecast contains missing values')
        return round(value, digits) if digits else round(value)

    forecast = []
    for index, date in enumerate(dates):
        code = number('weather_code', index)
        condition, icon = CONDITIONS.get(code, ('Unknown', '\u2601\ufe0f'))
        forecast.append({
            'dayIndex': index, 'day': datetime.fromisoformat(date).strftime('%a'),
            'date': date, 'condition': condition, 'icon': icon,
            'temperature': {'max': number('temperature_2m_max', index),
                            'min': number('temperature_2m_min', index)},
            'rainSum': number('rain_sum', index, 1),
            'precipitationSum': number('precipitation_sum', index, 1),
            'rainChance': number('precipitation_probability_max', index),
            'precipitationHours': number('precipitation_hours', index, 1),
            'rainfall': number('precipitation_sum', index, 1),
            'wind': number('wind_speed_10m_max', index),
            'humidity': number('relative_humidity_2m_mean', index),
            'uv': number('uv_index_max', index, 1),
        })
    return forecast
