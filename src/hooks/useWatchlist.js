import { useState, useEffect, useCallback, useRef } from 'react';

const STORAGE_KEY = 'monica_watchlist';

const DEFAULT_WATCHLIST = [
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA',
  'SPY', 'JPM', 'V', 'NFLX', 'PLTR', 'COIN',
];

export function useWatchlist(authUser) {
  const [watchlist, setWatchlist] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : DEFAULT_WATCHLIST;
    } catch {
      return DEFAULT_WATCHLIST;
    }
  });
  const [loading, setLoading] = useState(false);
  const fetched = useRef(false);

  // Fetch from Supabase when authenticated
  useEffect(() => {
    if (!authUser?.email || fetched.current) return;
    fetched.current = true;
    setLoading(true);
    fetch('/api/watchlist', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(rows => {
        if (Array.isArray(rows) && rows.length > 0) {
          const symbols = rows.map(r => r.symbol);
          setWatchlist(symbols);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(symbols));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [authUser?.email]);

  // Persist to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(watchlist));
    } catch {}
  }, [watchlist]);

  const addSymbol = useCallback((symbol) => {
    const sym = symbol.toUpperCase().trim();
    if (!sym) return;
    setWatchlist(prev => {
      if (prev.includes(sym)) return prev;
      return [...prev, sym];
    });
    // Fire and forget server sync
    if (authUser?.email) {
      fetch('/api/watchlist', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: sym }),
      }).catch(() => {});
    }
  }, [authUser?.email]);

  const removeSymbol = useCallback((symbol) => {
    setWatchlist(prev => prev.filter(s => s !== symbol));
    if (authUser?.email) {
      fetch(`/api/watchlist?symbol=${encodeURIComponent(symbol)}`, {
        method: 'DELETE',
        credentials: 'include',
      }).catch(() => {});
    }
  }, [authUser?.email]);

  const toggleSymbol = useCallback((symbol) => {
    const sym = symbol.toUpperCase().trim();
    setWatchlist(prev => {
      const removing = prev.includes(sym);
      if (removing) {
        if (authUser?.email) {
          fetch(`/api/watchlist?symbol=${encodeURIComponent(sym)}`, {
            method: 'DELETE', credentials: 'include',
          }).catch(() => {});
        }
        return prev.filter(s => s !== sym);
      } else {
        if (authUser?.email) {
          fetch('/api/watchlist', {
            method: 'POST', credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ symbol: sym }),
          }).catch(() => {});
        }
        return [...prev, sym];
      }
    });
  }, [authUser?.email]);

  const resetToDefault = useCallback(() => {
    setWatchlist(DEFAULT_WATCHLIST);
  }, []);

  return {
    watchlist,
    loading,
    addSymbol,
    removeSymbol,
    toggleSymbol,
    resetToDefault,
    isInWatchlist: (sym) => watchlist.includes(sym),
  };
}
