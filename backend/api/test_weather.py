from datetime import timedelta
import os
from types import SimpleNamespace
from unittest.mock import Mock, patch

import requests
from django.test import SimpleTestCase
from django.utils import timezone
from rest_framework.test import APIRequestFactory

from api import views


class CachedRows:
    """In-memory cache query fixture; never connects to the application database."""

    def __init__(self, rows):
        self.rows = rows

    def filter(self, **conditions):
        rows = self.rows
        for field, value in conditions.items():
            if field.endswith('__gte'):
                rows = [row for row in rows if getattr(row, field[:-5]) >= value]
            else:
                rows = [row for row in rows if getattr(row, field) == value]
        return CachedRows(rows)

    def order_by(self, *fields):
        return CachedRows(sorted(self.rows, key=lambda row: row.fetched_at, reverse=True))

    def first(self):
        return next(iter(self.rows), None)


class WeatherApiTests(SimpleTestCase):
    def setUp(self):
        config = patch.dict(os.environ, {'WEATHER_EXTENDED_PROVIDER': 'none'})
        config.start()
        self.addCleanup(config.stop)
        self.now = timezone.now().replace(hour=4, minute=0, second=0, microsecond=0)
        clock = patch('django.utils.timezone.now', return_value=self.now)
        clock.start()
        self.addCleanup(clock.stop)
        self.today = self.now.date().isoformat()
        self.query = 'Victoria, Oriental Mindoro, Philippines'
        self.provider_data = {
            'timezone': 'Asia/Manila',
            'current': {'temperature_2m': 29.3, 'time': self.today + 'T12:00'},
            'daily': {'time': [self.today], 'temperature_2m_max': [32.1], 'temperature_2m_min': [24.1]},
        }
        self.provider = Mock(ok=True, status_code=200)
        self.provider.json.return_value = self.provider_data

    def request(self, days=5):
        return APIRequestFactory().get('/api/weather/', {'q': self.query, 'days': days})

    def cached_row(self, days=5, age=timedelta(minutes=10)):
        return SimpleNamespace(
            normalized_q=views._normalize_weather_query(self.query), requested_q=self.query,
            days=days, fetched_at=self.now - age, save=Mock(),
            payload={'current': {'temp': 28}, 'forecast': [
                {'date': (self.now.date() - timedelta(days=1)).isoformat()}, {'date': self.today},
            ], 'resolved_location': {'timezone': 'UTC'}},
        )

    def test_cache_write_failure_still_returns_live_weather(self):
        with patch('requests.get', return_value=self.provider), patch.object(views, '_save_weather_cache', side_effect=RuntimeError('cache failure')):
            response = views.weather(self.request())
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['source'], 'live')
        self.assertFalse(response.data['stale'])
        self.assertEqual(response.data['current']['temp'], 29)
        self.assertEqual(response['Cache-Control'], 'no-store')
        self.assertEqual(response.data['current']['last_updated'], self.today + 'T12:00')
        self.assertEqual(response.data['current_provider'], 'open_meteo')
        self.assertIsNone(response.data['current']['humidity'])
        self.assertIsNone(response.data['forecast'][0]['rainfall'])

    def test_cache_save_selects_duration_and_tolerates_duplicate_locations(self):
        short = self.cached_row(days=2)
        older = self.cached_row(days=5, age=timedelta(minutes=20))
        latest = self.cached_row(days=5)
        rows = CachedRows([short, older, latest])
        with patch.object(views.WeatherCache.objects, 'filter', side_effect=rows.filter), patch.object(views.WeatherCache.objects, 'create') as create:
            views._save_weather_cache(self.query, 5, {'source': 'live'})
        latest.save.assert_called_once()
        short.save.assert_not_called()
        older.save.assert_not_called()
        create.assert_not_called()
        self.assertEqual(latest.payload, {'source': 'live'})

    def test_recent_cache_is_marked_stale_and_past_forecast_days_are_removed(self):
        row = self.cached_row()
        with patch('requests.get', side_effect=requests.Timeout('URL with secret-key')), patch.object(views.WeatherCache.objects, 'filter', side_effect=CachedRows([row]).filter):
            response = views.weather(self.request())
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['source'], 'cache')
        self.assertTrue(response.data['stale'])
        self.assertEqual(response.data['cached_at'], row.fetched_at.isoformat())
        self.assertEqual(response.data['forecast'], [{'date': self.today}])
        self.assertNotIn('secret-key', str(response.data))
        self.assertEqual(len(row.payload['forecast']), 2)

    def test_month_old_cache_is_not_served_as_current_weather(self):
        old = self.cached_row(age=timedelta(days=30))
        with patch('requests.get', side_effect=requests.Timeout()), patch.object(views.WeatherCache.objects, 'filter', side_effect=CachedRows([old]).filter):
            response = views.weather(self.request())
        self.assertEqual(response.status_code, 502)
        self.assertFalse(response.data['cache_available'])
        self.assertNotIn('current', response.data)

    def test_provider_http_failure_does_not_expose_the_request_url(self):
        self.provider.ok = False
        self.provider.status_code = 403
        self.provider.url = 'https://api.weatherapi.com/?key=secret-key'
        with patch('requests.get', return_value=self.provider), patch.object(views.WeatherCache.objects, 'filter', side_effect=CachedRows([]).filter):
            response = views.weather(self.request())
        self.assertEqual(response.status_code, 502)
        self.assertIn('403', response.data['error'])
        self.assertNotIn('secret-key', str(response.data))

    def test_incomplete_provider_response_is_not_saved_as_live(self):
        self.provider.json.return_value = {'error': {'code': 2007}}
        with patch('requests.get', return_value=self.provider), patch.object(views.WeatherCache.objects, 'filter', side_effect=CachedRows([]).filter), patch.object(views, '_save_weather_cache') as save:
            response = views.weather(self.request())
        self.assertEqual(response.status_code, 502)
        save.assert_not_called()

    def test_short_forecast_reports_real_coverage(self):
        with patch('requests.get', return_value=self.provider), patch.object(views, '_save_weather_cache'):
            response = views.weather(self.request(days=7))
        self.assertEqual(response.data['requested_days'], 7)
        self.assertEqual(response.data['returned_days'], 1)
        self.assertFalse(response.data['forecast_complete'])

    def test_seven_days_from_open_meteo_are_complete(self):
        self.provider_data['daily'] = {
            'time': [(self.now.date() + timedelta(days=i)).isoformat() for i in range(7)],
            'temperature_2m_max': [32] * 7, 'temperature_2m_min': [24] * 7,
        }
        with patch('requests.get', return_value=self.provider) as get, patch.object(views, '_save_weather_cache'):
            response = views.weather(self.request(days=7))
        self.assertTrue(response.data['forecast_complete'])
        self.assertEqual(response.data['forecast_provider'], 'open_meteo')
        self.assertEqual(get.call_args.kwargs['params']['forecast_days'], 7)
        self.assertNotIn('key', get.call_args.kwargs['params'])

    def test_unknown_city_does_not_silently_show_victoria_weather(self):
        self.provider.json.return_value = {'results': []}
        with patch('requests.get', return_value=self.provider), patch.object(views, '_save_weather_cache') as save:
            response = views.weather(APIRequestFactory().get('/api/weather/', {'q': 'Missing City'}))
        self.assertEqual(response.status_code, 400)
        save.assert_not_called()

    def test_coordinate_location_is_not_mislabeled_victoria(self):
        with patch('requests.get', return_value=self.provider) as get, patch.object(views, '_save_weather_cache'):
            response = views.weather(APIRequestFactory().get('/api/weather/', {'q': '14.5,121.0'}))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['resolved_location']['name'], '14.5,121.0')
        self.assertEqual(get.call_args.kwargs['params']['latitude'], 14.5)

    def test_hourly_forecast_starts_at_current_hour_instead_of_noon(self):
        self.now = self.now.replace(hour=10)
        # setUp's patched clock returns the original object; patch again locally.
        self.provider_data['hourly'] = {
            'time': [self.today + f'T{hour:02}:00' for hour in range(24)],
            'temperature_2m': list(range(24)),
        }
        with patch('django.utils.timezone.now', return_value=self.now), patch('requests.get', return_value=self.provider), patch.object(views, '_save_weather_cache'):
            response = views.weather(self.request())
        self.assertEqual(response.data['hourly'][0]['time'], self.today + 'T18:00')

    def test_null_or_invalid_temperature_is_not_live_weather(self):
        for value in (None, float('nan'), 'hot'):
            self.provider_data['current']['temperature_2m'] = value
            with self.subTest(value=value), patch('requests.get', return_value=self.provider), patch.object(views.WeatherCache.objects, 'filter', side_effect=CachedRows([]).filter), patch.object(views, '_save_weather_cache') as save:
                response = views.weather(self.request())
            self.assertEqual(response.status_code, 502)
            save.assert_not_called()

    def test_cached_coverage_is_recalculated_after_dates_expire(self):
        row = self.cached_row(days=7)
        row.payload.update({'requested_days': 7, 'returned_days': 7, 'forecast_complete': True})
        with patch('requests.get', side_effect=requests.Timeout()), patch.object(views.WeatherCache.objects, 'filter', side_effect=CachedRows([row]).filter):
            response = views.weather(self.request(days=7))
        self.assertEqual(response.data['source'], 'cache')
        self.assertEqual(response.data['returned_days'], 1)
        self.assertFalse(response.data['forecast_complete'])
        self.assertEqual(row.payload['returned_days'], 7)

    def test_duplicate_dates_do_not_count_as_full_coverage(self):
        payload = {'forecast': [{'date': self.today}] * 7}
        result = views._forecast_coverage(payload, 7)
        self.assertEqual(result['returned_days'], 1)
        self.assertFalse(result['forecast_complete'])
