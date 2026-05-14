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

// --- Indicator Library ---
const INDICATOR_LIBRARY = [
  { key: 'sma', label: 'SMA', category: 'overlay', defaults: { period: 20, color: '#2196F3', source: 'close' } },
  { key: 'ema', label: 'EMA', category: 'overlay', defaults: { period: 50, color: '#FF9800', source: 'close' } },
  { key: 'wma', label: 'WMA', category: 'overlay', defaults: { period: 20, color: '#9C27B0', source: 'close' } },
  { key: 'vwap', label: 'VWAP', category: 'overlay', defaults: { color: '#00BCD4' } },
  { key: 'bb', label: 'Bollinger Bands', category: 'overlay', defaults: { period: 20, stdDev: 2, color: '#7E57C2' } },
  { key: 'rsi', label: 'RSI', category: 'oscillator', defaults: { period: 14, color: '#E91E63', overbought: 70, oversold: 30 } },
  { key: 'macd', label: 'MACD', category: 'oscillator', defaults: { fast: 12, slow: 26, signal: 9, color: '#2196F3' } },
  { key: 'stoch', label: 'Stochastic', category: 'oscillator', defaults: { kPeriod: 14, dPeriod: 3, color: '#FF5722' } },
  { key: 'atr', label: 'ATR', category: 'oscillator', defaults: { period: 14, color: '#795548' } },
];

function computeSMA(data, period, source = 'close') {
  const result = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) continue;
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += data[j][source];
    result.push({ time: data[i].time, value: sum / period });
  }
  return result;
}

function computeEMA(data, period, source = 'close') {
  const k = 2 / (period + 1);
  const result = [];
  let ema = null;
  for (let i = 0; i < data.length; i++) {
    const val = data[i][source];
    if (ema === null) {
      if (i < period - 1) continue;
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) sum += data[j][source];
      ema = sum / period;
    } else {
      ema = val * k + ema * (1 - k);
    }
    result.push({ time: data[i].time, value: ema });
  }
  return result;
}

function computeWMA(data, period, source = 'close') {
  const result = [];
  const denom = (period * (period + 1)) / 2;
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) sum += data[i - period + 1 + j][source] * (j + 1);
    result.push({ time: data[i].time, value: sum / denom });
  }
  return result;
}

function computeVWAP(data) {
  const result = [];
  let cumVol = 0, cumTP = 0;
  for (const d of data) {
    const tp = (d.high + d.low + d.close) / 3;
    const vol = d.volume || 1;
    cumTP += tp * vol;
    cumVol += vol;
    result.push({ time: d.time, value: cumTP / cumVol });
  }
  return result;
}

function computeBB(data, period, stdDev, source = 'close') {
  const upper = [], lower = [], middle = [];
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += data[j][source];
    const mean = sum / period;
    let sqSum = 0;
    for (let j = i - period + 1; j <= i; j++) sqSum += (data[j][source] - mean) ** 2;
    const std = Math.sqrt(sqSum / period);
    middle.push({ time: data[i].time, value: mean });
    upper.push({ time: data[i].time, value: mean + stdDev * std });
    lower.push({ time: data[i].time, value: mean - stdDev * std });
  }
  return { upper, middle, lower };
}

function computeRSI(data, period, source = 'close') {
  const result = [];
  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i < data.length; i++) {
    const diff = data[i][source] - data[i - 1][source];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    if (i <= period) {
      avgGain += gain;
      avgLoss += loss;
      if (i === period) {
        avgGain /= period;
        avgLoss /= period;
        const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
        result.push({ time: data[i].time, value: 100 - 100 / (1 + rs) });
      }
    } else {
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      result.push({ time: data[i].time, value: 100 - 100 / (1 + rs) });
    }
  }
  return result;
}

