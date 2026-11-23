import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '../lib/apiFetch.mjs';
import { sensorSnapshot } from '../lib/sensorReadings.mjs';
import { readSessionData, writeSessionData } from '../lib/sessionDataCache.mjs';

const SENSOR_REFRESH_INTERVAL_MS = 5000;
const SENSOR_REQUEST_TIMEOUT_MS = 10000;
const SENSOR_CACHE_KEY = '/api/sensors/';

export function useSensorReadings(enabled = true) {
  const [initialCache] = useState(() => readSessionData(SENSOR_CACHE_KEY));
  const [data, setData] = useState(initialCache?.data ?? null);
  const hasData = useRef(Boolean(initialCache));
  const [state, setState] = useState({
    loading: !initialCache,
    error: false,
    checkedAt: initialCache?.savedAt ?? null,
  });
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = useCallback(() => setRefreshKey((value) => value + 1), []);

  useEffect(() => {
    if (!enabled) {
      setState((previous) => ({ ...previous, loading: false }));
      return undefined;
    }

    let active = true;
    let controller = null;
    let pollTimer = null;

    const poll = async () => {
      controller = new AbortController();
      const requestController = controller;
      const timeoutId = setTimeout(() => requestController.abort(), SENSOR_REQUEST_TIMEOUT_MS);
      setState((previous) => ({ ...previous, loading: !hasData.current }));

      try {
        const response = await apiFetch(SENSOR_CACHE_KEY, {
          signal: requestController.signal,
          cache: 'no-store',
        });
        if (!response.ok) throw new Error(`Sensor request failed (HTTP ${response.status}).`);
        const payload = await response.json();
        if (!payload || typeof payload !== 'object' || Array.isArray(payload) || payload.error) {
          throw new Error('Invalid sensor response.');
        }
        if (!active) return;

        setData(payload);
        writeSessionData(SENSOR_CACHE_KEY, payload);
        hasData.current = true;
        setState({ loading: false, error: false, checkedAt: Date.now() });
      } catch {
        if (active) {
          setState((previous) => ({ ...previous, loading: false, error: true }));
        }
      } finally {
        clearTimeout(timeoutId);
        if (active) pollTimer = setTimeout(poll, SENSOR_REFRESH_INTERVAL_MS);
      }
    };

    poll();

    return () => {
      active = false;
      clearTimeout(pollTimer);
      controller?.abort();
    };
  }, [enabled, refreshKey]);

  return {
    snapshot: sensorSnapshot(data, { requestFailed: state.error }),
    loading: state.loading,
    error: state.error,
    checkedAt: state.checkedAt,
    refresh,
  };
}
