import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';

/**
 * Hook for data fetching with auto-refresh, visibility awareness, and stale detection.
 *
 * @param {string} url - API endpoint to fetch
 * @param {Object} options
 * @param {Object} options.params - Query parameters
 * @param {boolean} options.enabled - Whether to fetch (default: true)
 * @param {number|null} options.refetchInterval - Auto-refetch interval in ms (null = disabled)
 * @returns {{ data, loading, error, refetch, isStale }}
 */
export default function useApiQuery(url, options = {}) {
  const { params = null, enabled = true, refetchInterval = null } = options;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastFetchTime, setLastFetchTime] = useState(null);
  const [isStale, setIsStale] = useState(false);

  const intervalRef = useRef(null);
  const paramsRef = useRef(params);
  paramsRef.current = params;

  const refetch = useCallback(async () => {
    if (!url) return;
    try {
      setError(null);
      const config = paramsRef.current ? { params: paramsRef.current } : {};
      const res = await api.get(url, config);
      setData(res.data);
      setLastFetchTime(Date.now());
      setIsStale(false);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [url]);

  // Initial fetch
  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    refetch();
  }, [enabled, refetch]);

  // Auto-refetch with visibility awareness
  useEffect(() => {
    if (!refetchInterval || !enabled) return;

    const startInterval = () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => {
        // Don't refetch when tab is hidden
        if (document.visibilityState !== 'hidden') {
          refetch();
        }
      }, refetchInterval);
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      } else {
        // Refresh immediately when tab becomes visible, then restart interval
        refetch();
        startInterval();
      }
    };

    startInterval();
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [refetchInterval, enabled, refetch]);

  // Stale detection: mark stale if last fetch was > 2x refetchInterval ago
  useEffect(() => {
    if (!refetchInterval || !lastFetchTime) return;

    const staleThreshold = refetchInterval * 2;
    const checkStale = setInterval(() => {
      const elapsed = Date.now() - lastFetchTime;
      setIsStale(elapsed > staleThreshold);
    }, Math.min(refetchInterval, 30000)); // Check at most every 30s

    return () => clearInterval(checkStale);
  }, [refetchInterval, lastFetchTime]);

  return { data, loading, error, refetch, isStale };
}
