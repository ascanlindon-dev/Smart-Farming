const memoryCache = new Map();

const cacheKey = (query, days) => `${String(query || '').trim()}|${days}`;
const storageKey = (key) => `rambutech-weather:${key}`;
const isWeatherData = (data) => (
  data
  && data.ok === true
  && Array.isArray(data.forecast)
  && data.current
  && typeof data.current === 'object'
);

export function readWeatherCache(query, days) {
  const key = cacheKey(query, days);
  let cached = memoryCache.get(key);

  if (!cached && typeof window !== 'undefined') {
    try {
      const saved = window.localStorage.getItem(storageKey(key));
      if (saved) {
        cached = JSON.parse(saved);
        if (isWeatherData(cached?.data)) memoryCache.set(key, cached);
      }
    } catch (error) {
      cached = null;
    }
  }

  if (!isWeatherData(cached?.data)) return null;
  return {
    ...cached.data,
    source: 'browser_cache',
    stale: true,
    cached_at: cached.cachedAt,
  };
}

export function writeWeatherCache(query, days, data) {
  if (!isWeatherData(data)) return;
  const key = cacheKey(query, days);
  const cached = { data, cachedAt: new Date().toISOString() };
  memoryCache.set(key, cached);

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(storageKey(key), JSON.stringify(cached));
    } catch (error) {
      // Keep the in-memory cache available if persistent browser storage is unavailable.
    }
  }
}