function computeMACD(data, fast, slow, signal, source = 'close') {
  const emaFast = computeEMA(data, fast, source);
  const emaSlow = computeEMA(data, slow, source);
  const macdLine = [];
  const slowMap = new Map(emaSlow.map(d => [d.time, d.value]));
  for (const d of emaFast) {
    const s = slowMap.get(d.time);
    if (s != null) macdLine.push({ time: d.time, value: d.value - s });
  }
  const signalLine = [];
  const k = 2 / (signal + 1);
  let ema = null;
  for (let i = 0; i < macdLine.length; i++) {
    if (ema === null) {
      if (i < signal - 1) continue;
      let sum = 0;
      for (let j = i - signal + 1; j <= i; j++) sum += macdLine[j].value;
      ema = sum / signal;
    } else {
      ema = macdLine[i].value * k + ema * (1 - k);
    }
    signalLine.push({ time: macdLine[i].time, value: ema });
  }
  const histogram = [];
  const sigMap = new Map(signalLine.map(d => [d.time, d.value]));
  for (const d of macdLine) {
    const s = sigMap.get(d.time);
    if (s != null) histogram.push({ time: d.time, value: d.value - s, color: d.value - s >= 0 ? 'rgba(48,209,88,0.5)' : 'rgba(255,69,58,0.5)' });
  }
  return { macdLine, signalLine, histogram };
}

function computeStochastic(data, kPeriod, dPeriod) {
  const kLine = [];
  for (let i = kPeriod - 1; i < data.length; i++) {
    let high = -Infinity, low = Infinity;
    for (let j = i - kPeriod + 1; j <= i; j++) {
      high = Math.max(high, data[j].high);
      low = Math.min(low, data[j].low);
    }
    const k = high === low ? 50 : ((data[i].close - low) / (high - low)) * 100;
    kLine.push({ time: data[i].time, value: k });
  }
  const dLine = [];
  for (let i = dPeriod - 1; i < kLine.length; i++) {
    let sum = 0;
    for (let j = i - dPeriod + 1; j <= i; j++) sum += kLine[j].value;
    dLine.push({ time: kLine[i].time, value: sum / dPeriod });
  }
  return { kLine, dLine };
}

function computeATR(data, period) {
  const trueRanges = [];
  for (let i = 0; i < data.length; i++) {
    if (i === 0) {
      trueRanges.push(data[i].high - data[i].low);
    } else {
      const tr = Math.max(
        data[i].high - data[i].low,
        Math.abs(data[i].high - data[i - 1].close),
        Math.abs(data[i].low - data[i - 1].close)
      );
      trueRanges.push(tr);
    }
  }
  const result = [];
  let atr = null;
  for (let i = 0; i < trueRanges.length; i++) {
    if (i < period - 1) continue;
    if (atr === null) {
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) sum += trueRanges[j];
      atr = sum / period;
    } else {
      atr = (atr * (period - 1) + trueRanges[i]) / period;
    }
    result.push({ time: data[i].time, value: atr });
  }
  return result;
}

const STORAGE_KEY = 'epiphany-indicators';

function loadIndicators() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch { return []; }
}

function saveIndicators(indicators) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(indicators)); } catch {}
}

const RANGES = [
  { key: '1m',  label: '1m',  range: '1d',  interval: '1m'  },
  { key: '15m', label: '15m', range: '5d',  interval: '15m' },
  { key: '1d',  label: '1D',  range: '1d',  interval: '5m'  },
  { key: '5d',  label: '1W',  range: '5d',  interval: '30m' },
  { key: '1mo', label: '1M',  range: '1mo', interval: '1d'  },
  { key: '3mo', label: '3M',  range: '3mo', interval: '1d'  },
  { key: '6mo', label: '6M',  range: '6mo', interval: '1d'  },
  { key: 'ytd', label: 'YTD', range: 'ytd', interval: '1d'  },
  { key: '1y',  label: '1Y',  range: '1y',  interval: '1d'  },
  { key: '2y',  label: '2Y',  range: '2y',  interval: '1wk' },
  { key: '5y',  label: '5Y',  range: '5y',  interval: '1wk' },
  { key: '10y', label: '10Y', range: '10y', interval: '1mo' },
  { key: 'max', label: 'ALL', range: 'max', interval: '1mo' },
];

