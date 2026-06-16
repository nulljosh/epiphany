import { useEffect, useRef } from 'react';

/**
 * setInterval that pauses when the tab is hidden and resumes on visibility.
 * Fetches immediately on mount and on tab-return.
 *
 * @param {Function} fn - async or sync function to call
 * @param {number} intervalMs - polling interval in ms
 * @param {Array} deps - additional effect dependencies (default [])
 */
export function useVisibilityPolling(fn, intervalMs, deps = []) {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    let id = null;

    const start = () => {
      stop();
      id = setInterval(() => fnRef.current(), intervalMs);
    };

    const stop = () => {
      if (id !== null) { clearInterval(id); id = null; }
    };

    const onVisChange = () => {
      if (document.hidden) {
        stop();
      } else {
        fnRef.current();
        start();
      }
    };

    // Initial fetch + start polling
    fnRef.current();
    start();
    document.addEventListener('visibilitychange', onVisChange);

    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisChange);
    };
  }, [intervalMs, ...deps]);
}
