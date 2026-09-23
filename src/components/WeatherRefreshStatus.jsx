export function WeatherRefreshStatus({ weatherData, loading, refresh, language }) {
  const tagalog = language === 'tl';
  const formatTime = (value) => value ? new Date(value).toLocaleString(tagalog ? 'fil-PH' : 'en-US') : null;
  const checked = formatTime(weatherData?.fetched_at);
  const updated = formatTime(weatherData?.current?.last_updated_epoch * 1000);
  const cached = weatherData?.stale || weatherData?.source === 'cache';

  return (
    <div className="mt-3 space-y-1 text-sm" aria-live="polite">
      <button type="button" onClick={refresh} disabled={loading}
        className="rounded-md border border-current px-3 py-1 font-semibold disabled:opacity-50">
        {loading ? (tagalog ? 'Ina-update...' : 'Refreshing...') : (tagalog ? 'I-refresh ang weather' : 'Refresh weather')}
      </button>
      <p>{tagalog ? 'Awtomatikong nire-refresh kada 5 minuto.' : 'Refreshes automatically every 5 minutes.'}</p>
      {weatherData && <p>
        {tagalog ? 'Kasalukuyang panahon: ' : 'Current weather: '}
        <a href="https://www.weatherapi.com/" target="_blank" rel="noreferrer" className="underline">WeatherAPI.com</a>
        {' · '}{tagalog ? 'Taya: ' : 'Forecast: '}
        {weatherData.forecast_provider === 'open_meteo'
          ? <a href="https://open-meteo.com/" target="_blank" rel="noreferrer" className="underline">Open-Meteo</a>
          : <a href="https://www.weatherapi.com/" target="_blank" rel="noreferrer" className="underline">WeatherAPI.com</a>}
      </p>}
      {updated && <p>{tagalog ? 'Update ng weather provider: ' : 'Weather provider updated: '}{updated}</p>}
      {checked && <p>{tagalog ? 'Huling nakuha: ' : 'Last fetched: '}{checked}</p>}
      {weatherData?.requested_days && <p>{tagalog
        ? `May taya para sa ${weatherData.returned_days} sa ${weatherData.requested_days} araw, kasama ang ngayon.`
        : `Forecast for ${weatherData.returned_days} of ${weatherData.requested_days} days, including today.`}</p>}
      {weatherData?.forecast_complete === false && <p role="status" className="font-semibold">{tagalog
        ? 'Kulang ang available na taya. Subukang i-refresh mamaya.'
        : 'The full forecast is unavailable. Try refreshing later.'}</p>}
      {cached && <p>{tagalog
        ? 'Naka-save na weather ito. Hindi available ang live update ngayon.'
        : 'Showing saved weather. A live update is currently unavailable.'}</p>}
    </div>
  );
}
