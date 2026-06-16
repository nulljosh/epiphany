import { useMemo } from 'react';
import { useMacro } from '../hooks/useMacro';

const mono = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function formatAsOf(date) {
  if (!date) return 'as of n/a';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return `as of ${date}`;
  return `as of ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

function formatPercent(value) {
  const num = toNumber(value);
  if (num === null) return 'n/a';
  return `${num.toFixed(2)}%`;
}

function formatIndex(value) {
  const num = toNumber(value);
  if (num === null) return 'n/a';
  return num.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function formatTrillions(value) {
  const num = toNumber(value);
  if (num === null) return 'n/a';
  // FRED FYFSD is reported in millions of dollars, so millions / 1e6 = trillions.
  const trillions = num / 1e6;
  const abs = Math.abs(trillions).toFixed(2);
  return `${trillions < 0 ? '-' : ''}$${abs}T`;
}

function formatValue(ind) {
  if (!ind) return 'n/a';
  const v = toNumber(ind.value);
  if (v === null) return 'n/a';
  switch (ind.unit) {
    case '%': return `${v.toFixed(2)}%`;
    case 'K': return `${Math.round(v >= 10000 ? v / 1000 : v).toLocaleString('en-US')}K`;
    case 'B USD': return `$${Math.round(v >= 10000 ? v / 1000 : v).toLocaleString('en-US')}B`;
    case 'index': return v.toLocaleString('en-US', { maximumFractionDigits: 1 });
    default: return v.toLocaleString('en-US', { maximumFractionDigits: 2 });
  }
}

function Sparkline({ series, color = '#5eead4', width = 132, height = 30 }) {
  const pts = (series || []).map(p => toNumber(p.value)).filter(v => v !== null);
  if (pts.length < 2) return null;
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const span = max - min || 1;
  const points = pts
    .map((v, i) => `${((i / (pts.length - 1)) * width).toFixed(1)},${(height - ((v - min) / span) * height).toFixed(1)}`)
    .join(' ');
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block', marginTop: 6 }}>
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function MetricCard({ ind }) {
  const change = toNumber(ind?.change);
  const up = change !== null && change > 0;
  const flat = change === null || change === 0;
  return (
    <div style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 10, background: 'rgba(255,255,255,0.03)' }}>
      <div style={{ fontSize: 11, textTransform: 'uppercase', color: '#9aa4b7' }}>{ind?.name || '—'}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 6 }}>
        <span style={{ fontSize: 22, lineHeight: 1.1, fontFamily: mono }}>{formatValue(ind)}</span>
        {!flat && (
          <span style={{ fontSize: 11, fontFamily: mono, color: '#9aa4b7' }}>
            {up ? '▲' : '▼'} {Math.abs(change).toLocaleString('en-US', { maximumFractionDigits: 2 })}
          </span>
        )}
      </div>
      <Sparkline series={ind?.series} color={flat ? '#64748b' : up ? '#34d399' : '#f87171'} />
      <div style={{ fontSize: 10, color: '#9aa4b7', marginTop: 4 }}>{formatAsOf(ind?.date)}</div>
    </div>
  );
}

function skeletonLine(width = '100%') {
  return (
    <div
      style={{
        width,
        height: 12,
        borderRadius: 6,
        background: 'rgba(255,255,255,0.1)',
        animation: 'macroShimmer 1.5s infinite',
      }}
    />
  );
}

export default function MacroPanel() {
  const { macro, loading, error } = useMacro();

  const yields = useMemo(() => {
    if (!macro) return [];
    return [
      { label: '2Y', key: 'treasury2y', value: toNumber(macro.treasury2y?.value), date: macro.treasury2y?.date },
      { label: '10Y', key: 'treasury10y', value: toNumber(macro.treasury10y?.value), date: macro.treasury10y?.date },
      { label: '30Y', key: 'treasury30y', value: toNumber(macro.treasury30y?.value), date: macro.treasury30y?.date },
    ];
  }, [macro]);

  const maxYield = useMemo(() => {
    const nums = yields.map(y => y.value).filter(v => v !== null);
    return nums.length ? Math.max(...nums) : 1;
  }, [yields]);

  const gdpValue = toNumber(macro?.gdp?.value);
  const gdpPositive = gdpValue !== null && gdpValue >= 0;

  return (
    <div
      style={{
        position: 'relative',
        borderRadius: 16,
        border: '1px solid rgba(255,255,255,0.12)',
        background: 'rgba(10,14,22,0.88)',
        backdropFilter: 'blur(24px) saturate(160%)',
        WebkitBackdropFilter: 'blur(24px) saturate(160%)',
        padding: 14,
        color: '#e6ebf5',
        fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <style>
        {`@keyframes macroShimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}
      </style>
      <div style={{ fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#9aa4b7', marginBottom: 10 }}>
        Macroeconomic Snapshot
      </div>

      {loading && (
        <div style={{ display: 'grid', gap: 10 }}>
          {skeletonLine('50%')}
          {skeletonLine('100%')}
          {skeletonLine('100%')}
          {skeletonLine('78%')}
          {skeletonLine('66%')}
          {skeletonLine('90%')}
        </div>
      )}

      {!loading && error && (
        <div style={{ fontSize: 13, color: '#fda4af' }}>Macro data unavailable</div>
      )}

      {!loading && !error && macro && (
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 10, background: 'rgba(255,255,255,0.03)' }}>
            <div style={{ fontSize: 11, textTransform: 'uppercase', color: '#9aa4b7', marginBottom: 8 }}>Treasury Yield Curve</div>
            {yields.map(y => (
              <div key={y.key} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span>{y.label}</span>
                  <span style={{ fontFamily: mono }}>{formatPercent(y.value)}</span>
                </div>
                <div style={{ height: 8, borderRadius: 8, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${Math.max(8, ((y.value ?? 0) / maxYield) * 100)}%`,
                      background: '#5eead4',
                    }}
                  />
                </div>
                <div style={{ fontSize: 10, color: '#9aa4b7', marginTop: 3 }}>{formatAsOf(y.date)}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 10, background: 'rgba(255,255,255,0.03)' }}>
              <div style={{ fontSize: 11, textTransform: 'uppercase', color: '#9aa4b7' }}>Fed Funds Rate</div>
              <div style={{ fontSize: 30, lineHeight: 1.05, marginTop: 6, fontFamily: mono }}>{formatPercent(macro.fedFunds?.value)}</div>
              <div style={{ fontSize: 10, color: '#9aa4b7', marginTop: 6 }}>{formatAsOf(macro.fedFunds?.date)}</div>
            </div>
            <div style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 10, background: 'rgba(255,255,255,0.03)' }}>
              <div style={{ fontSize: 11, textTransform: 'uppercase', color: '#9aa4b7' }}>Inflation</div>
              <div style={{ fontSize: 24, lineHeight: 1.1, marginTop: 8, fontFamily: mono }}>{formatIndex(macro.cpi?.value)}</div>
              <div style={{ fontSize: 10, color: '#9aa4b7', marginTop: 8 }}>{formatAsOf(macro.cpi?.date)}</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 10, background: 'rgba(255,255,255,0.03)' }}>
              <div style={{ fontSize: 11, textTransform: 'uppercase', color: '#9aa4b7' }}>GDP Growth</div>
              <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: gdpPositive ? '#34d399' : '#f87171', fontSize: 16 }}>{gdpPositive ? '↑' : '↓'}</span>
                <span style={{ fontSize: 24, lineHeight: 1.1, fontFamily: mono, color: gdpPositive ? '#34d399' : '#f87171' }}>
                  {formatPercent(macro.gdp?.value)}
                </span>
              </div>
              <div style={{ fontSize: 10, color: '#9aa4b7', marginTop: 8 }}>{formatAsOf(macro.gdp?.date)}</div>
            </div>

            <div style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 10, background: 'rgba(255,255,255,0.03)' }}>
              <div style={{ fontSize: 11, textTransform: 'uppercase', color: '#9aa4b7' }}>Federal Deficit</div>
              <div style={{ fontSize: 24, lineHeight: 1.1, marginTop: 8, fontFamily: mono }}>{formatTrillions(macro.deficit?.value)}</div>
              <div style={{ fontSize: 10, color: '#9aa4b7', marginTop: 8 }}>{formatAsOf(macro.deficit?.date)}</div>
            </div>
          </div>

          <div style={{ fontSize: 11, textTransform: 'uppercase', color: '#9aa4b7', marginTop: 2 }}>Labor &amp; Consumer</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {['unemployment', 'joblessClaims', 'consumerConf', 'pce', 'retailSales']
              .map(key => macro[key])
              .filter(Boolean)
              .map(ind => <MetricCard key={ind.id} ind={ind} />)}
          </div>
        </div>
      )}
    </div>
  );
}
