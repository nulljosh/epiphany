import { useState, useCallback } from 'react';
import { useVisibilityPolling } from './useVisibilityPolling';

export default function useFearGreed() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchFearGreed = useCallback(async () => {
    try {
      const r = await fetch('/api/fear-greed');
      if (!r.ok) return;
      const d = await r.json();
      setData(d);
    } catch { /* non-critical */ }
    finally { setLoading(false); }
  }, []);

  useVisibilityPolling(fetchFearGreed, 5 * 60 * 1000);

  return { score: data?.score ?? null, rating: data?.rating ?? null, loading };
}
