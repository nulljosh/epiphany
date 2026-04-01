import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createChart, ColorType, LineType, CrosshairMode, CandlestickSeries, BarSeries, LineSeries, AreaSeries, BaselineSeries, HistogramSeries } from 'lightweight-charts';
import { formatCurrency, formatVolume, formatMarketCap, relativeTime } from '../utils/formatting';

const EMPTY = {};
const CHART_TYPES = [
  { key: 'heikinAshi', label: 'Heikin Ashi' },
  { key: 'candles', label: 'Candles' },
  { key: 'hollowCandles', label: 'Hollow' },
  { key: 'bars', label: 'Bars' },
  { key: 'line', label: 'Line' },
  { key: 'stepLine', label: 'Step' },
  { key: 'area', label: 'Area' },
  { key: 'baseline', label: 'Baseline' },
  { key: 'columns', label: 'Columns' },
];

function computeHeikinAshi(data) {
  const ha = [];
  for (let i = 0; i < data.length; i++) {
    const d = data[i];
    const haClose = (d.open + d.high + d.low + d.close) / 4;
    const haOpen = i === 0
      ? (d.open + d.close) / 2
      : (ha[i - 1].open + ha[i - 1].close) / 2;
    ha.push({
      time: d.time,
      open: haOpen,
      high: Math.max(d.high, haOpen, haClose),
      low: Math.min(d.low, haOpen, haClose),
      close: haClose,
    });
  }
  return ha;
}

const RANGES = [
  { key: '1d',  label: '1D',  interval: '5m' },
  { key: '5d',  label: '1W',  interval: '15m' },
  { key: '1mo', label: '1M',  interval: '1d' },
  { key: '3mo', label: '3M',  interval: '1d' },
  { key: '6mo', label: '6M',  interval: '1d' },
  { key: 'ytd', label: 'YTD', interval: '1d' },
  { key: '1y',  label: '1Y',  interval: '1d' },
  { key: '2y',  label: '2Y',  interval: '1wk' },
  { key: '5y',  label: '5Y',  interval: '1wk' },
  { key: '10y', label: '10Y', interval: '1mo' },
  { key: 'max', label: 'ALL', interval: '1mo' },
];

