import { useState, useEffect, useCallback, useRef } from 'react';
import { FETCH_TIMEOUT } from '../utils/helpers';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

export function useOntology(isAuthenticated) {
  const [objects, setObjects] = useState({});
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const initialized = useRef(false);

  // Fetch ontology stats on mount
  useEffect(() => {
    if (!isAuthenticated || initialized.current) return;
    initialized.current = true;
    fetchStats();
  }, [isAuthenticated]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/ontology?action=stats`, {
        credentials: 'include',
        signal: AbortSignal.timeout(FETCH_TIMEOUT),
      });
      if (res.ok) setStats(await res.json());
    } catch { /* non-critical */ }
  }, []);

  const listByType = useCallback(async (type, limit = 50) => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/ontology?action=list&type=${type}&limit=${limit}`, {
        credentials: 'include',
        signal: AbortSignal.timeout(FETCH_TIMEOUT),
      });
      if (!res.ok) return [];
      const data = await res.json();
      if (data.objects.length > 0) {
        setObjects(prev => {
          const next = { ...prev };
          for (const obj of data.objects) next[obj.id] = obj;
          return next;
        });
      }
      return data.objects;
    } catch {
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const getObject = useCallback(async (id) => {
    try {
      const res = await fetch(`${API_BASE}/api/ontology?action=get&id=${encodeURIComponent(id)}`, {
        credentials: 'include',
        signal: AbortSignal.timeout(FETCH_TIMEOUT),
      });
      if (!res.ok) return null;
      const obj = await res.json();
      setObjects(prev => ({ ...prev, [obj.id]: obj }));
      return obj;
    } catch {
      return null;
    }
  }, []);

  const upsert = useCallback(async (obj) => {
    try {
      const res = await fetch(`${API_BASE}/api/ontology?action=upsert`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(obj),
      });
      if (!res.ok) return false;
      setObjects(prev => ({ ...prev, [obj.id]: obj }));
      return true;
    } catch {
      return false;
    }
  }, []);

  const batchUpsert = useCallback(async (objectList) => {
    try {
      const res = await fetch(`${API_BASE}/api/ontology?action=batch`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ objects: objectList }),
      });
      if (!res.ok) return 0;
      const data = await res.json();
      setObjects(prev => {
        const next = { ...prev };
        for (const obj of objectList) next[obj.id] = obj;
        return next;
      });
      return data.upserted;
    } catch {
      return 0;
    }
  }, []);

  const deleteObject = useCallback(async (id) => {
    try {
      await fetch(`${API_BASE}/api/ontology?action=delete&id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      setObjects(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      return true;
    } catch {
      return false;
    }
  }, []);

  const link = useCallback(async (type, sourceId, targetId, properties = {}) => {
    try {
      const res = await fetch(`${API_BASE}/api/ontology?action=link`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, sourceId, targetId, properties }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }, []);

  const getRelationships = useCallback(async (id, direction = 'both') => {
    try {
      const res = await fetch(`${API_BASE}/api/ontology?action=relationships&id=${encodeURIComponent(id)}&direction=${direction}`, {
        credentials: 'include',
        signal: AbortSignal.timeout(FETCH_TIMEOUT),
      });
      if (!res.ok) return { outbound: [], inbound: [] };
      return await res.json();
    } catch {
      return { outbound: [], inbound: [] };
    }
  }, []);

  const query = useCallback(async (type, key, value, limit = 20) => {
    try {
      const params = new URLSearchParams({ action: 'query', type, limit: String(limit) });
      if (key) params.set('key', key);
      if (value) params.set('value', value);
      const res = await fetch(`${API_BASE}/api/ontology?${params}`, {
        credentials: 'include',
        signal: AbortSignal.timeout(FETCH_TIMEOUT),
      });
      if (!res.ok) return [];
      const data = await res.json();
      return data.objects;
    } catch {
      return [];
    }
  }, []);

  return {
    objects,
    stats,
    loading,
    listByType,
    getObject,
    upsert,
    batchUpsert,
    deleteObject,
    link,
    getRelationships,
    query,
    refreshStats: fetchStats,
  };
}
