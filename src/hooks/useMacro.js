import { useEffect, useState } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

export function useMacro() {
  const [macro, setMacro] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/macro`, { signal: controller.signal });
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(data?.error || `Request failed: ${res.status}`);
        }

        setMacro(Array.isArray(data) ? Object.fromEntries(data.map(item => [item.id, item])) : data);
      } catch (err) {
        if (err.name === 'AbortError') return;
        setError(err.message || 'Failed to load macro data');
      } finally {
        setLoading(false);
      }
    };

    load();
    return () => controller.abort();
  }, []);

  return { macro, loading, error };
}
