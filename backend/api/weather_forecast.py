"""Extend a short WeatherAPI forecast using the same resolved coordinates."""
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
    0: ('Clear sky', '\u2600\ufe0f'),
    1: ('Mainly clear', '\U0001f324\ufe0f'),
    2: ('Partly cloudy', '\u26c5'),
    3: ('Overcast', '\u2601\ufe0f'),
    45: ('Fog', '\U0001f32b\ufe0f'),
    48: ('Freezing fog', '\U0001f32b\ufe0f'),
    51: ('Light drizzle', '\U0001f326\ufe0f'),
    53: ('Moderate drizzle', '\U0001f326\ufe0f'),
    55: ('Dense drizzle', '\U0001f327\ufe0f'),
    56: ('Light freezing drizzle', '\U0001f327\ufe0f'),
    57: ('Dense freezing drizzle', '\U0001f327\ufe0f'),
    61: ('Light rain', '\U0001f327\ufe0f'),
    63: ('Moderate rain', '\U0001f327\ufe0f'),
    65: ('Heavy rain', '\U0001f327\ufe0f'),
    66: ('Light freezing rain', '\U0001f327\ufe0f'),
    67: ('Heavy freezing rain', '\U0001f327\ufe0f'),
    71: ('Light snow', '\U0001f328\ufe0f'),
    73: ('Moderate snow', '\U0001f328\ufe0f'),
    75: ('Heavy snow', '\U0001f328\ufe0f'),
    77: ('Snow grains', '\U0001f328\ufe0f'),
    80: ('Light rain showers', '\U0001f326\ufe0f'),
    81: ('Moderate rain showers', '\U0001f327\ufe0f'),
    82: ('Heavy rain showers', '\U0001f327\ufe0f'),
    85: ('Light snow showers', '\U0001f328\ufe0f'),
    86: ('Heavy snow showers', '\U0001f328\ufe0f'),
    95: ('Thunderstorm', '\u26c8\ufe0f'),
    96: ('Thunderstorm with light hail', '\u26c8\ufe0f'),
    99: ('Thunderstorm with heavy hail', '\u26c8\ufe0f'),
}
DAILY_FIELDS = (
    'weather_code', 'temperature_2m_max', 'temperature_2m_min',
    'precipitation_sum', 'wind_speed_10m_max', 'uv_index_max',
    'relative_humidity_2m_mean',
)


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
            'rainfall': number('precipitation_sum', index, 1),
            'wind': number('wind_speed_10m_max', index),
            'humidity': number('relative_humidity_2m_mean', index),
            'uv': number('uv_index_max', index, 1),
        })
    return forecast
