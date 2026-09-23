from copy import deepcopy
from datetime import datetime, timedelta, timezone
import os
from unittest.mock import Mock, patch

from django.test import SimpleTestCase

from api.weather_forecast import fetch_extended_forecast, ForecastUnavailable


class ExtendedForecastTests(SimpleTestCase):
    def setUp(self):
        # It is already the next calendar day in the Philippines.
        now = datetime(2026, 9, 16, 18, 0, tzinfo=timezone.utc)
        self.location = {'lat': 13.1772, 'lon': 121.2781, 'timezone': 'Asia/Manila'}
        self.dates = [(now.date() + timedelta(days=i + 1)).isoformat() for i in range(7)]
        self.daily = {
            'time': self.dates, 'weather_code': [95] * 7,
            'temperature_2m_max': [31.6] * 7, 'temperature_2m_min': [24.2] * 7,
            'precipitation_sum': [20.14] * 7, 'wind_speed_10m_max': [22.3] * 7,
            'relative_humidity_2m_mean': [80.1] * 7, 'uv_index_max': [5.2] * 7,
        }
        clock = patch('api.weather_forecast.timezone.now', return_value=now)
        clock.start()
        self.addCleanup(clock.stop)
        config = patch.dict(os.environ, {'OPEN_METEO_API_KEY': ''})
        config.start()
        self.addCleanup(config.stop)

    def provider(self, daily):
        result = Mock(ok=True)
        result.json.return_value = {'daily': daily}
        return result

    def test_seven_local_days_preserve_weather_units_and_conditions(self):
        with patch('api.weather_forecast.requests.get', return_value=self.provider(self.daily)) as get:
            result = fetch_extended_forecast(self.location, 7)
        self.assertEqual([day['date'] for day in result], self.dates)
        self.assertEqual(result[0]['temperature'], {'max': 32, 'min': 24})
        self.assertEqual(result[0]['rainfall'], 20.1)
        self.assertEqual(result[0]['wind'], 22)
        self.assertEqual(result[0]['condition'], 'Thunderstorm')
        params = get.call_args.kwargs['params']
        self.assertEqual(params['latitude'], self.location['lat'])
        self.assertEqual(params['longitude'], self.location['lon'])
        self.assertEqual(params['timezone'], 'Asia/Manila')
        self.assertEqual(params['forecast_days'], 7)
        self.assertNotIn('apikey', params)

    def test_missing_days_duplicates_and_null_values_are_rejected(self):
        invalid = []
        short = deepcopy(self.daily)
        short['time'] = self.dates[:3]
        invalid.append(short)
        duplicate = deepcopy(self.daily)
        duplicate['time'][-1] = self.dates[0]
        invalid.append(duplicate)
        missing = deepcopy(self.daily)
        missing['temperature_2m_max'][4] = None
        invalid.append(missing)
        bad_number = deepcopy(self.daily)
        bad_number['precipitation_sum'][2] = float('nan')
        invalid.append(bad_number)
        for daily in invalid:
            with self.subTest(daily=daily), patch('api.weather_forecast.requests.get', return_value=self.provider(daily)):
                with self.assertRaises(ForecastUnavailable):
                    fetch_extended_forecast(self.location, 7)

    def test_commercial_key_selects_customer_endpoint(self):
        with patch.dict(os.environ, {'OPEN_METEO_API_KEY': 'test-key'}), patch('api.weather_forecast.requests.get', return_value=self.provider(self.daily)) as get:
            fetch_extended_forecast(self.location, 7)
        self.assertEqual(get.call_args.args[0], 'https://customer-api.open-meteo.com/v1/forecast')
        self.assertEqual(get.call_args.kwargs['params']['apikey'], 'test-key')
