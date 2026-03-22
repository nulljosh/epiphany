import { useState, useEffect, useCallback, useRef } from 'react';

const STORAGE_KEY = 'opticon_alerts';

function loadAlerts() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function useAlerts() {
  const [alerts, setAlerts] = useState(loadAlerts);
  const notifiedRef = useRef(new Set());

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts)); } catch {}
  }, [alerts]);

  // Request notification permission on first alert
  useEffect(() => {
    if (alerts.length > 0 && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [alerts.length]);

  const addAlert = useCallback((symbol, targetPrice, direction = 'above') => {
    const alert = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      symbol: symbol.toUpperCase().trim(),
      targetPrice: Number(targetPrice),
      direction,
      triggered: false,
      createdAt: Date.now(),
    };
    setAlerts(prev => [...prev, alert]);
    return alert;
  }, []);

  const removeAlert = useCallback((id) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
    notifiedRef.current.delete(id);
  }, []);

  const clearTriggered = useCallback(() => {
    setAlerts(prev => prev.filter(a => !a.triggered));
  }, []);

  const checkAlerts = useCallback((stocks) => {
    if (!stocks || typeof stocks !== 'object') return [];
    const newlyTriggered = [];

    setAlerts(prev => {
      let changed = false;
      const updated = prev.map(alert => {
        if (alert.triggered) return alert;
        const stock = stocks[alert.symbol];
        if (!stock?.price) return alert;

        const price = Number(stock.price);
        const hit = alert.direction === 'above'
          ? price >= alert.targetPrice
          : price <= alert.targetPrice;

        if (hit) {
          changed = true;
          const triggered = { ...alert, triggered: true, triggeredAt: Date.now(), triggeredPrice: price };
          newlyTriggered.push(triggered);

          // Browser notification (fire once)
          if (!notifiedRef.current.has(alert.id) && 'Notification' in window && Notification.permission === 'granted') {
            notifiedRef.current.add(alert.id);
            new Notification(`${alert.symbol} Alert`, {
              body: `${alert.symbol} is now $${price.toFixed(2)} (target: ${alert.direction} $${alert.targetPrice.toFixed(2)})`,
              icon: '/icon-192.svg',
            });
          }
          return triggered;
        }
        return alert;
      });
      return changed ? updated : prev;
    });

    return newlyTriggered;
  }, []);

  const activeAlerts = alerts.filter(a => !a.triggered);
  const triggeredAlerts = alerts.filter(a => a.triggered);

  return {
    alerts,
    activeAlerts,
    triggeredAlerts,
    addAlert,
    removeAlert,
    clearTriggered,
    checkAlerts,
    activeCount: activeAlerts.length,
  };
}
