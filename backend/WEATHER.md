# Open-Meteo weather

Open-Meteo provides current conditions, hourly forecasts and the seven-day forecast.
WeatherAPI keys and WEATHER_EXTENDED_PROVIDER are no longer used by the main
weather endpoint. Local demos use the public endpoint. An optional
OPEN_METEO_API_KEY selects the customer endpoint for a configured subscription.

The default farm is Victoria, Oriental Mindoro (13.1772, 121.2781). Other locations
can use a city name or latitude,longitude. Unknown cities return an error instead
of silently displaying another farm's weather. Coordinates are recommended for
unambiguous farm locations.

The response identifies open_meteo as its provider. requested_days, returned_days
and forecast_complete reflect the actual dates returned. Hourly forecasts start
at the current hour in the location's timezone. Missing measurements stay null.
Provider errors do not include credential-bearing URLs.

Successful responses are cached separately by location and requested duration.
A cache write failure does not discard live weather. On provider failure, saved
data is served for up to three hours, explicitly marked stale. Expired forecast
dates are removed and coverage is recalculated.

Check through the frontend proxy:
http://localhost:3000/api/weather/?q=13.1772,121.2781&days=7

Regression check:
.\.venv\Scripts\python.exe backend/manage.py test api.test_weather --settings=backend.test_settings
