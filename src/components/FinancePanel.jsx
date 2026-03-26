import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Card } from './ui';
import { usePortfolio } from '../hooks/usePortfolio';
import { formatCurrency, compactCurrency, capitalize, CAT_COLORS } from '../utils/formatting';
import { normalizeSpendingMonths } from '../utils/financeData';
import { buildSpendingForecast } from '../utils/spendingForecast';
import FinanceDashboard from './FinanceDashboard';

const TABS = ['portfolio', 'budget', 'spending', 'dashboard'];

const INCOME_SCENARIOS = [
  { label: '+$500', delta: 500, color: '#30D158' },
  { label: '+$1000', delta: 1000, color: '#FF9F0A' },
  { label: 'x2 Income', multiplier: 2, color: '#BF5AF2' },
];


function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const [, base64 = ''] = result.split(',');
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

function parseNumberInput(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clonePortfolioData(data) {
  return JSON.parse(JSON.stringify(data));
}

function monthLabelShort(value) {
  return value.replace(' 20', " '");
}

function ActionMenu({ t, font, actions }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => {
      if (ref.current?.contains(event.target)) return;
      setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((current) => !current)}
        style={{
          borderRadius: 999,
          border: `1px solid ${t.border}`,
          background: t.glass,
          color: t.text,
          padding: '6px 10px',
          fontSize: 11,
          fontWeight: 700,
          cursor: 'pointer',
          fontFamily: font,
          boxShadow: 'none',
        }}
      >
        More
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            minWidth: 140,
            background: t.bg,
            border: `1px solid ${t.border}`,
            borderRadius: 14,
            padding: 6,
            zIndex: 20,
          }}
        >
          {actions.map((action) => (
            <button
              key={action.label}
              onClick={() => {
                setOpen(false);
                action.onClick();
              }}
              style={{
                display: 'block',
                width: '100%',
                border: 'none',
                background: 'transparent',
                color: action.danger ? t.red : t.text,
                padding: '9px 10px',
                textAlign: 'left',
                borderRadius: 10,
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 600,
                fontFamily: font,
                boxShadow: 'none',
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function PieChart({ data, size = 160, t }) {
  if (!data || data.length === 0) return null;
  const total = data.reduce((sum, entry) => sum + entry.value, 0);
  if (total <= 0) return null;

  const colors = Object.values(CAT_COLORS);
  let angle = 0;

  const slices = data.map((entry, index) => {
    const pct = entry.value / total;
    const startAngle = angle;
    angle += pct * 360;
    const endAngle = angle;
    const largeArc = pct > 0.5 ? 1 : 0;
    const radius = size / 2 - 4;
    const cx = size / 2;
    const cy = size / 2;
    const startRad = (startAngle - 90) * Math.PI / 180;
    const endRad = (endAngle - 90) * Math.PI / 180;
    const x1 = cx + radius * Math.cos(startRad);
    const y1 = cy + radius * Math.sin(startRad);
    const x2 = cx + radius * Math.cos(endRad);
    const y2 = cy + radius * Math.sin(endRad);

    if (pct >= 0.999) {
      return <circle key={entry.label} cx={cx} cy={cy} r={radius} fill={colors[index % colors.length]} />;
    }

    return (
      <path
        key={entry.label}
        d={`M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`}
        fill={colors[index % colors.length]}
        opacity={0.85}
      />
    );
  });

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {slices}
        <circle cx={size / 2} cy={size / 2} r={size / 2 - 30} fill={t.bg} />
        <text x={size / 2} y={size / 2 - 6} textAnchor="middle" fill={t.text} fontSize="14" fontWeight="700" fontFamily="-apple-system, system-ui, sans-serif">
          {formatCurrency(total)}
        </text>
        <text x={size / 2} y={size / 2 + 10} textAnchor="middle" fill={t.textTertiary} fontSize="9" fontFamily="-apple-system, system-ui, sans-serif">
          TOTAL
        </text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 180 }}>
        {data.map((entry, index) => (
          <div key={entry.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: colors[index % colors.length] }} />
            <span style={{ color: t.textSecondary }}>{entry.label}</span>
            <span style={{ color: t.text, fontWeight: 600, marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(entry.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProgressBar({ value, max, color, t }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div style={{ height: 6, background: t.glass, borderRadius: 3, overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.3s' }} />
    </div>
  );
}

function StackedBarChart({ spending, t }) {
  if (!spending || spending.length === 0) return null;

  const allCategories = new Set();
  for (const entry of spending) {
    for (const cat of Object.keys(entry.categories || {})) {
      allCategories.add(cat);
    }
  }
  const categories = [...allCategories].sort();
  const maxTotal = Math.max(1, ...spending.map((e) => e.total));

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {spending.map((entry, entryIndex) => (
          <div key={entry.month || entryIndex}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: t.textTertiary, marginBottom: 2 }}>
              <span>{monthLabelShort(entry.month)}</span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{compactCurrency(entry.total)}</span>
            </div>
            <div style={{ display: 'flex', height: 18, borderRadius: 4, overflow: 'hidden', background: t.glass }}>
              {categories.map((cat) => {
                const amount = entry.categories?.[cat] || 0;
                if (amount <= 0) return null;
                const pct = (amount / maxTotal) * 100;
                return (
                  <div
                    key={cat}
                    title={`${cat}: ${compactCurrency(amount)}`}
                    style={{
                      width: `${pct}%`,
                      background: CAT_COLORS[cat] || '#888',
                      transition: 'width 0.3s ease',
                      minWidth: pct > 0 ? 2 : 0,
                    }}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
        {categories.map((cat) => (
          <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: CAT_COLORS[cat] || '#888' }} />
            <span style={{ color: t.textSecondary }}>{capitalize(cat)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function debtMonthsToPayoff(balance, minPayment, rate) {
  if (balance <= 0) return 0;
  if (minPayment <= 0) return Infinity;
  if (balance <= minPayment) return balance / minPayment;
  const monthlyRate = (rate || 0) / 100 / 12;
  if (monthlyRate <= 0) return balance / minPayment;
  const ratio = balance * monthlyRate / minPayment;
  if (ratio >= 1) return Infinity;
  return -Math.log(1 - ratio) / Math.log(1 + monthlyRate);
}

function debtPayoffLabel(months) {
  if (!isFinite(months)) return 'n/a';
  if (months < 0.1) return 'now';
  const days = months * 30.44;
  if (days < 30) return `${Math.round(days)}d`;
  return `~${Math.round(months)}mo`;
}

function DebtPayoffProjection({ debt, surplus, t }) {
  if (!debt || debt.length === 0) return null;

  const sorted = [...debt].sort((a, b) => a.balance - b.balance);
  const projections = [];
  let cumulativeMonths = 0;

  for (const entry of sorted) {
    if (entry.balance <= 0) continue;
    const minPay = entry.minPayment || 0;
    const months = debtMonthsToPayoff(entry.balance, minPay, entry.rate);
    cumulativeMonths += isFinite(months) ? months : 0;
    projections.push({ name: entry.name, balance: entry.balance, months, cumulativeMonths, totalPay: minPay });
  }

  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: t.textTertiary, marginBottom: 12 }}>
        Debt Payoff Projection
      </div>
      {projections.map((proj, index) => (
        <div key={proj.name || index} style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600 }}>
            <span>{proj.name}</span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(proj.balance)}</span>
          </div>
          <div style={{ fontSize: 11, color: t.textSecondary, marginTop: 2 }}>
            {debtPayoffLabel(proj.months)} at {formatCurrency(proj.totalPay)}/mo
          </div>
          <ProgressBar value={isFinite(proj.months) ? proj.months : 0} max={Math.max(...projections.map(p => isFinite(p.months) ? p.months : 0), 1)} color={t.green} t={t} />
        </div>
      ))}
      <div style={{ fontSize: 12, fontWeight: 600, color: t.green, marginTop: 8 }}>
        Debt-free in {debtPayoffLabel(cumulativeMonths)} total
      </div>
    </div>
  );
}

function SpendingChart({ spending, t, totalIncome, totalExpenses, activeScenarios = [] }) {
  const [activePoint, setActivePoint] = useState(null);

  if (!spending || spending.length === 0) return null;

  const actual = spending.map((entry) => ({
    ...entry,
    total: Math.max(0, Number.isFinite(entry?.total) ? entry.total : 0),
  }));
  const forecast = buildSpendingForecast(actual);
  const projected = forecast?.points || [];
  const maxProjected = projected.length > 0 ? Math.max(...projected.map((point) => point.high)) : 0;
  const maxTotal = Math.max(1, ...actual.map((point) => point.total), maxProjected);
  const W = 336;
  const H = 170;
  const padding = { left: 44, right: 40, top: 32, bottom: 44 };
  const chartW = W - padding.left - padding.right;
  const chartH = H - padding.top - padding.bottom;
  const chartBottom = padding.top + chartH;
  const totalPoints = actual.length + projected.length;

  const xForIndex = (index) => padding.left + (index / Math.max(1, totalPoints - 1)) * chartW;
  const yForValue = (value) => padding.top + (1 - Math.min(maxTotal, Math.max(0, value)) / maxTotal) * chartH;

  const actualPoints = actual.map((point, index) => ({
    ...point,
    kind: 'actual',
    index,
    x: xForIndex(index),
    y: yForValue(point.total),
  }));
  const forecastPoints = projected.map((point, index) => ({
    ...point,
    kind: 'forecast',
    index,
    x: xForIndex(actual.length + index),
    y: yForValue(point.median),
    lowY: yForValue(point.low),
    highY: yForValue(point.high),
  }));

  const actualPath = actualPoints.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  const actualArea = `${actualPath} L ${actualPoints[actualPoints.length - 1].x} ${chartBottom} L ${actualPoints[0].x} ${chartBottom} Z`;

  const forecastMedianPoints = actualPoints.length > 0 && forecastPoints.length > 0
    ? [{ x: actualPoints[actualPoints.length - 1].x, y: actualPoints[actualPoints.length - 1].y }, ...forecastPoints.map((point) => ({ x: point.x, y: point.y }))]
    : [];
  const forecastPath = forecastMedianPoints.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  const forecastBandPoints = forecastPoints.length > 0
    ? [
        ...forecastPoints.map((point) => `${point.x} ${point.highY}`),
        ...[...forecastPoints].reverse().map((point) => `${point.x} ${point.lowY}`),
      ]
    : [];
  const forecastBand = forecastBandPoints.length > 0 ? `M ${forecastBandPoints.join(' L ')} Z` : '';
  const showSavings = typeof totalIncome === 'number'
    && Number.isFinite(totalIncome)
    && totalIncome > 0
    && typeof totalExpenses === 'number'
    && Number.isFinite(totalExpenses);
  const savings = showSavings ? totalIncome - totalExpenses : 0;
  const savingsRate = showSavings ? ((savings / totalIncome) * 100).toFixed(1) : '0.0';
  const savingsPoints = showSavings
    ? actualPoints.map((point) => {
        const savingsValue = Math.max(0, totalIncome - point.total);
        return {
          x: point.x,
          y: yForValue(savingsValue),
        };
      })
    : [];
  const savingsPath = savingsPoints.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  const savingsArea = savingsPoints.length > 1
    ? `${savingsPath} L ${savingsPoints[savingsPoints.length - 1].x} ${chartBottom} L ${savingsPoints[0].x} ${chartBottom} Z`
    : '';

  const firstTotal = actual[0]?.total || 0;
  const lastTotal = actual[actual.length - 1]?.total || 0;
  const trendPct = actual.length >= 2 && firstTotal > 0 ? ((lastTotal - firstTotal) / firstTotal) * 100 : 0;
  const chartPoints = [...actualPoints, ...forecastPoints];
  const forecastStartIndex = actualPoints.length;
  const lastForecastIndex = forecastPoints.length > 0 ? totalPoints - 1 : -1;

  const shouldShowMonthLabel = () => true;

  const shouldShowValueLabel = (point, absoluteIndex, isActive) => {
    if (isActive) return true;
    if (point.kind === 'actual' && absoluteIndex === 0) return true;
    if (point.kind === 'actual' && absoluteIndex === actualPoints.length - 1) return true;
    if (point.kind === 'forecast' && absoluteIndex === lastForecastIndex) return true;
    return false;
  };

  return (
    <div>
      <svg
        width="100%"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        onClick={() => setActivePoint(null)}
      >
        <defs>
          <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={t.green} stopOpacity="0.26" />
            <stop offset="100%" stopColor={t.green} stopOpacity="0.03" />
          </linearGradient>
          <linearGradient id="savingsGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={t.cyan} stopOpacity="0.18" />
            <stop offset="100%" stopColor={t.cyan} stopOpacity="0.04" />
          </linearGradient>
          <linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={t.green} stopOpacity="0.12" />
            <stop offset="100%" stopColor={t.green} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((pct) => (
          <line
            key={pct}
            x1={padding.left}
            y1={padding.top + pct * chartH}
            x2={W - padding.right}
            y2={padding.top + pct * chartH}
            stroke={t.border}
            strokeWidth="0.5"
          />
        ))}
        <path d={actualArea} fill="url(#spendGrad)" />
        {forecastBand && <path d={forecastBand} fill="url(#forecastGrad)" />}
        {showSavings && savingsArea && <path d={savingsArea} fill="url(#savingsGrad)" />}
        {showSavings && savingsPath && (
          <path
            d={savingsPath}
            fill="none"
            stroke={t.cyan}
            strokeWidth="1.5"
            strokeOpacity="0.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        {activeScenarios.map((scenario) => {
          const scenarioIncome = scenario.multiplier
            ? (totalIncome || 0) * scenario.multiplier
            : (totalIncome || 0) + (scenario.delta || 0);
          if (scenarioIncome <= 0) return null;
          const lineY = yForValue(scenarioIncome);
          return (
            <g key={scenario.label}>
              <line
                x1={padding.left}
                y1={lineY}
                x2={W - padding.right}
                y2={lineY}
                stroke={scenario.color}
                strokeWidth="1.2"
                strokeDasharray="6 4"
                opacity="0.7"
              />
              <text
                x={W - padding.right + 2}
                y={lineY + 3}
                fill={scenario.color}
                fontSize="7"
                fontFamily="-apple-system, system-ui, sans-serif"
                fontWeight="600"
              >
                {scenario.label}
              </text>
            </g>
          );
        })}
        <path d={actualPath} fill="none" stroke={t.green} strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
        {forecastPath && (
          <path
            d={forecastPath}
            fill="none"
            stroke={t.green}
            strokeWidth="1.8"
            strokeDasharray="5 4"
            strokeOpacity="0.72"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        {chartPoints.map((point, index) => {
          const isFirst = index === 0;
          const isLast = index === chartPoints.length - 1;
          const isActive = activePoint?.kind === point.kind && activePoint?.index === point.index;
          const labelX = isFirst ? point.x + 8 : isLast ? point.x - 8 : point.x;
          const anchor = isFirst ? 'start' : isLast ? 'end' : 'middle';
          const labelY = Math.max(padding.top - 8, point.y - 10);
          const radius = isActive ? 6.4 : point.kind === 'forecast' ? 3.5 : 4;
          const showValueLabel = shouldShowValueLabel(point, index, isActive);
          const showMonthLabel = shouldShowMonthLabel(point, index);
          const valueText = compactCurrency(point.kind === 'forecast' ? point.median : point.total);

          return (
            <g key={`${point.kind}-${point.sortKey || point.month || index}`}>
              <circle
                cx={point.x}
                cy={point.y}
                r="14"
                fill="transparent"
                style={{ cursor: 'pointer' }}
                onMouseEnter={(event) => {
                  event.stopPropagation();
                  setActivePoint({ kind: point.kind, index: point.index });
                }}
                onClick={(event) => {
                  event.stopPropagation();
                  setActivePoint({ kind: point.kind, index: point.index });
                }}
              />
              <circle
                cx={point.x}
                cy={point.y}
                r={radius}
                fill={t.green}
                opacity={point.kind === 'forecast' ? 0.55 : 1}
                stroke={isActive ? t.text : 'none'}
                strokeWidth={isActive ? '1.2' : '0'}
                style={{ transition: 'r 160ms ease, opacity 160ms ease' }}
              />
              {showValueLabel && (
                <text
                  x={labelX}
                  y={labelY}
                  textAnchor={anchor}
                  fill={t.text}
                  fontSize="9"
                  fontWeight="700"
                  fontFamily="-apple-system, system-ui, sans-serif"
                  opacity={point.kind === 'forecast' ? 0.84 : 1}
                >
                  {valueText}
                </text>
              )}
              {showMonthLabel && (
                <text
                  x={labelX}
                  y={totalPoints > 6 ? (index % 2 === 0 ? H - 18 : H - 8) : H - 8}
                  textAnchor={anchor}
                  fill={t.textTertiary}
                  fontSize="8"
                  fontFamily="-apple-system, system-ui, sans-serif"
                  opacity={point.kind === 'forecast' ? 0.65 : 1}
                >
                  {monthLabelShort(point.month)}
                </text>
              )}
            </g>
          );
        })}
        <text x={padding.left - 4} y={padding.top + 4} textAnchor="end" fill={t.textTertiary} fontSize="8" fontFamily="-apple-system, system-ui, sans-serif">
          ${maxTotal.toLocaleString()}
        </text>
        <text x={padding.left - 4} y={padding.top + chartH + 4} textAnchor="end" fill={t.textTertiary} fontSize="8" fontFamily="-apple-system, system-ui, sans-serif">
          $0
        </text>
      </svg>
      <div style={{ fontSize: 11, color: trendPct <= 0 ? t.green : t.red, fontWeight: 600, marginTop: 4 }}>
        {Math.round(trendPct)}% {trendPct <= 0 ? 'reduction' : 'increase'} ({actual[0].month} to {actual[actual.length - 1].month})
      </div>
      {forecast && (
        <div style={{ fontSize: 11, color: t.textSecondary, marginTop: 6, lineHeight: 1.4 }}>
          Next month likely lands around {formatCurrency(forecast.summary.expectedNextMonth)}.
          <br />
          Likely range: {formatCurrency(forecast.summary.rangeLow)} to {formatCurrency(forecast.summary.rangeHigh)}.
        </div>
      )}
      {showSavings && (
        <div style={{ fontSize: 11, color: t.textSecondary, marginTop: 10, lineHeight: 1.4 }}>
          Monthly savings: {formatCurrency(savings)} ({savingsRate}% of income)
          {forecast && (
            <>
              <br />
              Projected savings next month: {formatCurrency(totalIncome - forecast.summary.expectedNextMonth)} (range: {formatCurrency(totalIncome - forecast.summary.rangeHigh)} to {formatCurrency(totalIncome - forecast.summary.rangeLow)})
            </>
          )}
        </div>
      )}
    </div>
  );
}

function EditorInput({ value, onChange, placeholder, width = '100%', type = 'text' }) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      style={{
        width,
        borderRadius: 10,
        border: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(255,255,255,0.04)',
        color: 'inherit',
        padding: '6px 8px',
        fontSize: 12,
      }}
    />
  );
}

function EditorSection({ title, children, t }) {
  return (
    <Card dark t={t} style={{ marginBottom: 16, padding: 16 }}>
      <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: t.textTertiary, marginBottom: 12 }}>
        {title}
      </div>
      {children}
    </Card>
  );
}

export default function FinancePanel({ dark, t, stocks, isAuthenticated }) {
  const [tab, setTab] = useState('portfolio');
  const [importError, setImportError] = useState(null);
  const [statementFiles, setStatementFiles] = useState([]);
  const [statementLoading, setStatementLoading] = useState(false);
  const [statementUploading, setStatementUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [isEditingPortfolio, setIsEditingPortfolio] = useState(false);
  const [portfolioDraft, setPortfolioDraft] = useState(null);
  const [activeScenarios, setActiveScenarios] = useState([]);
  const [selectedSpendingMonth, setSelectedSpendingMonth] = useState(null);
  const fileInputRef = useRef(null);
  const statementInputRef = useRef(null);

  const {
    holdings, accounts, budget, debt, goals, spending, giving,
    stocksValue, cashValue, totalDebt, totalIncome, totalExpenses,
    surplus, netWorth, isDemo, importData, syncSpendingMonths, exportData, saveData, resetToDemo,
  } = usePortfolio(stocks, isAuthenticated);

  const font = '-apple-system, BlinkMacSystemFont, system-ui, sans-serif';
  const sectionStyle = { padding: '16px 20px' };
  const labelStyle = { fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: t.textTertiary, marginBottom: 12 };
  const rowStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${t.border}` };
  const pillButtonStyle = {
    borderRadius: 999,
    border: `1px solid ${t.border}`,
    background: t.glass,
    color: t.text,
    padding: '6px 12px',
    fontSize: 11,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: font,
    boxShadow: 'none',
  };

  const pieData = [
    ...holdings.filter((holding) => holding.value > 0).map((holding) => ({ label: holding.symbol, value: holding.value })),
    ...accounts.filter((account) => account.balance > 0).map((account) => ({ label: account.name, value: account.balance })),
  ];

  const statementMonths = useMemo(
    () => normalizeSpendingMonths(statementFiles.map((item) => item?.spendingMonth)),
    [statementFiles]
  );
  const spendingChronological = useMemo(
    () => statementMonths.length > 0 ? statementMonths : normalizeSpendingMonths(spending),
    [statementMonths, spending]
  );
  const spendingRecentFirst = useMemo(() => [...spendingChronological].reverse(), [spendingChronological]);
  const statementFilesRecentFirst = [...statementFiles].sort((a, b) => String(b?.spendingMonth?.sortKey || '').localeCompare(String(a?.spendingMonth?.sortKey || '')));
  const syncedMonthCount = Math.max(statementFilesRecentFirst.length, spendingChronological.length);
  const shouldHideStatementsCard = syncedMonthCount >= 3;

  const handleImport = useCallback((event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImportError(null);
    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      try {
        const data = JSON.parse(loadEvent.target.result);
        const result = importData(data);
        if (!result.success) setImportError(result.error);
      } catch {
        setImportError('Invalid JSON file');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  }, [importData]);

  const handleExport = useCallback(() => {
    const data = exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'opticon-portfolio.json';
    anchor.click();
    URL.revokeObjectURL(url);
  }, [exportData]);

  const handleDrop = useCallback((event) => {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    if (!file || !file.name.endsWith('.json')) return;
    setImportError(null);
    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      try {
        const data = JSON.parse(loadEvent.target.result);
        const result = importData(data);
        if (!result.success) setImportError(result.error);
      } catch {
        setImportError('Invalid JSON file');
      }
    };
    reader.readAsText(file);
  }, [importData]);

  const refreshStatements = useCallback(async () => {
    setStatementLoading(true);
    try {
      const res = await fetch('/api/statements', { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const allStatements = Array.isArray(data?.statements) ? data.statements : [];
      const files = allStatements.filter((item) => item?.spendingMonth?.month);
      if (allStatements.length > 0 && files.length < allStatements.length) {
        console.warn(`[STATEMENTS] Dropped ${allStatements.length - files.length}/${allStatements.length} statements missing spendingMonth.month`);
      }
      setStatementFiles(files);
      const result = syncSpendingMonths(files.map((item) => item.spendingMonth));
      if (!result.success) setImportError(result.error);
    } catch (err) {
      setStatementFiles([]);
      if (err?.message?.includes('401')) {
        setImportError('Sign in to view saved statements');
      } else {
        setImportError('Could not load saved statements');
      }
    } finally {
      setStatementLoading(false);
    }
  }, [syncSpendingMonths]);

  useEffect(() => {
    if (tab !== 'spending') return;
    refreshStatements();
  }, [refreshStatements, tab]);

  const handleStatementUpload = useCallback(async (event) => {
    const files = Array.from(event.target.files || []).filter((file) => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'));
    event.target.value = '';
    if (files.length === 0) return;

    setImportError(null);
    setStatementUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setUploadProgress({ current: i + 1, total: files.length, filename: file.name });
        const contentBase64 = await fileToBase64(file);
        const response = await fetch('/api/statements?action=upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ filename: file.name, contentBase64 }),
        });
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data?.error || `Upload failed for ${file.name}`);
        }
      }
      await refreshStatements();
    } catch (err) {
      setImportError(err?.message || 'Upload failed');
    } finally {
      setStatementUploading(false);
      setUploadProgress(null);
    }
  }, [refreshStatements]);

  const startEditingPortfolio = useCallback(() => {
    setImportError(null);
    setPortfolioDraft(clonePortfolioData(exportData()));
    setIsEditingPortfolio(true);
  }, [exportData]);

  const cancelEditingPortfolio = useCallback(() => {
    setPortfolioDraft(null);
    setIsEditingPortfolio(false);
  }, []);

  const savePortfolioDraft = useCallback(() => {
    if (!portfolioDraft) return;
    const result = saveData(portfolioDraft);
    if (!result.success) {
      setImportError(result.error);
      return;
    }
    setImportError(null);
    setIsEditingPortfolio(false);
  }, [portfolioDraft, saveData]);

  const updateDraft = useCallback((section, updater) => {
    setPortfolioDraft((current) => {
      if (!current) return current;
      const next = clonePortfolioData(current);
      next[section] = updater(next[section] || []);
      return next;
    });
  }, []);

  const updateBudgetDraft = useCallback((key, updater) => {
    setPortfolioDraft((current) => {
      if (!current) return current;
      const next = clonePortfolioData(current);
      next.budget = next.budget || { income: [], expenses: [] };
      next.budget[key] = updater(next.budget[key] || []);
      return next;
    });
  }, []);

  const headerActions = [
    ...(tab === 'spending' && shouldHideStatementsCard
      ? [{ label: statementUploading ? 'Uploading…' : 'Upload PDFs', onClick: () => statementInputRef.current?.click() }]
      : []),
    { label: 'Export JSON', onClick: handleExport },
    { label: 'Import JSON', onClick: () => fileInputRef.current?.click() },
    ...(!isDemo ? [{ label: 'Reset to empty', onClick: resetToDemo, danger: true }] : []),
  ];

  const editableHoldings = portfolioDraft?.holdings || [];
  const editableAccounts = portfolioDraft?.accounts || [];
  const editableDebt = portfolioDraft?.debt || [];
  const editableGoals = portfolioDraft?.goals || [];
  const editableIncome = portfolioDraft?.budget?.income || [];
  const editableExpenses = portfolioDraft?.budget?.expenses || [];

  return (
    <div
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
      style={{ overflow: 'auto', height: '100%', fontFamily: font }}
    >
      <div style={{ padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${t.border}`, gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: t.text, letterSpacing: '-0.3px' }}>Portfolio</span>
          {isDemo && <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: t.glass, color: t.textTertiary, fontWeight: 600 }}>DEMO</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {tab === 'portfolio' && !isEditingPortfolio && (
            <button onClick={startEditingPortfolio} style={pillButtonStyle}>
              Edit
            </button>
          )}
          {tab === 'portfolio' && isEditingPortfolio && (
            <>
              <button onClick={cancelEditingPortfolio} style={{ ...pillButtonStyle, color: t.textSecondary }}>
                Cancel
              </button>
              <button onClick={savePortfolioDraft} style={{ ...pillButtonStyle, background: t.text, color: t.bg, borderColor: 'transparent' }}>
                Save
              </button>
            </>
          )}
          <ActionMenu t={t} font={font} actions={headerActions} />
        </div>
        <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} style={{ display: 'none' }} />
        <input ref={statementInputRef} type="file" accept="application/pdf,.pdf" multiple onChange={handleStatementUpload} style={{ display: 'none' }} />
      </div>

      <div style={{ padding: '16px 16px 12px' }}>
        <div style={{ fontSize: 11, color: t.textTertiary, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Net Worth</div>
        <div style={{ fontSize: 'clamp(28px, 6vw, 40px)', fontWeight: 700, color: netWorth >= 0 ? t.text : t.red, fontVariantNumeric: 'tabular-nums', letterSpacing: '-1.5px', lineHeight: 1 }}>
          {formatCurrency(netWorth)}
        </div>
        <div style={{ fontSize: 12, color: t.textSecondary, marginTop: 6, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <span>Stocks: {formatCurrency(stocksValue)}</span>
          <span>Cash: {formatCurrency(cashValue, 'CAD')}</span>
          <span style={{ color: t.red }}>Debt: -{formatCurrency(totalDebt)}</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 4, padding: '0 16px', marginBottom: 16, overflowX: 'auto' }}>
        {TABS.map((tabName) => (
          <button
            key={tabName}
            onClick={() => setTab(tabName)}
            style={{
              padding: '6px 14px',
              borderRadius: 100,
              border: 'none',
              fontSize: 12,
              fontWeight: 600,
              fontFamily: font,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              background: tab === tabName ? t.text : t.glass,
              color: tab === tabName ? t.bg : t.textSecondary,
              transition: 'all 0.15s ease',
            }}
          >
            {tabName.charAt(0).toUpperCase() + tabName.slice(1)}
          </button>
        ))}
      </div>

      <div style={{ padding: '0 16px 80px', maxWidth: 720, margin: '0 auto' }}>
        {tab === 'portfolio' && !isEditingPortfolio && (
          <>
            <Card dark={dark} t={t} style={{ marginBottom: 16, padding: 20 }}>
              <div style={labelStyle}>Holdings</div>
              <PieChart data={pieData} t={t} />
            </Card>

            <Card dark={dark} t={t} style={{ marginBottom: 16 }}>
              <div style={sectionStyle}>
                <div style={labelStyle}>Stocks</div>
                {holdings.map((holding) => (
                  <div key={holding.symbol} style={rowStyle}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{holding.symbol}</div>
                      <div style={{ fontSize: 11, color: t.textTertiary }}>{holding.shares.toFixed(4)} shares @ {formatCurrency(holding.costBasis)}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 600, fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(holding.value)}</div>
                      <div style={{ fontSize: 11, color: holding.gain >= 0 ? t.green : t.red, fontVariantNumeric: 'tabular-nums' }}>
                        {holding.gain >= 0 ? '+' : ''}{formatCurrency(holding.gain)} ({holding.gainPercent >= 0 ? '+' : ''}{holding.gainPercent.toFixed(1)}%)
                      </div>
                    </div>
                  </div>
                ))}
                <div style={{ ...rowStyle, borderBottom: 'none', fontWeight: 700, fontSize: 16 }}>
                  <span>Total</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(stocksValue)}</span>
                </div>
              </div>
            </Card>

            <Card dark={dark} t={t} style={{ marginBottom: 16 }}>
              <div style={sectionStyle}>
                <div style={labelStyle}>Cash Accounts</div>
                {accounts.map((account, index) => (
                  <div key={`${account.name}-${index}`} style={rowStyle}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{account.name}</div>
                      <div style={{ fontSize: 11, color: t.textTertiary }}>{account.type}</div>
                    </div>
                    <div style={{ fontWeight: 600, fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>
                      {formatCurrency(account.balance, account.currency)}
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card dark={dark} t={t} style={{ marginBottom: 16 }}>
              <div style={sectionStyle}>
                <div style={labelStyle}>Goals</div>
                {goals.map((goal, index) => {
                  const pct = goal.target > 0 ? (goal.saved / goal.target) * 100 : 0;
                  const priorityColor = goal.priority === 'high' ? t.red : goal.priority === 'medium' ? t.orange : t.green;
                  return (
                    <div key={`${goal.name}-${index}`} style={{ marginBottom: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 3, height: 20, borderRadius: 2, background: priorityColor }} />
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 14 }}>{goal.name}</div>
                            {goal.note && <div style={{ fontSize: 11, color: t.textTertiary }}>{goal.note}</div>}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 600, fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(goal.target)}</div>
                          {goal.deadline && <div style={{ fontSize: 10, color: t.textTertiary }}>{goal.deadline}</div>}
                        </div>
                      </div>
                      <ProgressBar value={goal.saved} max={goal.target} color={priorityColor} t={t} />
                      <div style={{ fontSize: 10, color: t.textTertiary, marginTop: 2 }}>{pct.toFixed(0)}% saved</div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </>
        )}

        {tab === 'portfolio' && isEditingPortfolio && portfolioDraft && (
          <>
            <EditorSection title="Stocks" t={t}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {editableHoldings.map((holding, index) => (
                  <div key={`${holding.symbol}-${index}`} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr auto auto', gap: 6 }}>
                    <EditorInput value={holding.symbol || ''} onChange={(event) => updateDraft('holdings', (list) => list.map((item, idx) => idx === index ? { ...item, symbol: event.target.value.toUpperCase() } : item))} placeholder="Symbol" />
                    <EditorInput type="number" value={holding.shares ?? 0} onChange={(event) => updateDraft('holdings', (list) => list.map((item, idx) => idx === index ? { ...item, shares: parseNumberInput(event.target.value) } : item))} placeholder="Shares" />
                    <EditorInput type="number" value={holding.costBasis ?? 0} onChange={(event) => updateDraft('holdings', (list) => list.map((item, idx) => idx === index ? { ...item, costBasis: parseNumberInput(event.target.value) } : item))} placeholder="Cost basis" />
                    <button onClick={() => updateDraft('holdings', (list) => list.map((item, idx) => idx === index ? { ...item, shares: 0 } : item))} style={{ ...pillButtonStyle, color: t.orange || t.textSecondary }}>Sell</button>
                    <button onClick={() => updateDraft('holdings', (list) => list.filter((_, idx) => idx !== index))} style={{ ...pillButtonStyle, color: t.red }}>Remove</button>
                  </div>
                ))}
                <button onClick={() => updateDraft('holdings', (list) => [...list, { symbol: '', shares: 0, costBasis: 0 }])} style={pillButtonStyle}>Add stock</button>
              </div>
            </EditorSection>

            <EditorSection title="Cash Accounts" t={t}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {editableAccounts.map((account, index) => (
                  <div key={`${account.name}-${index}`} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 0.8fr 1fr auto', gap: 6 }}>
                    <EditorInput value={account.name || ''} onChange={(event) => updateDraft('accounts', (list) => list.map((item, idx) => idx === index ? { ...item, name: event.target.value } : item))} placeholder="Account name" />
                    <EditorInput value={account.type || ''} onChange={(event) => updateDraft('accounts', (list) => list.map((item, idx) => idx === index ? { ...item, type: event.target.value } : item))} placeholder="Type" />
                    <EditorInput value={account.currency || 'CAD'} onChange={(event) => updateDraft('accounts', (list) => list.map((item, idx) => idx === index ? { ...item, currency: event.target.value.toUpperCase() } : item))} placeholder="CAD" />
                    <EditorInput type="number" value={account.balance ?? 0} onChange={(event) => updateDraft('accounts', (list) => list.map((item, idx) => idx === index ? { ...item, balance: parseNumberInput(event.target.value) } : item))} placeholder="0.00" />
                    <button onClick={() => updateDraft('accounts', (list) => list.filter((_, idx) => idx !== index))} style={{ ...pillButtonStyle, color: t.red }}>Remove</button>
                  </div>
                ))}
                <button onClick={() => updateDraft('accounts', (list) => [...list, { name: 'Vacation', type: 'chequing', currency: 'CAD', balance: 0 }])} style={pillButtonStyle}>Add account</button>
              </div>
            </EditorSection>

            <EditorSection title="Debt" t={t}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {editableDebt.map((entry, index) => (
                  <div key={`${entry.name}-${index}`} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1.4fr auto', gap: 6 }}>
                    <EditorInput value={entry.name || ''} onChange={(event) => updateDraft('debt', (list) => list.map((item, idx) => idx === index ? { ...item, name: event.target.value } : item))} placeholder="Debt name" />
                    <EditorInput type="number" value={entry.balance ?? 0} onChange={(event) => updateDraft('debt', (list) => list.map((item, idx) => idx === index ? { ...item, balance: parseNumberInput(event.target.value) } : item))} placeholder="Balance" />
                    <EditorInput value={entry.note || ''} onChange={(event) => updateDraft('debt', (list) => list.map((item, idx) => idx === index ? { ...item, note: event.target.value } : item))} placeholder="Note" />
                    <button onClick={() => updateDraft('debt', (list) => list.filter((_, idx) => idx !== index))} style={{ ...pillButtonStyle, color: t.red }}>Remove</button>
                  </div>
                ))}
                <button onClick={() => updateDraft('debt', (list) => [...list, { name: '', balance: 0, note: '' }])} style={pillButtonStyle}>Add debt</button>
              </div>
            </EditorSection>

            <EditorSection title="Goals" t={t}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {editableGoals.map((goal, index) => (
                  <div key={`${goal.name}-${index}`} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1fr auto', gap: 6 }}>
                    <EditorInput value={goal.name || ''} onChange={(event) => updateDraft('goals', (list) => list.map((item, idx) => idx === index ? { ...item, name: event.target.value } : item))} placeholder="Goal" />
                    <EditorInput type="number" value={goal.target ?? 0} onChange={(event) => updateDraft('goals', (list) => list.map((item, idx) => idx === index ? { ...item, target: parseNumberInput(event.target.value) } : item))} placeholder="Target" />
                    <EditorInput type="number" value={goal.saved ?? 0} onChange={(event) => updateDraft('goals', (list) => list.map((item, idx) => idx === index ? { ...item, saved: parseNumberInput(event.target.value) } : item))} placeholder="Saved" />
                    <EditorInput value={goal.deadline || ''} onChange={(event) => updateDraft('goals', (list) => list.map((item, idx) => idx === index ? { ...item, deadline: event.target.value } : item))} placeholder="Deadline" />
                    <button onClick={() => updateDraft('goals', (list) => list.filter((_, idx) => idx !== index))} style={{ ...pillButtonStyle, color: t.red }}>Remove</button>
                  </div>
                ))}
                <button onClick={() => updateDraft('goals', (list) => [...list, { name: '', target: 0, saved: 0, deadline: '', priority: 'medium' }])} style={pillButtonStyle}>Add goal</button>
              </div>
            </EditorSection>

            <EditorSection title="Budget" t={t}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 11, color: t.textSecondary, marginBottom: 8 }}>Income</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {editableIncome.map((item, index) => (
                      <div key={`${item.name}-${index}`} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr auto', gap: 6 }}>
                        <EditorInput value={item.name || ''} onChange={(event) => updateBudgetDraft('income', (list) => list.map((entry, idx) => idx === index ? { ...entry, name: event.target.value } : entry))} placeholder="Income source" />
                        <EditorInput type="number" value={item.amount ?? 0} onChange={(event) => updateBudgetDraft('income', (list) => list.map((entry, idx) => idx === index ? { ...entry, amount: parseNumberInput(event.target.value) } : entry))} placeholder="Amount" />
                        <button onClick={() => updateBudgetDraft('income', (list) => list.filter((_, idx) => idx !== index))} style={{ ...pillButtonStyle, color: t.red }}>Remove</button>
                      </div>
                    ))}
                    <button onClick={() => updateBudgetDraft('income', (list) => [...list, { name: '', amount: 0 }])} style={pillButtonStyle}>Add income</button>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: t.textSecondary, marginBottom: 8 }}>Expenses</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {editableExpenses.map((item, index) => (
                      <div key={`${item.name}-${index}`} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr auto', gap: 6 }}>
                        <EditorInput value={item.name || ''} onChange={(event) => updateBudgetDraft('expenses', (list) => list.map((entry, idx) => idx === index ? { ...entry, name: event.target.value } : entry))} placeholder="Expense" />
                        <EditorInput type="number" value={item.amount ?? 0} onChange={(event) => updateBudgetDraft('expenses', (list) => list.map((entry, idx) => idx === index ? { ...entry, amount: parseNumberInput(event.target.value) } : entry))} placeholder="Amount" />
                        <button onClick={() => updateBudgetDraft('expenses', (list) => list.filter((_, idx) => idx !== index))} style={{ ...pillButtonStyle, color: t.red }}>Remove</button>
                      </div>
                    ))}
                    <button onClick={() => updateBudgetDraft('expenses', (list) => [...list, { name: '', amount: 0 }])} style={pillButtonStyle}>Add expense</button>
                  </div>
                </div>
              </div>
            </EditorSection>
          </>
        )}

        {tab === 'budget' && (
          <>
            <Card dark={dark} t={t} style={{ marginBottom: 16 }}>
              <div style={sectionStyle}>
                <div style={labelStyle}>Monthly Income</div>
                {budget.income.map((item, index) => (
                  <div key={`${item.name}-${index}`} style={rowStyle}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{item.name}</div>
                      {item.note && <div style={{ fontSize: 11, color: t.textTertiary }}>{item.note}</div>}
                    </div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: t.green, fontVariantNumeric: 'tabular-nums' }}>+{formatCurrency(item.amount)}</div>
                  </div>
                ))}
              </div>
            </Card>
            <Card dark={dark} t={t} style={{ marginBottom: 16 }}>
              <div style={sectionStyle}>
                <div style={labelStyle}>Monthly Expenses</div>
                {budget.expenses.map((item, index) => (
                  <div key={`${item.name}-${index}`} style={rowStyle}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{item.name}</div>
                      {item.note && <div style={{ fontSize: 11, color: t.textTertiary }}>{item.note}</div>}
                    </div>
                    <div style={{ fontWeight: 600, fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>-{formatCurrency(item.amount)}</div>
                  </div>
                ))}
                <div style={{ ...rowStyle, borderBottom: 'none', fontWeight: 700, fontSize: 16 }}>
                  <span>Surplus</span>
                  <span style={{ color: surplus >= 0 ? t.green : t.red, fontVariantNumeric: 'tabular-nums' }}>
                    {surplus >= 0 ? '+' : ''}{formatCurrency(surplus)}
                  </span>
                </div>
              </div>
            </Card>
            {giving.length > 0 && (
              <Card dark={dark} t={t} style={{ marginBottom: 16 }}>
                <div style={sectionStyle}>
                  <div style={labelStyle}>Giving</div>
                  {giving.map((entry, index) => (
                    <div key={`${entry.name}-${index}`} style={rowStyle}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14, opacity: entry.active ? 1 : 0.5 }}>{entry.name}</div>
                        {entry.note && <div style={{ fontSize: 11, color: t.textTertiary }}>{entry.note}</div>}
                      </div>
                      <div style={{ fontWeight: 600, fontSize: 14, fontVariantNumeric: 'tabular-nums', opacity: entry.active ? 1 : 0.5 }}>
                        {formatCurrency(entry.amount)}/mo
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
            <Card dark={dark} t={t} style={{ marginBottom: 16 }}>
              <div style={sectionStyle}>
                <div style={labelStyle}>Outstanding Debt</div>
                {debt.map((entry, index) => (
                  <div key={`${entry.name}-${index}`} style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{entry.name}</div>
                        {entry.note && <div style={{ fontSize: 11, color: t.textTertiary }}>{entry.note}</div>}
                      </div>
                      <div style={{ fontWeight: 600, fontSize: 14, color: t.red, fontVariantNumeric: 'tabular-nums' }}>
                        {formatCurrency(entry.balance)}
                      </div>
                    </div>
                    <ProgressBar value={0} max={entry.balance} color={t.red} t={t} />
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16, paddingTop: 12, borderTop: `1px solid ${t.border}`, fontWeight: 700, fontSize: 16 }}>
                  <span>Total Debt</span>
                  <span style={{ color: t.red, fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(totalDebt)}</span>
                </div>
              </div>
            </Card>
            {debt.length > 0 && (
              <>
                <Card dark={dark} t={t} style={{ marginBottom: 16, padding: 20 }}>
                  <DebtPayoffProjection debt={debt} surplus={surplus} t={t} />
                </Card>
              </>
            )}
          </>
        )}

        {tab === 'spending' && (
          <>
            {importError && (
              <div style={{ marginBottom: 12, padding: '8px 12px', background: 'rgba(255,69,58,0.15)', borderRadius: 8, fontSize: 11, color: t.red }}>
                {importError}
              </div>
            )}
            {!shouldHideStatementsCard && (
              <Card dark={dark} t={t} style={{ marginBottom: 16, padding: 20 }}>
                <div style={labelStyle}>Saved Statements</div>
                <div style={{ fontSize: 12, color: t.textSecondary, marginBottom: 12 }}>
                  Upload PDF statements once. Opticon keeps the spending months in sync on this account.
                </div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  <button onClick={() => statementInputRef.current?.click()} disabled={statementUploading} style={pillButtonStyle}>
                    {statementUploading && uploadProgress
                      ? `Uploading ${uploadProgress.current}/${uploadProgress.total}: ${uploadProgress.filename}`
                      : statementUploading ? 'Uploading…' : 'Upload PDFs'}
                  </button>
                </div>
                {statementLoading ? (
                  <div style={{ fontSize: 12, color: t.textTertiary }}>Loading saved statements…</div>
                ) : statementFiles.length === 0 ? (
                  <div style={{ fontSize: 12, color: t.textTertiary }}>No statements saved to this account yet.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ fontSize: 12, color: t.green }}>
                      Saved {statementFiles.length} statement{statementFiles.length === 1 ? '' : 's'} to this account.
                    </div>
                    {statementFilesRecentFirst.map((statement) => (
                      <div key={statement.filename} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 12, background: t.glass, border: `1px solid ${t.border}` }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{statement.spendingMonth.month}</div>
                          <div style={{ fontSize: 11, color: t.textTertiary }}>
                            {statement.filename} · {formatCurrency(statement.spendingMonth.total, 'CAD')}
                          </div>
                        </div>
                        <div style={{ fontSize: 11, color: t.textTertiary }}>In account</div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )}

            <Card dark={dark} t={t} style={{ marginBottom: 16, padding: 20 }}>
              <div style={labelStyle}>Income Scenarios</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
                {INCOME_SCENARIOS.map((scenario) => {
                  const isActive = activeScenarios.some((s) => s.label === scenario.label);
                  return (
                    <button
                      key={scenario.label}
                      onClick={() => setActiveScenarios((prev) =>
                        isActive ? prev.filter((s) => s.label !== scenario.label) : [...prev, scenario]
                      )}
                      style={{
                        ...pillButtonStyle,
                        background: isActive ? scenario.color : t.glass,
                        color: isActive ? '#000' : t.textSecondary,
                        borderColor: isActive ? scenario.color : t.border,
                      }}
                    >
                      {scenario.label}
                    </button>
                  );
                })}
              </div>
              <div style={labelStyle}>Spending Trends</div>
              <SpendingChart spending={spendingChronological} t={t} totalIncome={totalIncome} totalExpenses={totalExpenses} activeScenarios={activeScenarios} />
            </Card>

            <Card dark={dark} t={t} style={{ marginBottom: 16, padding: 20 }}>
              <div style={labelStyle}>Category Breakdown</div>
              <StackedBarChart spending={spendingChronological} t={t} />
            </Card>

            <Card dark={dark} t={t} style={{ marginBottom: 16 }}>
              <div style={sectionStyle}>
                <div style={labelStyle}>Monthly Breakdown</div>
                {spendingRecentFirst.map((entry, index) => {
                  const isExpanded = selectedSpendingMonth === entry.month;
                  const sortedCats = Object.entries(entry.categories).sort((a, b) => b[1] - a[1]);
                  return (
                    <div key={`${entry.month}-${index}`} style={{ marginBottom: 16 }}>
                      <div
                        onClick={() => setSelectedSpendingMonth(isExpanded ? null : entry.month)}
                        style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, marginBottom: 6, cursor: 'pointer', userSelect: 'none' }}
                      >
                        <span>{isExpanded ? '- ' : '+ '}{entry.month}</span>
                        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(entry.total)}</span>
                      </div>
                      {isExpanded && sortedCats.map(([category, amount]) => (
                        <div key={category} style={{ marginBottom: 6 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: t.textSecondary, marginBottom: 2 }}>
                            <span>{capitalize(category)}</span>
                            <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                              {formatCurrency(amount)} ({entry.total > 0 ? Math.round(amount / entry.total * 100) : 0}%)
                            </span>
                          </div>
                          <ProgressBar value={amount} max={entry.total} color={CAT_COLORS[category] || '#888'} t={t} />
                        </div>
                      ))}
                      {!isExpanded && sortedCats.slice(0, 3).map(([category, amount]) => (
                        <div key={category} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: t.textSecondary, padding: '2px 0' }}>
                          <span>{capitalize(category)}</span>
                          <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                            {formatCurrency(amount)} ({entry.total > 0 ? Math.round(amount / entry.total * 100) : 0}%)
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </Card>
          </>
        )}

        {tab === 'dashboard' && (
          <FinanceDashboard
            dark={dark}
            t={t}
            spending={spendingChronological}
            totalIncome={totalIncome}
            debt={debt}
          />
        )}
      </div>
    </div>
  );
}
