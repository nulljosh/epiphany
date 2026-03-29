import { useState, useEffect, useCallback, useRef } from 'react';
import { FETCH_TIMEOUT } from '../utils/helpers';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

export function usePeopleIndex(isAuthenticated) {
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(false);
  const initialized = useRef(false);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/people-index`, {
        credentials: 'include',
        signal: AbortSignal.timeout(FETCH_TIMEOUT),
      });
      if (!res.ok) return;
      const data = await res.json();
      setPeople(data.people || []);
    } catch { /* non-critical */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated || initialized.current) return;
    initialized.current = true;
    fetchAll();
  }, [isAuthenticated, fetchAll]);

  const search = useCallback(async (query) => {
    try {
      const res = await fetch(`${API_BASE}/api/people-index?q=${encodeURIComponent(query)}`, {
        credentials: 'include',
        signal: AbortSignal.timeout(FETCH_TIMEOUT),
      });
      if (!res.ok) return [];
      const data = await res.json();
      return data.people || [];
    } catch {
      return [];
    }
  }, []);

  const upsert = useCallback(async (person) => {
    // Optimistic update
    setPeople(prev => {
      const idx = prev.findIndex(p => p.id === person.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], ...person, updatedAt: new Date().toISOString() };
        return next;
      }
      return [{ ...person, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, ...prev];
    });

    try {
      const res = await fetch(`${API_BASE}/api/people-index`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(person),
      });
      if (!res.ok) {
        fetchAll(); // revert on failure
        return null;
      }
      const data = await res.json();
      return data.person;
    } catch {
      fetchAll();
      return null;
    }
  }, [fetchAll]);

  const remove = useCallback(async (id) => {
    setPeople(prev => prev.filter(p => p.id !== id));
    try {
      await fetch(`${API_BASE}/api/people-index?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
    } catch {
      fetchAll();
    }
  }, [fetchAll]);

  const enrich = useCallback(async (personId) => {
    try {
      const res = await fetch(`${API_BASE}/api/people-enrich`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return { ok: false, error: err.error || `Enrichment failed (${res.status})` };
      }
      const data = await res.json();
      // Update local state with enrichment
      setPeople(prev => prev.map(p =>
        p.id === personId
          ? { ...p, enrichment: data.enrichment, updatedAt: new Date().toISOString() }
          : p
      ));
      return { ok: true, enrichment: data.enrichment, linkedAssociates: data.linkedAssociates };
    } catch {
      return { ok: false, error: 'Network error' };
    }
  }, []);

  const crossref = useCallback(async (personId) => {
    try {
      const url = personId
        ? `${API_BASE}/api/people-crossref?personId=${encodeURIComponent(personId)}`
        : `${API_BASE}/api/people-crossref`;
      const res = await fetch(url, {
        credentials: 'include',
        signal: AbortSignal.timeout(FETCH_TIMEOUT),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }, []);

  return { people, loading, fetchAll, search, upsert, remove, enrich, crossref };
}
