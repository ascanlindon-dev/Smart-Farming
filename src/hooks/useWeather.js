import { apiFetch } from '../lib/apiFetch.mjs';
import { useCallback, useEffect, useRef, useState } from 'react';

// Keep an open weather screen current, with the same manual refresh behavior.
export function useWeather(query, days) {
  const [state, setState] = useState({ weatherData: null, error: null, loading: true });
  const refreshRef = useRef(null);
  const refresh = useCallback(() => refreshRef.current?.(), []);

  useEffect(() => {
    let active = true;
    let controller = null;
    setState({ weatherData: null, error: null, loading: true });

    const fetchWeather = async () => {
      if (controller) return;
      controller = new AbortController();
      setState((previous) => ({ ...previous, loading: true, error: null }));
      try {
        const response = await apiFetch(`/api/weather/?q=${encodeURIComponent(query)}&days=${days}`, {
          cache: 'no-store', signal: controller.signal,
        });
        const data = await response.json().catch(() => null);
        if (!response.ok || !data || data.ok === false) {
          throw new Error(data?.error || `Weather request failed (HTTP ${response.status}).`);
        }
        if (active) setState({ weatherData: data, error: null, loading: false });
      } catch (error) {
        if (active && error.name !== 'AbortError') {
          setState({ weatherData: null, error: error.message, loading: false });
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

  return { ...state, refresh };
}
