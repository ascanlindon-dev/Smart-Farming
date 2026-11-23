export function WeatherRefreshStatus({ loading, refresh, language }) {
  const tagalog = language === 'tl';
  return (
    <div className="mt-3" aria-live="polite">
      <button type="button" onClick={refresh} disabled={loading}
        className="rounded-md border border-current px-3 py-1 font-semibold disabled:opacity-50">
        {loading ? (tagalog ? 'Ina-update...' : 'Refreshing...') : (tagalog ? 'I-refresh ang weather' : 'Refresh weather')}
      </button>
    </div>
  );
}