export default function StockDetail({ stock, onClose, dark, t, onNavigate, currentIndex, totalCount }) {
  const [range, setRange] = useState('1mo');
  const [chartType, setChartType] = useState('heikinAshi');
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const [detail, setDetail] = useState(null);
  const [news, setNews] = useState([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [activeIndicators, setActiveIndicators] = useState(() => loadIndicators());
  const [showIndicatorPanel, setShowIndicatorPanel] = useState(false);
  const [editingIndicator, setEditingIndicator] = useState(null);
  const oscillatorContainerRef = useRef(null);
  const oscillatorChartRef = useRef(null);
  const scrollRef = useRef(null);
  const font = '-apple-system, BlinkMacSystemFont, system-ui, sans-serif';

  const symbol = stock?.symbol;

  // Persist indicators to localStorage
  useEffect(() => { saveIndicators(activeIndicators); }, [activeIndicators]);
  useEffect(() => { scrollRef.current?.scrollTo(0, 0); }, [symbol]);

  const addIndicator = useCallback((key) => {
    const lib = INDICATOR_LIBRARY.find(i => i.key === key);
    if (!lib) return;
    const id = `${key}_${Date.now()}`;
    setActiveIndicators(prev => [...prev, { id, key, params: { ...lib.defaults } }]);
  }, []);

  const removeIndicator = useCallback((id) => {
    setActiveIndicators(prev => prev.filter(i => i.id !== id));
  }, []);

  const updateIndicatorParams = useCallback((id, params) => {
    setActiveIndicators(prev => prev.map(i => i.id === id ? { ...i, params: { ...i.params, ...params } } : i));
    setEditingIndicator(null);
  }, []);

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
        `/api/history?symbol=${encodeURIComponent(symbol)}&range=${rangeConfig.range ?? rangeConfig.key}&interval=${rangeConfig.interval}`,
        { signal }
      );
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      if (data.history && Array.isArray(data.history)) {
        const seen = new Set();
        setHistory(data.history
          .filter(p => p.time != null && p.close != null)
          .filter(p => { const k = String(p.time); if (seen.has(k)) return false; seen.add(k); return true; })
          .map(p => ({
            time: p.time,
            open: p.open ?? p.close,
            high: p.high ?? p.close,
            low: p.low ?? p.close,
            close: p.close,
          })));
      }
    } catch (err) { if (err.name !== 'AbortError') setHistory([]); }
    finally { setHistoryLoading(false); }
  }, [symbol, range]);

  // Fetch news with retry
  const fetchNews = useCallback(async (signal) => {
    if (!symbol) return;
    setNewsLoading(true);
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(`/api/news?q=${encodeURIComponent(symbol)}`, { signal });
        if (!res.ok) throw new Error('Failed');
        const data = await res.json();
        setNews(data.articles || []);
        setNewsLoading(false);
        return;
      } catch (err) {
        if (err.name === 'AbortError') { setNewsLoading(false); return; }
        if (attempt < 2) await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
    setNews([]);
    setNewsLoading(false);
  }, [symbol]);

  useEffect(() => {
    const controller = new AbortController();
    fetchDetail(controller.signal);
    fetchHistory(controller.signal);
    fetchNews(controller.signal);
    return () => controller.abort();
  }, [symbol]);

  useEffect(() => { fetchHistory(); }, [range]);

  // Keyboard navigation: Escape to close, ArrowLeft/Right to cycle stocks
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && onNavigate && currentIndex > 0) onNavigate(currentIndex - 1);
      if (e.key === 'ArrowRight' && onNavigate && currentIndex < totalCount - 1) onNavigate(currentIndex + 1);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, onNavigate, currentIndex, totalCount]);

  // Render lightweight-charts
  useEffect(() => {
    if (!chartContainerRef.current || history.length === 0) return;

    const container = chartContainerRef.current;
    const isDark = dark !== false;

    let chart;
    try {
    chart = createChart(container, {
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

    // --- Overlay indicators ---
    const overlays = activeIndicators.filter(ind => {
      const lib = INDICATOR_LIBRARY.find(l => l.key === ind.key);
      return lib && lib.category === 'overlay';
    });

    for (const ind of overlays) {
      try {
        const p = ind.params;
        if (ind.key === 'sma') {
          const d = computeSMA(history, p.period, p.source);
          const s = chart.addSeries(LineSeries, { color: p.color, lineWidth: 1.5, priceLineVisible: false, lastValueVisible: false });
          s.setData(d);
        } else if (ind.key === 'ema') {
          const d = computeEMA(history, p.period, p.source);
          const s = chart.addSeries(LineSeries, { color: p.color, lineWidth: 1.5, priceLineVisible: false, lastValueVisible: false });
          s.setData(d);
        } else if (ind.key === 'wma') {
          const d = computeWMA(history, p.period, p.source);
          const s = chart.addSeries(LineSeries, { color: p.color, lineWidth: 1.5, priceLineVisible: false, lastValueVisible: false });
          s.setData(d);
        } else if (ind.key === 'vwap') {
          const d = computeVWAP(history);
          const s = chart.addSeries(LineSeries, { color: p.color, lineWidth: 1.5, lineStyle: 2, priceLineVisible: false, lastValueVisible: false });
          s.setData(d);
        } else if (ind.key === 'bb') {
          const { upper, middle, lower } = computeBB(history, p.period, p.stdDev, p.source || 'close');
          const sM = chart.addSeries(LineSeries, { color: p.color, lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
          sM.setData(middle);
          const sU = chart.addSeries(LineSeries, { color: p.color, lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false });
          sU.setData(upper);
          const sL = chart.addSeries(LineSeries, { color: p.color, lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false });
          sL.setData(lower);
        }
      } catch (err) { console.warn('Indicator error:', ind.key, err.message); }
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
    } catch (err) {
      console.warn('Chart render error:', err.message);
      return undefined;
    }
  }, [history, chartType, dark, range, activeIndicators]);

  // --- Oscillator sub-chart ---
  const oscillators = activeIndicators.filter(ind => {
    const lib = INDICATOR_LIBRARY.find(l => l.key === ind.key);
    return lib && lib.category === 'oscillator';
  });

  useEffect(() => {
    if (!oscillatorContainerRef.current || history.length === 0 || oscillators.length === 0) return;

    const container = oscillatorContainerRef.current;
    const isDark = dark !== false;

    let chart;
    try {
      chart = createChart(container, {
        width: container.clientWidth,
        height: 80,
        layout: {
          background: { type: ColorType.Solid, color: 'transparent' },
          textColor: isDark ? '#8e8e93' : '#6e6e73',
          fontFamily: font,
          fontSize: 9,
        },
        grid: {
          vertLines: { color: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' },
          horzLines: { color: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' },
        },
        rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.1, bottom: 0.1 } },
        timeScale: { borderVisible: false, visible: false },
        handleScroll: { vertTouchDrag: false },
        crosshair: { mode: CrosshairMode.Magnet },
      });

      oscillatorChartRef.current = chart;

      for (const ind of oscillators) {
        const p = ind.params;
        try {
          if (ind.key === 'rsi') {
            const d = computeRSI(history, p.period, p.source || 'close');
            const s = chart.addSeries(LineSeries, { color: p.color, lineWidth: 1.5, priceLineVisible: false, lastValueVisible: true });
            s.setData(d);
          } else if (ind.key === 'macd') {
            const { macdLine, signalLine, histogram } = computeMACD(history, p.fast, p.slow, p.signal);
            const hSeries = chart.addSeries(HistogramSeries, { priceLineVisible: false, lastValueVisible: false });
            hSeries.setData(histogram);
            const mSeries = chart.addSeries(LineSeries, { color: p.color, lineWidth: 1.5, priceLineVisible: false, lastValueVisible: false });
            mSeries.setData(macdLine);
            const sSeries = chart.addSeries(LineSeries, { color: '#FF9800', lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
            sSeries.setData(signalLine);
          } else if (ind.key === 'stoch') {
            const { kLine, dLine } = computeStochastic(history, p.kPeriod, p.dPeriod);
            const kS = chart.addSeries(LineSeries, { color: p.color, lineWidth: 1.5, priceLineVisible: false, lastValueVisible: false });
            kS.setData(kLine);
            const dS = chart.addSeries(LineSeries, { color: '#9C27B0', lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false });
            dS.setData(dLine);
          } else if (ind.key === 'atr') {
            const d = computeATR(history, p.period);
            const s = chart.addSeries(LineSeries, { color: p.color, lineWidth: 1.5, priceLineVisible: false, lastValueVisible: true });
            s.setData(d);
          }
        } catch (err) { console.warn('Oscillator error:', ind.key, err.message); }
      }

      chart.timeScale().fitContent();

      const ro = new ResizeObserver(() => {
        if (oscillatorContainerRef.current) {
          chart.applyOptions({ width: oscillatorContainerRef.current.clientWidth });
        }
      });
      ro.observe(container);

      return () => {
        ro.disconnect();
        chart.remove();
        oscillatorChartRef.current = null;
      };
    } catch (err) {
      console.warn('Oscillator chart error:', err.message);
      return undefined;
    }
  }, [history, dark, activeIndicators]);

  const d = detail || EMPTY;
  const price = d.price ?? stock?.price;
  const change = d.change ?? (stock?.changePercent != null ? (price * stock.changePercent / 100) : 0);
  const changePercent = d.changePercent ?? stock?.changePercent ?? 0;
  const positive = changePercent >= 0;
  const changeColor = positive ? '#30D158' : '#FF453A';

  const stats = useMemo(() => [
    { label: 'Open', value: d.open ? formatCurrency(d.open) : '--' },
    { label: 'High', value: d.high ? formatCurrency(d.high) : '--' },
    { label: 'Low', value: d.low ? formatCurrency(d.low) : '--' },
    { label: 'Prev Close', value: d.prevClose ? formatCurrency(d.prevClose) : '--' },
    { label: 'Volume', value: formatVolume(d.volume ?? stock?.volume) },
    { label: 'Avg Vol', value: formatVolume(d.avgVolume) },
    { label: '52W H', value: (d.fiftyTwoWeekHigh ?? stock?.high52) ? formatCurrency(d.fiftyTwoWeekHigh ?? stock?.high52) : '--' },
    { label: '52W L', value: (d.fiftyTwoWeekLow ?? stock?.low52) ? formatCurrency(d.fiftyTwoWeekLow ?? stock?.low52) : '--' },
    { label: 'Mkt Cap', value: formatMarketCap(d.marketCap) },
    { label: 'P/E', value: d.peRatio != null ? d.peRatio.toFixed(2) : '--' },
    { label: 'EPS', value: d.eps != null ? `$${d.eps.toFixed(2)}` : '--' },
    { label: 'Yield', value: d.yield != null ? `${d.yield.toFixed(2)}%` : '--' },
    { label: 'Beta', value: d.beta != null ? d.beta.toFixed(2) : '--' },
  ], [d, stock]);

  if (!stock) return null;

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
        ref={scrollRef}
        style={{
          width: '100%', maxWidth: 'min(520px, 100vw)',
          maxHeight: '92dvh', overflow: 'auto',
          background: dark ? 'rgba(28,28,30,0.95)' : 'rgba(255,255,255,0.95)',
          backdropFilter: 'blur(40px) saturate(180%)',
          WebkitBackdropFilter: 'blur(40px) saturate(180%)',
          borderRadius: '16px 16px 0 0',
          padding: 20, paddingTop: 44,
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

        {/* Navigation + Header */}
        {onNavigate && totalCount > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <button
              onClick={() => currentIndex > 0 && onNavigate(currentIndex - 1)}
              disabled={currentIndex <= 0}
              style={{ background: 'none', border: 'none', color: currentIndex > 0 ? t.text : t.textSecondary, cursor: currentIndex > 0 ? 'pointer' : 'default', fontSize: 16, padding: '2px 6px', opacity: currentIndex > 0 ? 1 : 0.3 }}
            >{'\u2190'}</button>
            <span style={{ fontSize: 11, color: t.textSecondary, fontVariantNumeric: 'tabular-nums' }}>{currentIndex + 1} / {totalCount}</span>
            <button
              onClick={() => currentIndex < totalCount - 1 && onNavigate(currentIndex + 1)}
              disabled={currentIndex >= totalCount - 1}
              style={{ background: 'none', border: 'none', color: currentIndex < totalCount - 1 ? t.text : t.textSecondary, cursor: currentIndex < totalCount - 1 ? 'pointer' : 'default', fontSize: 16, padding: '2px 6px', opacity: currentIndex < totalCount - 1 ? 1 : 0.3 }}
            >{'\u2192'}</button>
          </div>
        )}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: t.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {symbol}
          </div>
          <div style={{ fontSize: 13, color: t.textSecondary, marginBottom: 4 }}>
            {d.shortName || d.longName || d.name || stock.name}
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
        <div style={{ display: 'flex', gap: 3, marginBottom: 8, overflowX: 'auto', flexWrap: 'wrap', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'thin' }}>
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
        <div style={{ display: 'flex', gap: 3, marginBottom: 12, overflowX: 'auto', flexWrap: 'wrap', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'thin' }}>
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

        {/* Indicators Button + Active Tags */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
          <button
            onClick={() => setShowIndicatorPanel(!showIndicatorPanel)}
            style={{
              padding: '5px 10px', borderRadius: 8, border: `1px solid ${dark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)'}`,
              background: showIndicatorPanel ? (t.accent || '#0071e3') : (dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'),
              color: showIndicatorPanel ? '#fff' : t.textSecondary,
              fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: font,
              transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
          >
            + Indicators
          </button>
          {activeIndicators.map(ind => {
            const lib = INDICATOR_LIBRARY.find(l => l.key === ind.key);
            const label = lib ? lib.label : ind.key;
            const paramStr = ind.key === 'bb' ? `${ind.params.period}, ${ind.params.stdDev}`
              : ind.key === 'macd' ? `${ind.params.fast},${ind.params.slow},${ind.params.signal}`
              : ind.key === 'stoch' ? `${ind.params.kPeriod},${ind.params.dPeriod}`
              : ind.key === 'vwap' ? ''
              : ind.params.period ? String(ind.params.period) : '';
            return (
              <div
                key={ind.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '3px 8px', borderRadius: 6,
                  background: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                  fontSize: 10, fontWeight: 600, color: ind.params.color || t.text,
                }}
              >
                <span
                  onClick={() => setEditingIndicator(editingIndicator === ind.id ? null : ind.id)}
                  style={{ cursor: 'pointer' }}
                >
                  {label}{paramStr ? ` (${paramStr})` : ''}
                </span>
                <span
                  onClick={() => removeIndicator(ind.id)}
                  style={{ cursor: 'pointer', color: t.textTertiary, marginLeft: 2, fontSize: 12, lineHeight: 1 }}
                >
                  {'\u00d7'}
                </span>
              </div>
            );
          })}
        </div>

        {/* Indicator Library Panel */}
        {showIndicatorPanel && (
          <div style={{
            ...glass, padding: 12, marginBottom: 10,
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6,
          }}>
            <div style={{ gridColumn: '1 / -1', fontSize: 10, fontWeight: 600, color: t.textTertiary, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
              Overlays
            </div>
            {INDICATOR_LIBRARY.filter(i => i.category === 'overlay').map(ind => (
              <button
                key={ind.key}
                onClick={() => { addIndicator(ind.key); setShowIndicatorPanel(false); }}
                style={{
                  padding: '6px 8px', borderRadius: 8, border: 'none',
                  background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                  color: t.text, fontSize: 11, fontWeight: 500, cursor: 'pointer', fontFamily: font,
                  transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.05)'; e.currentTarget.style.background = dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.background = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'; }}
              >
                {ind.label}
              </button>
            ))}
            <div style={{ gridColumn: '1 / -1', fontSize: 10, fontWeight: 600, color: t.textTertiary, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 6, marginBottom: 2 }}>
              Oscillators
            </div>
            {INDICATOR_LIBRARY.filter(i => i.category === 'oscillator').map(ind => (
              <button
                key={ind.key}
                onClick={() => { addIndicator(ind.key); setShowIndicatorPanel(false); }}
                style={{
                  padding: '6px 8px', borderRadius: 8, border: 'none',
                  background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                  color: t.text, fontSize: 11, fontWeight: 500, cursor: 'pointer', fontFamily: font,
                  transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.05)'; e.currentTarget.style.background = dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.background = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'; }}
              >
                {ind.label}
              </button>
            ))}
          </div>
        )}

        {/* Indicator Settings Editor */}
        {editingIndicator && (() => {
          const ind = activeIndicators.find(i => i.id === editingIndicator);
          if (!ind) return null;
          const lib = INDICATOR_LIBRARY.find(l => l.key === ind.key);
          if (!lib) return null;
          const fields = [];
          if ('period' in lib.defaults) fields.push({ key: 'period', label: 'Period', type: 'number' });
          if ('fast' in lib.defaults) fields.push({ key: 'fast', label: 'Fast', type: 'number' });
          if ('slow' in lib.defaults) fields.push({ key: 'slow', label: 'Slow', type: 'number' });
          if ('signal' in lib.defaults) fields.push({ key: 'signal', label: 'Signal', type: 'number' });
          if ('kPeriod' in lib.defaults) fields.push({ key: 'kPeriod', label: 'K Period', type: 'number' });
          if ('dPeriod' in lib.defaults) fields.push({ key: 'dPeriod', label: 'D Period', type: 'number' });
          if ('stdDev' in lib.defaults) fields.push({ key: 'stdDev', label: 'Std Dev', type: 'number' });
          if ('overbought' in lib.defaults) fields.push({ key: 'overbought', label: 'Overbought', type: 'number' });
          if ('oversold' in lib.defaults) fields.push({ key: 'oversold', label: 'Oversold', type: 'number' });
          fields.push({ key: 'color', label: 'Color', type: 'color' });

          return (
            <div style={{ ...glass, padding: 12, marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: t.text, marginBottom: 8 }}>{lib.label} Settings</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                {fields.map(f => (
                  <label key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: t.textSecondary }}>
                    {f.label}:
                    {f.type === 'color' ? (
                      <input
                        type="color"
                        value={ind.params[f.key] || '#ffffff'}
                        onChange={e => updateIndicatorParams(ind.id, { [f.key]: e.target.value })}
                        style={{ width: 24, height: 20, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}
                      />
                    ) : (
                      <input
                        type="number"
                        value={ind.params[f.key] || ''}
                        onChange={e => updateIndicatorParams(ind.id, { [f.key]: parseFloat(e.target.value) || 0 })}
                        style={{
                          width: 48, padding: '3px 6px', borderRadius: 6, border: `1px solid ${dark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)'}`,
                          background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)',
                          color: t.text, fontSize: 11, fontFamily: font, textAlign: 'center',
                        }}
                      />
                    )}
                  </label>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Chart */}
        <div style={{ ...glass, padding: '12px 8px 8px', marginBottom: oscillators.length > 0 ? 4 : 12, height: 200 }}>
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

        {/* Oscillator Sub-Chart */}
        {oscillators.length > 0 && (
          <div style={{ ...glass, padding: '8px 8px 4px', marginBottom: 12, height: 100 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, paddingLeft: 4 }}>
              {oscillators.map(ind => {
                const lib = INDICATOR_LIBRARY.find(l => l.key === ind.key);
                return (
                  <span key={ind.id} style={{ fontSize: 9, fontWeight: 600, color: ind.params.color || t.textTertiary, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                    {lib ? lib.label : ind.key}
                  </span>
                );
              })}
            </div>
            {history.length > 0 ? (
              <div ref={oscillatorContainerRef} style={{ width: '100%', height: 80 }} />
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 80, color: t.textTertiary, fontSize: 11 }}>
                No data
              </div>
            )}
          </div>
        )}

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
