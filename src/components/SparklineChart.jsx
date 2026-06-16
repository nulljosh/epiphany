import { useState, useEffect } from 'react';

export default function SparklineChart({ symbol, changePercent, t }) {
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

  if (loading) {
    return (
      <div
        style={{
          width: 60, height: 30, borderRadius: 4,
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
          width: 60, height: 30, borderRadius: 4,
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
          width: 60, height: 30, borderRadius: 4,
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

  // SVG dimensions
  const width = 60;
  const height = 30;
  const padding = 2;
  const chartWidth = width - 2 * padding;
  const chartHeight = height - 2 * padding;

  // Scale prices to SVG coordinates
  const points = prices.map((price, i) => {
    const x = padding + (i / (prices.length - 1)) * chartWidth;
    const y = padding + chartHeight - ((price - min) / range) * chartHeight;
    return `${x},${y}`;
  }).join(' ');

  // Color based on price change
  const color = changePercent >= 0 ? '#30D158' : '#FF453A';

  return (
    <svg
      width={width}
      height={height}
      style={{
        flexShrink: 0,
        overflow: 'visible',
      }}
      viewBox={`0 0 ${width} ${height}`}
    >
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
