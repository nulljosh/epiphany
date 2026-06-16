import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

export function useAlerts(authUser) {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const fetched = useRef(false);
  const notifiedRef = useRef(new Set());

  useEffect(() => {
    if (!authUser?.email || fetched.current) return;
    fetched.current = true;
    setLoading(true);
    fetch('/api/alerts', { credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then(rows => setAlerts(Array.isArray(rows) ? rows : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [authUser?.email]);

  const addAlert = useCallback(async (symbol, targetPrice, direction) => {
    try {
      const res = await fetch('/api/alerts', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, target_price: targetPrice, direction }),
      });
      if (!res.ok) return null;
      const alert = await res.json();
      setAlerts(prev => [alert, ...prev]);
      return alert;
    } catch {
      return null;
    }
  }, []);

  const removeAlert = useCallback(async (id) => {
    try {
      await fetch(`/api/alerts?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
    } catch {}
    setAlerts(prev => prev.filter(a => a.id !== id));
  }, []);

  const clearTriggered = useCallback(() => {
    setAlerts(prev => prev.filter(a => !a.triggered));
  }, []);

  const checkAlerts = useCallback((stocks) => {
    if (!stocks || alerts.length === 0) return;
    setAlerts(prev => prev.map(alert => {
      if (alert.triggered) return alert;
      const stock = stocks[alert.symbol];
      if (!stock) return alert;
      const price = stock.price;
      const target = alert.targetPrice ?? alert.target_price;
      if (typeof price !== 'number' || typeof target !== 'number') return alert;

      const hit = alert.direction === 'above' ? price >= target : price <= target;
      if (!hit) return alert;

      // Send browser notification (once per alert)
      if (!notifiedRef.current.has(alert.id)) {
        notifiedRef.current.add(alert.id);
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          try {
            new Notification(`${alert.symbol} Alert`, {
              body: `${alert.symbol} hit $${price.toFixed(2)} (target: ${alert.direction} $${target.toFixed(2)})`,
              icon: '/icon-192.svg',
            });
          } catch {}
        }
      }

      return { ...alert, triggered: true, triggeredPrice: price, triggeredAt: new Date().toISOString() };
    }));
  }, [alerts]);

  const activeCount = useMemo(() => alerts.filter(a => !a.triggered).length, [alerts]);

  return { alerts, loading, activeCount, addAlert, removeAlert, clearTriggered, checkAlerts };
}
