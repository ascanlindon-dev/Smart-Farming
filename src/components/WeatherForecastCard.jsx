import { useContext } from 'react';
import { LanguageContext } from '../LanguageContext';
import { useWeather } from '../hooks/useWeather';
import { WeatherRefreshStatus } from './WeatherRefreshStatus';

const DEFAULT_WEATHER_QUERY = 'Victoria, Oriental Mindoro, Philippines';

const getDayLabel = (dateString, fallbackIndex, language) => {
  const locale = language === 'tl' ? 'fil-PH' : 'en-US';

  if (dateString) {
    const date = new Date(dateString);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString(locale, { weekday: 'long' });
    }
  }

  const fallbackDate = new Date();
  fallbackDate.setDate(fallbackDate.getDate() + fallbackIndex);
  return fallbackDate.toLocaleDateString(locale, { weekday: 'long' });
};

const getWeatherInfo = (condition) => {
  return { condition };
};

const generateSmartRecommendations = (forecast, language) => {
  return [];
};

const WeatherForecastCard = ({ city }) => {
  const processForecastData = (forecastList) => {
    return forecastList.map((day) => ({
      ...day,
      high: day.temperature?.max ?? day.high,
      low: day.temperature?.min ?? day.low,
    }));
  };

  const { language } = useContext(LanguageContext);

  const t = {
    en: {
      weatherTitle: 'Weather Forecast',
      lastUpdatedLabel: 'Last updated:',
      currentLabel: 'Current',
      requestedLabel: 'Requested:',
      resolvedLabel: 'Resolved:',
      noForecast: 'No forecast available.',
      loadingForecast: 'Loading forecast...',
      humidityLabel: 'Humidity',
      windLabel: 'Wind',
      recommendationsTitle: 'Smart Recommendations',
      savedWeatherNotice: 'Showing saved weather because the live API is unavailable.',
      liveWeatherLabel: 'Live weather',
      savedWeatherLabel: 'Saved weather',
    },
    tl: {
      weatherTitle: 'Taya ng Panahon',
      lastUpdatedLabel: 'Huling na-update:',
      currentLabel: 'Kasalukuyan',
      requestedLabel: 'Hiniling:',
      resolvedLabel: 'Naresolba:',
      noForecast: 'Walang available na forecast.',
      loadingForecast: 'Naglo-load ng forecast...',
      humidityLabel: 'Kahalumigmigan',
      windLabel: 'Hangin',
      recommendationsTitle: 'Rekomendasyon Batay sa Forecast',
      savedWeatherNotice: 'Ipinapakita ang naka-save na weather dahil hindi available ang live API.',
      liveWeatherLabel: 'Live na weather',
      savedWeatherLabel: 'Naka-save na weather',
    },
  }[language];

  // Prefer coordinates for better accuracy. The prop can still be a city string or a lat,lon pair.
  const queryLocation = city || DEFAULT_WEATHER_QUERY;
  const { weatherData, error, loading, refresh } = useWeather(queryLocation, 7);
  const forecast = processForecastData(weatherData?.forecast || []);

  const getCardGradient = (condition) => {
    const cond = (condition || '').toLowerCase();
    if (cond.includes('thunderstorm') || cond.includes('lightning') || cond.includes('storm')) return '#6B21A8';
    if (cond.includes('rain') || cond.includes('drizzle')) return '#6495ED';
    if (cond.includes('cloud') || cond.includes('overcast')) return '#D3D3D3';
    return '#FFD700';
  };

  const smartRecommendations = generateSmartRecommendations(forecast, language);
  const current = weatherData?.current || null;
  const resolved = weatherData?.resolved_location || null;
  const isCachedWeather = weatherData?.source === 'cache' || weatherData?.stale === true;
  const updatedAtValue = current?.last_updated_epoch ? current.last_updated_epoch * 1000 : current?.last_updated;
  const updatedAt = updatedAtValue ? new Date(updatedAtValue) : null;
  const timeStr =
    updatedAt && !Number.isNaN(updatedAt.getTime())
      ? updatedAt.toLocaleString(language === 'tl' ? 'fil-PH' : 'en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '—';

  return (
    <div className="space-y-6">
      <h2 className="text-center text-2xl font-semibold text-gray-800 dark:text-gray-200">
        {t.weatherTitle}
      </h2>

      <div className="mx-4 text-xs text-slate-500">
        <WeatherRefreshStatus weatherData={weatherData} loading={loading} refresh={refresh} language={language} />
        <div>
          {t.requestedLabel} <span className="font-semibold">{queryLocation}</span>
        </div>
        {resolved && (
          <div>
            {t.resolvedLabel}{' '}
            <span className="font-semibold">
              {resolved.name}, {resolved.region}, {resolved.country}
            </span>
          </div>
        )}
      </div>

      {error && (
        <div className="mx-4 rounded-lg border bg-amber-50 p-3 text-sm text-amber-800">
          Weather error: {error}
        </div>
      )}

      {isCachedWeather && (
        <div className="mx-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          {t.savedWeatherNotice}
        </div>
      )}

      <div className="mx-4 rounded-2xl bg-white p-5 shadow-lg dark:bg-slate-800">
        <div className="flex items-center justify-between">
          <div className="text-sm text-slate-500">
            {t.currentLabel} · {isCachedWeather ? t.savedWeatherLabel : t.liveWeatherLabel}
          </div>
          <div className="text-xs text-slate-400">
            {t.lastUpdatedLabel} {timeStr}
          </div>
        </div>

        <div className="mt-2 text-3xl font-extrabold text-gray-800 dark:text-gray-100">
          {current?.temp != null ? `${Math.round(current.temp)}°C` : '—'}
        </div>
        <div className="text-sm text-slate-600 dark:text-slate-300">{current?.condition || '—'}</div>
        <div className="mt-2 text-xs text-slate-500">
          {t.humidityLabel}: {current?.humidity != null ? `${current.humidity}%` : '—'} | {t.windLabel}:{' '}
          {current?.wind != null ? `${current.wind} kph` : '—'}
        </div>
      </div>

      {forecast.length > 0 ? (
        <div className="overflow-x-auto px-4 pb-4">
          <div className="flex min-w-max flex-row gap-4">
            {forecast.map((day, idx) => {
              const gradient = getCardGradient(day.condition);
              const dayLabel = getDayLabel(day.date, day.dayIndex ?? idx, language);
              const weatherInfo = getWeatherInfo(day.condition);

              return (
                <div
                  key={idx}
                  className="flex w-[180px] flex-shrink-0 flex-col items-center rounded-3xl shadow-lg transition-all hover:scale-105 hover:shadow-xl"
                >
                  <div
                    className="flex w-full flex-col items-center justify-center rounded-3xl p-6 text-black"
                    style={{ background: gradient }}
                  >
                    <span className="mb-2 text-lg font-bold">{dayLabel}</span>
                    {day.icon && /^(https?:)?\/\//.test(day.icon) ? (
                      <img src={day.icon.startsWith('//') ? `https:${day.icon}` : day.icon}
                        alt={day.condition} className="mb-4 h-16 w-16" />
                    ) : (
                      <span aria-label={day.condition} className="mb-4 text-7xl leading-none">{day.icon || '☁️'}</span>
                    )}
                    <div className="flex items-baseline space-x-1">
                      <span className="text-3xl font-extrabold">{day.high}°</span>
                      <span className="text-sm opacity-70">/ {day.low}°</span>
                    </div>
                    <div className="mt-2 text-xs opacity-80">{day.condition}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="py-12 text-center text-slate-500">
          <p>{loading ? t.loadingForecast : t.noForecast}</p>
        </div>
      )}

      {smartRecommendations.length > 0 && (
        <div className="mx-4 mt-6 rounded-2xl border-l-4 border-emerald-500 bg-white p-5 shadow-lg dark:bg-slate-800">
          <h3 className="mb-3 flex items-center gap-2 text-lg font-bold">
            <span>📋</span>
            {t.recommendationsTitle}
          </h3>
          <ul className="space-y-3">
            {smartRecommendations.map((rec, idx) => (
              <li
                key={idx}
                className="flex items-start gap-3 rounded-lg border bg-slate-50 p-3 dark:bg-slate-900/30"
              >
                <span className="text-xl">{rec.icon}</span>
                <span className="text-sm text-gray-700 dark:text-gray-200">{rec.text}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default WeatherForecastCard;
