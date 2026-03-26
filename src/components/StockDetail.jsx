import { useState, useEffect, useCallback } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { formatCurrency } from '../utils/formatting';

const RANGES = [
  { key: '1d', label: '1D', interval: '5m' },
  { key: '5d', label: '5D', interval: '15m' },
  { key: '1mo', label: '1MO', interval: '1d' },
  { key: '3mo', label: '3MO', interval: '1d' },
  { key: '1y', label: '1Y', interval: '1d' },
];

function formatVolume(v) {
  if (!v && v !== 0) return '--';
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return v.toLocaleString();
}

function formatMarketCap(v) {
  if (!v) return '--';
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  return `$${v.toLocaleString()}`;
}

function relativeTime(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'rgba(30,30,30,0.9)',
      backdropFilter: 'blur(12px)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 8,
      padding: '8px 12px',
      fontSize: 12,
      color: '#fff',
    }}>
      <div style={{ color: 'rgba(255,255,255,0.6)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontWeight: 600 }}>{formatCurrency(payload[0].value)}</div>
    </div>
  );
}

export default function StockDetail({ stock, onClose, dark, t }) {
  const [range, setRange] = useState('1mo');
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [detail, setDetail] = useState(null);
  const [news, setNews] = useState([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const font = '-apple-system, BlinkMacSystemFont, system-ui, sans-serif';

  const symbol = stock?.symbol;

  // Fetch full stock detail (open, prevClose, marketCap, etc.)
  const fetchDetail = useCallback(async () => {
    if (!symbol) return;
    try {
      const res = await fetch(`/api/stocks-free?symbols=${encodeURIComponent(symbol)}`);
      if (!res.ok) return;
      const data = await res.json();
      const arr = Array.isArray(data) ? data : (data?.quoteResponse?.result ?? []);
      if (arr.length > 0) setDetail(arr[0]);
    } catch { /* silent */ }
  }, [symbol]);

  // Fetch price history
  const fetchHistory = useCallback(async () => {
    if (!symbol) return;
    setHistoryLoading(true);
    const rangeConfig = RANGES.find(r => r.key === range) || RANGES[2];
    try {
      const res = await fetch(
        `/api/history?symbol=${encodeURIComponent(symbol)}&range=${rangeConfig.key}&interval=${rangeConfig.interval}`
      );
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      if (data.history && Array.isArray(data.history)) {
        setHistory(data.history.map(p => ({
          date: rangeConfig.key === '1d' || rangeConfig.key === '5d'
            ? new Date(p.date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
            : new Date(p.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          close: p.close,
        })));
      }
    } catch { setHistory([]); }
    finally { setHistoryLoading(false); }
  }, [symbol, range]);

  // Fetch news
  const fetchNews = useCallback(async () => {
    if (!symbol) return;
    setNewsLoading(true);
    try {
      const res = await fetch(`/api/news?q=${encodeURIComponent(symbol)}`);
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setNews(data.articles || []);
    } catch { setNews([]); }
    finally { setNewsLoading(false); }
  }, [symbol]);

  useEffect(() => { fetchDetail(); }, [fetchDetail]);
  useEffect(() => { fetchHistory(); }, [fetchHistory]);
  useEffect(() => { fetchNews(); }, [fetchNews]);

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  if (!stock) return null;

  const d = detail || {};
  const price = d.price ?? stock.price;
  const change = d.change ?? (stock.changePercent != null ? (price * stock.changePercent / 100) : 0);
  const changePercent = d.changePercent ?? stock.changePercent ?? 0;
  const positive = changePercent >= 0;
  const changeColor = positive ? '#30D158' : '#FF453A';
  const gradientId = `stock-gradient-${symbol}`;

  // Stats grid data
  const stats = [
    { label: 'Open', value: d.open ? formatCurrency(d.open) : '--' },
    { label: 'Prev Close', value: d.prevClose ? formatCurrency(d.prevClose) : '--' },
    { label: 'Day Range', value: (d.low && d.high) ? `${formatCurrency(d.low)} - ${formatCurrency(d.high)}` : '--' },
    { label: '52W Range', value: (d.fiftyTwoWeekLow && d.fiftyTwoWeekHigh)
        ? `${formatCurrency(d.fiftyTwoWeekLow)} - ${formatCurrency(d.fiftyTwoWeekHigh)}`
        : (stock.low52 && stock.high52) ? `${formatCurrency(stock.low52)} - ${formatCurrency(stock.high52)}` : '--' },
    { label: 'Volume', value: formatVolume(d.volume ?? stock.volume) },
    { label: 'Market Cap', value: formatMarketCap(d.marketCap) },
    { label: 'P/E', value: d.peRatio != null ? d.peRatio.toFixed(2) : '--' },
    { label: 'EPS', value: d.eps != null ? `$${d.eps.toFixed(2)}` : '--' },
  ];

  const glass = {
    background: t.glass,
    backdropFilter: 'blur(20px) saturate(150%)',
    WebkitBackdropFilter: 'blur(20px) saturate(150%)',
    border: `1px solid ${t.cardBorder || t.border}`,
    borderRadius: 12,
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        fontFamily: font,
        animation: 'fadeIn 0.2s ease',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 520,
          maxHeight: '90vh', overflow: 'auto',
          background: dark ? 'rgba(28,28,30,0.95)' : 'rgba(255,255,255,0.95)',
          backdropFilter: 'blur(40px) saturate(180%)',
          WebkitBackdropFilter: 'blur(40px) saturate(180%)',
          borderRadius: '16px 16px 0 0',
          padding: 20,
          animation: 'slideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            position: 'absolute', top: 12, right: 16,
            background: dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
            border: 'none', borderRadius: '50%',
            width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: t.textSecondary, fontSize: 16, fontWeight: 600,
            transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
          onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
        >
          {'\u00d7'}
        </button>

        {/* Header */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: t.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {symbol}
          </div>
          <div style={{ fontSize: 13, color: t.textSecondary, marginBottom: 4 }}>
            {stock.name !== symbol ? stock.name : ''}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span style={{ fontSize: 28, fontWeight: 700, color: t.text }}>
              {formatCurrency(price)}
            </span>
            <span style={{
              display: 'inline-block', padding: '3px 10px', borderRadius: 100,
              fontSize: 13, fontWeight: 600,
              background: positive ? 'rgba(48,209,88,0.15)' : 'rgba(255,69,58,0.15)',
              color: changeColor,
            }}>
              {positive ? '+' : ''}{change.toFixed(2)} ({positive ? '+' : ''}{changePercent.toFixed(2)}%)
            </span>
          </div>
        </div>

        {/* Range Picker */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
          {RANGES.map(r => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              style={{
                flex: 1, padding: '6px 0', borderRadius: 8, border: 'none',
                background: range === r.key
                  ? (t.accent || '#0071e3')
                  : (dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'),
                color: range === r.key ? '#fff' : t.textSecondary,
                fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: font,
                transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* Chart */}
        <div style={{ ...glass, padding: '12px 8px 8px', marginBottom: 12, height: 200 }}>
          {historyLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: t.textTertiary, fontSize: 12 }}>
              Loading chart...
            </div>
          ) : history.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: t.textTertiary, fontSize: 12 }}>
              No chart data available
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={changeColor} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={changeColor} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: t.textTertiary || '#8e8e93' }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                  minTickGap={40}
                />
                <YAxis
                  domain={['auto', 'auto']}
                  tick={{ fontSize: 10, fill: t.textTertiary || '#8e8e93' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={v => `$${v.toFixed(0)}`}
                  width={45}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="close"
                  stroke={changeColor}
                  strokeWidth={1.5}
                  fill={`url(#${gradientId})`}
                  dot={false}
                  animationDuration={400}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Stats Grid */}
        <div style={{
          ...glass, padding: 14, marginBottom: 12,
          display: 'grid', gridTemplateColumns: '1fr 1fr',
          gap: '10px 16px',
        }}>
          {stats.map(s => (
            <div key={s.label}>
              <div style={{ fontSize: 11, color: t.textTertiary || t.textSecondary, marginBottom: 2 }}>{s.label}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* News */}
        <div style={{ ...glass, padding: 14 }}>
          <div style={{
            fontSize: 11, fontWeight: 600, color: t.textSecondary,
            textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8,
          }}>
            Related News
          </div>
          {newsLoading ? (
            <div style={{ padding: '12px 0', color: t.textTertiary, fontSize: 12, textAlign: 'center' }}>
              Loading news...
            </div>
          ) : news.length === 0 ? (
            <div style={{ padding: '12px 0', color: t.textTertiary, fontSize: 12, textAlign: 'center' }}>
              No news available
            </div>
          ) : (
            news.slice(0, 5).map((article, i) => (
              <a
                key={i}
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex', gap: 10, padding: '10px 0',
                  borderBottom: i < Math.min(news.length, 5) - 1 ? `1px solid ${t.border}` : 'none',
                  textDecoration: 'none', color: 'inherit',
                  transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
                }}
                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
              >
                {article.image && (
                  <img
                    src={article.image}
                    alt=""
                    style={{ width: 48, height: 48, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }}
                    onError={e => { e.target.style.display = 'none'; }}
                  />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 12, fontWeight: 600, color: t.text, lineHeight: 1.3, marginBottom: 3,
                    overflow: 'hidden', textOverflow: 'ellipsis',
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                  }}>
                    {article.title}
                  </div>
                  <div style={{ fontSize: 10, color: t.textTertiary || t.textSecondary }}>
                    {article.source}{article.publishedAt ? ` -- ${relativeTime(article.publishedAt)}` : ''}
                  </div>
                </div>
              </a>
            ))
          )}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