export default function StockDetail({ stock, onClose, dark, t }) {
  const [range, setRange] = useState('1mo');
  const [chartType, setChartType] = useState('heikinAshi');
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const [detail, setDetail] = useState(null);
  const [news, setNews] = useState([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const font = '-apple-system, BlinkMacSystemFont, system-ui, sans-serif';

  const symbol = stock?.symbol;

  // Fetch full stock detail (open, prevClose, marketCap, etc.)
  const fetchDetail = useCallback(async (signal) => {
    if (!symbol) return;
    try {
      const res = await fetch(`/api/stocks-free?symbols=${encodeURIComponent(symbol)}`, { signal });
      if (!res.ok) return;
      const data = await res.json();
      const arr = Array.isArray(data) ? data : (data?.quoteResponse?.result ?? []);
      if (arr.length > 0) setDetail(arr[0]);
    } catch (err) { if (err.name !== 'AbortError') console.warn('fetchDetail:', err.message); }
  }, [symbol]);

  // Fetch price history
  const fetchHistory = useCallback(async (signal) => {
    if (!symbol) return;
    setHistoryLoading(true);
    const rangeConfig = RANGES.find(r => r.key === range) || RANGES[2];
    try {
      const res = await fetch(
        `/api/history?symbol=${encodeURIComponent(symbol)}&range=${rangeConfig.key}&interval=${rangeConfig.interval}`,
        { signal }
      );
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      if (data.history && Array.isArray(data.history)) {
        setHistory(data.history.map(p => ({
          time: p.time,
          open: p.open,
          high: p.high,
          low: p.low,
          close: p.close,
        })));
      }
    } catch (err) { if (err.name !== 'AbortError') setHistory([]); }
    finally { setHistoryLoading(false); }
  }, [symbol, range]);

  // Fetch news
  const fetchNews = useCallback(async (signal) => {
    if (!symbol) return;
    setNewsLoading(true);
    try {
      const res = await fetch(`/api/news?q=${encodeURIComponent(symbol)}`, { signal });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setNews(data.articles || []);
    } catch (err) { if (err.name !== 'AbortError') setNews([]); }
    finally { setNewsLoading(false); }
  }, [symbol]);

  useEffect(() => {
    const controller = new AbortController();
    fetchDetail(controller.signal);
    fetchHistory(controller.signal);
    fetchNews(controller.signal);
    return () => controller.abort();
  }, [symbol]);

  useEffect(() => { fetchHistory(); }, [range]);

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Render lightweight-charts
  useEffect(() => {
    if (!chartContainerRef.current || history.length === 0) return;

    const container = chartContainerRef.current;
    const isDark = dark !== false;

    const chart = createChart(container, {
      width: container.clientWidth,
      height: 180,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: isDark ? '#8e8e93' : '#6e6e73',
        fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif',
        fontSize: 10,
      },
      grid: {
        vertLines: { color: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' },
        horzLines: { color: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' },
      },
      crosshair: { mode: CrosshairMode.Magnet },
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: 0.05, bottom: 0.05 },
      },
      timeScale: {
        borderVisible: false,
        timeVisible: range === '1d' || range === '5d',
        secondsVisible: false,
      },
      handleScroll: { vertTouchDrag: false },
    });

    chartRef.current = chart;

    const upColor = '#30D158';
    const downColor = '#FF453A';

    if (chartType === 'heikinAshi' || chartType === 'candles' || chartType === 'hollowCandles') {
      const seriesData = chartType === 'heikinAshi' ? computeHeikinAshi(history) : history;
      const isHollow = chartType === 'hollowCandles';
      const series = chart.addSeries(CandlestickSeries, {
        upColor: isHollow ? 'transparent' : upColor,
        downColor: downColor,
        borderUpColor: upColor,
        borderDownColor: downColor,
        wickUpColor: upColor,
        wickDownColor: downColor,
      });
      series.setData(seriesData.map(d => ({
        time: d.time,
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
      })));
    } else if (chartType === 'bars') {
      const series = chart.addSeries(BarSeries, {
        upColor,
        downColor,
      });
      series.setData(history.map(d => ({
        time: d.time,
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
      })));
    } else if (chartType === 'line' || chartType === 'stepLine') {
      const series = chart.addSeries(LineSeries, {
        color: upColor,
        lineWidth: 2,
        ...(chartType === 'stepLine' ? { lineType: LineType.WithSteps } : {}),
      });
      series.setData(history.map(d => ({ time: d.time, value: d.close })));
    } else if (chartType === 'area') {
      const series = chart.addSeries(AreaSeries, {
        lineColor: upColor,
        topColor: 'rgba(48,209,88,0.3)',
        bottomColor: 'rgba(48,209,88,0.02)',
        lineWidth: 2,
      });
      series.setData(history.map(d => ({ time: d.time, value: d.close })));
    } else if (chartType === 'baseline') {
      const baseValue = history[0]?.close ?? 0;
      const series = chart.addSeries(BaselineSeries, {
        baseValue: { type: 'price', price: baseValue },
        topLineColor: upColor,
        topFillColor1: 'rgba(48,209,88,0.2)',
        topFillColor2: 'rgba(48,209,88,0.02)',
        bottomLineColor: downColor,
        bottomFillColor1: 'rgba(255,69,58,0.02)',
        bottomFillColor2: 'rgba(255,69,58,0.2)',
        lineWidth: 2,
      });
      series.setData(history.map(d => ({ time: d.time, value: d.close })));
    } else if (chartType === 'columns') {
      const series = chart.addSeries(HistogramSeries, {
        color: upColor,
      });
      series.setData(history.map((d, i) => ({
        time: d.time,
        value: d.close,
        color: i > 0 && d.close < history[i - 1].close ? downColor : upColor,
      })));
    }

    chart.timeScale().fitContent();

    const ro = new ResizeObserver(() => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    });
    ro.observe(container);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [history, chartType, dark, range]);

  if (!stock) return null;

  const d = detail || EMPTY;
  const price = d.price ?? stock.price;
  const change = d.change ?? (stock.changePercent != null ? (price * stock.changePercent / 100) : 0);
  const changePercent = d.changePercent ?? stock.changePercent ?? 0;
  const positive = changePercent >= 0;
  const changeColor = positive ? '#30D158' : '#FF453A';

  const stats = useMemo(() => [
    { label: 'Open', value: d.open ? formatCurrency(d.open) : '--' },
    { label: 'High', value: d.high ? formatCurrency(d.high) : '--' },
    { label: 'Low', value: d.low ? formatCurrency(d.low) : '--' },
    { label: 'Prev Close', value: d.prevClose ? formatCurrency(d.prevClose) : '--' },
    { label: 'Volume', value: formatVolume(d.volume ?? stock.volume) },
    { label: 'Avg Vol', value: formatVolume(d.avgVolume) },
    { label: '52W H', value: (d.fiftyTwoWeekHigh ?? stock.high52) ? formatCurrency(d.fiftyTwoWeekHigh ?? stock.high52) : '--' },
    { label: '52W L', value: (d.fiftyTwoWeekLow ?? stock.low52) ? formatCurrency(d.fiftyTwoWeekLow ?? stock.low52) : '--' },
    { label: 'Mkt Cap', value: formatMarketCap(d.marketCap) },
    { label: 'P/E', value: d.peRatio != null ? d.peRatio.toFixed(2) : '--' },
    { label: 'EPS', value: d.eps != null ? `$${d.eps.toFixed(2)}` : '--' },
    { label: 'Yield', value: d.yield != null ? `${d.yield.toFixed(2)}%` : '--' },
    { label: 'Beta', value: d.beta != null ? d.beta.toFixed(2) : '--' },
  ], [d, stock]);

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
        <div style={{ display: 'flex', gap: 3, marginBottom: 8, overflowX: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}>
          {RANGES.map(r => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              style={{
                padding: '6px 10px', borderRadius: 8, border: 'none', whiteSpace: 'nowrap',
                background: range === r.key
                  ? (t.accent || '#0071e3')
                  : (dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'),
                color: range === r.key ? '#fff' : t.textSecondary,
                fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: font,
                transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
                flexShrink: 0,
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* Chart Type Picker */}
        <div style={{ display: 'flex', gap: 3, marginBottom: 12, overflowX: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}>
          {CHART_TYPES.map(ct => (
            <button
              key={ct.key}
              onClick={() => setChartType(ct.key)}
              style={{
                padding: '5px 8px', borderRadius: 8, border: 'none', whiteSpace: 'nowrap',
                background: chartType === ct.key
                  ? (dark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)')
                  : (dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'),
                color: chartType === ct.key ? t.text : t.textTertiary,
                fontSize: 11, fontWeight: 500, cursor: 'pointer', fontFamily: font,
                transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
                flexShrink: 0,
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
            >
              {ct.label}
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
            <div ref={chartContainerRef} style={{ width: '100%', height: '100%' }} />
          )}
        </div>

        {/* Stats Grid */}
        <div style={{
          ...glass, padding: 14, marginBottom: 12,
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '10px 12px',
        }}>
          {stats.map(s => (
            <div key={s.label}>
              <div style={{ fontSize: 11, color: t.textTertiary || t.textSecondary, marginBottom: 2 }}>{s.label}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* News -- Apple Stocks style */}
        <div style={{ marginTop: 4 }}>
          <div style={{
            fontSize: 11, fontWeight: 600, color: t.textSecondary,
            textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10, paddingLeft: 2,
          }}>
            Related News
          </div>
          {newsLoading ? (
            <div style={{ ...glass, padding: '20px 0', color: t.textTertiary, fontSize: 12, textAlign: 'center' }}>
              Loading news...
            </div>
          ) : news.length === 0 ? (
            <div style={{ ...glass, padding: '20px 0', color: t.textTertiary, fontSize: 12, textAlign: 'center' }}>
              No news available
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {news.slice(0, 6).map((article, i) => {
                const isHero = i === 0 && article.image;
                return (
                  <a
                    key={i}
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'block', textDecoration: 'none', color: 'inherit',
                      borderRadius: 12, overflow: 'hidden',
                      background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                      border: `1px solid ${t.cardBorder || t.border}`,
                      transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
                    }}
                    onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                    onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                  >
                    {article.image && (
                      <div style={{ position: 'relative', width: '100%', paddingTop: isHero ? '50%' : '40%', overflow: 'hidden' }}>
                        <img
                          src={article.image}
                          alt=""
                          style={{
                            position: 'absolute', inset: 0, width: '100%', height: '100%',
                            objectFit: 'cover',
                          }}
                          onError={e => { e.target.style.display = 'none'; }}
                        />
                        {article.source && (
                          <div style={{
                            position: 'absolute', top: 8, left: 8,
                            padding: '3px 8px', borderRadius: 6,
                            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
                            fontSize: 10, fontWeight: 600, color: '#fff',
                            textTransform: 'uppercase', letterSpacing: '0.03em',
                          }}>
                            {article.source}
                          </div>
                        )}
                      </div>
                    )}
                    <div style={{ padding: article.image ? '10px 12px 12px' : '12px' }}>
                      {!article.image && article.source && (
                        <div style={{
                          fontSize: 10, fontWeight: 600, color: t.textTertiary,
                          textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 4,
                        }}>
                          {article.source}
                        </div>
                      )}
                      <div style={{
                        fontSize: isHero ? 15 : 13, fontWeight: 600, color: t.text,
                        lineHeight: 1.35, marginBottom: 6,
                        overflow: 'hidden', textOverflow: 'ellipsis',
                        display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
                      }}>
                        {article.title}
                      </div>
                      <div style={{ fontSize: 10, color: t.textTertiary || t.textSecondary }}>
                        {article.publishedAt ? relativeTime(article.publishedAt) : ''}
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>
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
