import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../lib/apiFetch.mjs';

export function useDiseaseStats(isActive) {
  const [stats, setStats] = useState(null);
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
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
        const params = new URLSearchParams({ timezone });
        const response = await apiFetch(`/api/predictions/leaf-stats/?${params}`, {
          signal: requestController.signal,
          cache: 'no-store',
        });
        if (!response.ok) throw new Error('Unable to load scan counts');
        const data = await response.json();
        if (![data.diseasesTracked, data.scansToday].every((value) => Number.isInteger(value) && value >= 0)) {
          throw new Error('Invalid scan counts');
        }
        if (active && !requestController.signal.aborted) {
          setStats(data);
          setError(false);
        }
      } catch {
        if (active && !requestController.signal.aborted) {
          setStats(null);
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
  }, [isActive, revision]);

  return { stats, error, refresh };
}
