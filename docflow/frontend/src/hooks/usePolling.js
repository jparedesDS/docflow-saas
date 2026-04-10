import { useEffect, useRef, useCallback } from 'react';

/**
 * Hook for periodic data polling with visibility awareness.
 * Pauses when tab is hidden, resumes when visible.
 *
 * @param {Function} fetchFn - Async function to call periodically
 * @param {number} intervalMs - Polling interval in milliseconds
 * @param {Object} options - { enabled: bool }
 */
export default function usePolling(fetchFn, intervalMs, options = {}) {
  const { enabled = true } = options;
  const intervalRef = useRef(null);
  const fetchRef = useRef(fetchFn);

  // Keep fetchFn ref current without triggering re-renders
  useEffect(() => {
    fetchRef.current = fetchFn;
  }, [fetchFn]);

  const startPolling = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      fetchRef.current();
    }, intervalMs);
  }, [intervalMs]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      stopPolling();
      return;
    }

    startPolling();

    // Pause/resume based on tab visibility
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        stopPolling();
      } else {
        fetchRef.current(); // Refresh immediately when tab becomes visible
        startPolling();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [enabled, startPolling, stopPolling]);
}
