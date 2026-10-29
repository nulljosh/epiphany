import { useState, useEffect } from 'react';
import { signal as computeSignal } from '../utils/indicators';

export default function SparklineChart({ symbol, changePercent, t, onSignal }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/history?symbol=${encodeURIComponent(symbol)}&range=1d&interval=1m`);
        if (!res.ok) {
          setData(null);
          return;
        }
        const json = await res.json();
        setData(json.history || []);
      } catch (error) {
        console.error(`Failed to fetch sparkline for ${symbol}:`, error);
        setData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [symbol]);

  // Reuses the same 1d/1m history this sparkline already fetches -- no extra
  // network call -- to unblock the per-row Buy/Sell/Hold badge (roadmap.md
  // "Other open items": was blocked on a bulk history endpoint that turned
  // out unnecessary since this per-row fetch already exists).
  useEffect(() => {
    if (!onSignal) return;
    const closes = (data || []).map(d => d.close).filter(p => p != null);
    onSignal(symbol, computeSignal(closes));
  }, [data, symbol, onSignal]);

  if (loading) {
    return (
      <div
        style={{
          width: 64, height: 36, borderRadius: 4,
          background: `rgba(128, 128, 128, 0.1)`,
          flexShrink: 0,
        }}
      />
    );
  }

  if (!data || data.length === 0) {
    return (
      <div
        style={{
          width: 64, height: 36, borderRadius: 4,
          background: `rgba(128, 128, 128, 0.1)`,
          flexShrink: 0,
        }}
      />
    );
  }

  // Extract closing prices
  const prices = data.map(d => d.close).filter(p => p != null);

  if (prices.length === 0) {
    return (
      <div
        style={{
          width: 64, height: 36, borderRadius: 4,
          background: `rgba(128, 128, 128, 0.1)`,
          flexShrink: 0,
        }}
      />
    );
  }

  // Find min/max for scaling
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1; // Avoid division by zero

  // iOS Stocks style: line, a fade underneath, dotted previous close.
  const last = prices[prices.length - 1];
  const prevClose = Number.isFinite(changePercent) ? last / (1 + changePercent / 100) : null;
  const lo = prevClose != null ? Math.min(min, prevClose) : min;
  const span = (prevClose != null ? Math.max(max, prevClose) : max) - lo || 1;
  const width = 64;
  const height = 36;
  const padding = 2;
  const chartWidth = width - 2 * padding;
  const chartHeight = height - 2 * padding;
  const yOf = (v) => padding + chartHeight - ((v - lo) / span) * chartHeight;

  const coords = prices.map((price, i) => [padding + (i / Math.max(prices.length - 1, 1)) * chartWidth, yOf(price)]);
  const points = coords.map(([x, y]) => `${x},${y}`).join(' ');
  const area = `${padding},${height} ${points} ${padding + chartWidth},${height}`;

  const color = changePercent >= 0 ? '#30D158' : '#FF453A';
  const gradId = `spark-${symbol.replace(/[^a-z0-9]/gi, '')}`;

  return (
    <svg width={width} height={height} style={{ flexShrink: 0, overflow: 'visible' }} viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.35" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#${gradId})`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {prevClose != null && (
        <line x1={padding} x2={padding + chartWidth} y1={yOf(prevClose)} y2={yOf(prevClose)}
          stroke="rgba(142,142,147,0.6)" strokeWidth="1" strokeDasharray="2 3" />
      )}
    </svg>
  );
}
