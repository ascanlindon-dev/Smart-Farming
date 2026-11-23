import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../lib/apiFetch.mjs';
import { readSessionData, writeSessionData } from '../lib/sessionDataCache.mjs';

export function useDiseaseStats(isActive) {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const cacheKey = `/api/predictions/leaf-stats/?timezone=${encodeURIComponent(timezone)}`;
  const [initialCache] = useState(() => readSessionData(cacheKey));
  const [stats, setStats] = useState(initialCache?.data ?? null);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);

  useEffect(() => {
    if (!isActive) return undefined;
    let active = true;
    let controller;

    async function loadStats() {
      controller?.abort();
      const requestController = new AbortController();
      controller = requestController;
      try {
        const params = new URLSearchParams({ timezone });
        const response = await apiFetch(`/api/predictions/leaf-stats/?${params}`, {
          signal: requestController.signal,
          cache: 'no-store',
        });
        if (response.status === 401 || response.status === 403) {
          if (active && !requestController.signal.aborted) {
            setStats(null);
            setError(true);
          }
          return;
        }
        if (!response.ok) throw new Error('Unable to load scan counts');
        const data = await response.json();
        if (![data.diseasesTracked, data.scansToday].every((value) => Number.isInteger(value) && value >= 0)) {
          throw new Error('Invalid scan counts');
        }
        if (active && !requestController.signal.aborted) {
          setStats(data);
          writeSessionData(cacheKey, data);
          setError(false);
        }
      } catch {
        if (active && !requestController.signal.aborted) {
          setError(true);
        }
      }
    }

    function refreshWhenVisible() {
      if (document.visibilityState === 'visible') void loadStats();
    }

    void loadStats();
    const timer = window.setInterval(refreshWhenVisible, 60000);
    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      active = false;
      controller?.abort();
      window.clearInterval(timer);
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [cacheKey, isActive, revision, timezone]);

  return { stats, error, refresh };
}
