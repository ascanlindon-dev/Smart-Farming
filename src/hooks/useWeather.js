import { apiFetch } from '../lib/apiFetch.mjs';
import { readWeatherCache, writeWeatherCache } from '../lib/weatherCache.mjs';
import { useCallback, useEffect, useRef, useState } from 'react';

// Keep an open weather screen current, with the same manual refresh behavior.
export function useWeather(query, days) {
  const weatherQuery = typeof query === 'string' ? query.trim() : '';
  const cacheKey = `${weatherQuery}|${days}`;
  const [state, setState] = useState(() => {
    const weatherData = readWeatherCache(weatherQuery, days);
    return { weatherData, error: null, loading: !weatherData, cacheKey };
  });
  const refreshRef = useRef(null);
  const refresh = useCallback(() => refreshRef.current?.(), []);

  useEffect(() => {
    let active = true;
    let controller = null;
    if (!weatherQuery) {
      setState({ weatherData: null, error: null, loading: false, cacheKey });
      refreshRef.current = null;
      return () => {
        active = false;
        refreshRef.current = null;
      };
    }
    const cachedWeather = readWeatherCache(weatherQuery, days);
    setState({ weatherData: cachedWeather, error: null, loading: !cachedWeather, cacheKey });

    const fetchWeather = async () => {
      if (controller) return;
      controller = new AbortController();
      setState((previous) => ({
        ...previous,
        loading: !previous.weatherData,
        error: null,
      }));
      try {
        const response = await apiFetch(`/api/weather/?q=${encodeURIComponent(weatherQuery)}&days=${days}`, {
          cache: 'no-store', signal: controller.signal,
        });
        const data = await response.json().catch(() => null);
        if (!response.ok || !data || data.ok === false) {
          throw new Error(data?.error || `Weather request failed (HTTP ${response.status}).`);
        }
        writeWeatherCache(weatherQuery, days, data);
        if (active) setState({ weatherData: data, error: null, loading: false, cacheKey });
      } catch (error) {
        if (active && error.name !== 'AbortError') {
          setState((previous) => ({
            ...previous,
            error: error.message,
            loading: false,
          }));
        }
      } finally {
        controller = null;
      }
    };

    refreshRef.current = fetchWeather;
    fetchWeather();
    const timer = setInterval(fetchWeather, 5 * 60 * 1000);
    window.addEventListener('focus', fetchWeather);
    window.addEventListener('online', fetchWeather);
    return () => {
      active = false;
      clearInterval(timer);
      controller?.abort();
      refreshRef.current = null;
      window.removeEventListener('focus', fetchWeather);
      window.removeEventListener('online', fetchWeather);
    };
  }, [query, days]);

  const currentState = state.cacheKey === cacheKey
    ? state
    : (() => {
      const weatherData = readWeatherCache(weatherQuery, days);
      return { weatherData, error: null, loading: !weatherData };
    })();

  return { ...currentState, refresh };
}
