import { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, AreaChart, Area, CartesianGrid, ReferenceLine, ReferenceDot,
} from 'recharts';
import { compactCurrency, formatCurrency, SYSTEM_FONT } from '../utils/formatting';
import { simulate } from '../utils/roadmapSim';

const CAT_COLORS = { Food: '#0a84ff', Vape: '#bf5af2', Alcohol: '#ff9f0a', Other: '#30d158' };
const CATS = ['Food', 'Vape', 'Alcohol', 'Other'];

// Real spending only. `months` comes from parsed PDF statements
// (server/api/statements-shared.js). The 4th bucket is the monthly total minus
// the three named categories, so nothing is silently dropped. No mock fallback.
function buildHistoryData(months) {
  return [...months]
    .filter((m) => m?.sortKey)
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
    .map((m) => {
      const c = m.categories || {};
      const label = m.month.slice(0, 3) + " '" + m.month.slice(-2);
      const food = Math.round(c.food || 0);
      const vape = Math.round((c.vape || 0) + (c.vaping || 0) + (c.cannabis || 0));
      const alcohol = Math.round(c.alcohol || 0);
      const other = Math.max(0, Math.round((m.total || 0) - food - vape - alcohol));
      return { month: label, Food: food, Vape: vape, Alcohol: alcohol, Other: other };
    });
}

function averageByCategory(history) {
  if (!history.length) return Object.fromEntries(CATS.map((cat) => [cat, 0]));
  const sums = Object.fromEntries(CATS.map((cat) => [cat, 0]));
  for (const row of history) for (const cat of CATS) sums[cat] += row[cat] || 0;
  return Object.fromEntries(CATS.map((cat) => [cat, Math.round(sums[cat] / history.length)]));
}

const MAY_START = new Date(2026, 4, 1);
const MAY_DAYS = 31;
const DAY_MS = 1000 * 60 * 60 * 24;

// Paces the current month against the historical average from real statements.
function getMayProgress(avg) {
  const monthlyTotal = CATS.reduce((sum, cat) => sum + (avg[cat] || 0), 0);
  const now = new Date();
  const elapsed = Math.max(0, (now - MAY_START) / DAY_MS);
  const day = Math.min(elapsed, MAY_DAYS);
  const ratio = day / MAY_DAYS;
  const total = Math.round(monthlyTotal * ratio);
  return { day: Math.floor(day), total, projected: monthlyTotal, ratio };
}

const VIEWS = ['netWorth', 'accounts', 'milestones'];
const VIEW_LABELS = { netWorth: 'Net Worth', accounts: 'Accounts', milestones: 'Milestones' };

function fmt(v) {
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(0)}k`;
  return `$${v}`;
}

const yTick = (v) => fmt(v);

function CustomTooltip({ active, payload, label, t }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: t.bg, border: `1px solid ${t.border}`, borderRadius: 10,
      padding: '8px 12px', fontSize: 11, fontFamily: SYSTEM_FONT,
    }}>
      <div style={{ fontWeight: 700, marginBottom: 4, color: t.text }}>{label}</div>
      {payload.map((entry) => (
        <div key={entry.dataKey} style={{ color: entry.color, display: 'flex', justifyContent: 'space-between', gap: 16 }}>
          <span>{entry.name}</span>
          <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: t.text }}>
            {formatCurrency(Math.abs(entry.value))}
          </span>
        </div>
      ))}
    </div>
  );
}

function SpendingTooltip({ active, payload, label, t }) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s, e) => s + (e.value || 0), 0);
  return (
    <div style={{
      background: t.bg, border: `1px solid ${t.border}`, borderRadius: 10,
      padding: '8px 12px', fontSize: 11, fontFamily: SYSTEM_FONT,
    }}>
      <div style={{ fontWeight: 700, marginBottom: 4, color: t.text }}>{label}</div>
      {payload.map((entry) => (
        <div key={entry.dataKey} style={{ color: entry.fill, display: 'flex', justifyContent: 'space-between', gap: 16 }}>
          <span>{entry.name}</span>
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>${entry.value}</span>
        </div>
      ))}
      <div style={{ borderTop: `1px solid ${t.border}`, marginTop: 4, paddingTop: 4, fontWeight: 700, color: t.text, display: 'flex', justifyContent: 'space-between', gap: 16 }}>
        <span>Total</span><span>${total}</span>
      </div>
    </div>
  );
}

function StatCard({ t, label, value, sub }) {
  return (
    <div style={{ background: t.glass, border: `1px solid ${t.border}`, borderRadius: 12, padding: 12 }}>
      <div style={{ fontSize: 10, color: t.textTertiary, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: t.text, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.5px' }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: t.textTertiary, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function ParamSlider({ t, label, value, min, max, step, onChange, format }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: t.textSecondary }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: t.text, fontVariantNumeric: 'tabular-nums' }}>
          {format ? format(value) : value}
        </span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ width: '100%', accentColor: t.accent }}
      />
    </div>
  );
}

const TARGET_MONTHLY = 400;

export default function EpiphanyFinance({ t, spending }) {
  const historyData = useMemo(
    () => (spending?.length ? buildHistoryData(spending) : []),
    [spending],
  );
  const hasSpending = historyData.length > 0;
  const monthlyAvg = useMemo(() => averageByCategory(historyData), [historyData]);

  const [view, setView] = useState('netWorth');
  const [monthlyExpenses, setMonthlyExpenses] = useState(650);
  const [annualReturn, setAnnualReturn] = useState(0.10);
  const [sweStartSalary, setSweStartSalary] = useState(75000);
  const [sweStartYear, setSweStartYear] = useState(2030);
  const [startDebt, setStartDebt] = useState(10000);

  const may = useMemo(() => getMayProgress(monthlyAvg), [monthlyAvg]);
  const rangeLabel = hasSpending
    ? `${historyData[0].month} – ${historyData[historyData.length - 1].month} · ${historyData.length} ${historyData.length === 1 ? 'month' : 'months'}`
    : 'No statements imported yet';

  const sim = useMemo(
    () => simulate({ monthlyExpenses, annualReturn, sweStartSalary, sweStartYear, startDebt, horizonYears: 17 }),
    [monthlyExpenses, annualReturn, sweStartSalary, sweStartYear, startDebt],
  );

  const { rows, milestones } = sim;
  const finalRow = rows[rows.length - 1];
  const chartData = useMemo(() => rows.filter((_, i) => i % 3 === 0), [rows]);
  const xInterval = Math.max(1, Math.floor(chartData.length / 8));

  const label10 = { fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: t.textTertiary, marginBottom: 10 };
  const glass = { background: t.glass, border: `1px solid ${t.border}`, borderRadius: 12, padding: 12, marginBottom: 12 };

  return (
    <div style={{ padding: 16, fontFamily: SYSTEM_FONT, color: t.text }}>

      {/* Spending history */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.5px' }}>Spending History</div>
        <div style={{ fontSize: 12, color: t.textSecondary, marginTop: 2 }}>
          {rangeLabel}
        </div>
      </div>

      {!hasSpending && (
        <div style={{ ...glass, textAlign: 'center', padding: 28 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>No spending data yet</div>
          <div style={{ fontSize: 12, color: t.textSecondary, marginTop: 6, lineHeight: 1.5 }}>
            Import your bank statement PDFs from the Spending tab. Epiphany parses them
            on your account and the real monthly breakdown shows up here.
          </div>
        </div>
      )}

      {hasSpending && (
      <div style={glass}>
        <div style={label10}>Monthly Breakdown</div>
        <div style={{ width: '100%', height: 200 }}>
          <ResponsiveContainer>
            <BarChart data={historyData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
              <CartesianGrid stroke={t.border} strokeDasharray="3 3" />
              <XAxis dataKey="month" stroke={t.textSecondary} tick={{ fontSize: 10, fill: t.textTertiary }} />
              <YAxis stroke={t.textSecondary} tick={{ fontSize: 10, fill: t.textTertiary }} tickFormatter={(v) => `$${v}`} />
              <Tooltip content={<SpendingTooltip t={t} />} />
              <ReferenceLine y={TARGET_MONTHLY} stroke={t.accent} strokeDasharray="4 4"
                label={{ value: `$${TARGET_MONTHLY} target`, fill: t.accent, fontSize: 10, position: 'insideTopRight' }} />
              {CATS.map((cat) => (
                <Bar key={cat} dataKey={cat} name={cat} stackId="a" fill={CAT_COLORS[cat]} radius={cat === 'Other' ? [3, 3, 0, 0] : undefined} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Category legend */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8 }}>
          {CATS.map((cat) => (
            <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: CAT_COLORS[cat] }} />
              <span style={{ color: t.textSecondary }}>{cat}</span>
              <span style={{ color: t.text, fontVariantNumeric: 'tabular-nums' }}>${monthlyAvg[cat]}/mo avg</span>
            </div>
          ))}
        </div>
      </div>
      )}

      {/* May tracker */}
      {hasSpending && (
      <div style={glass}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={label10}>May 2026 Tracker</div>
          <div style={{ fontSize: 10, color: t.textTertiary }}>Day {may.day} / {MAY_DAYS}</div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>${may.total}</div>
            <div style={{ fontSize: 10, color: t.textTertiary }}>spent so far</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: may.projected > TARGET_MONTHLY ? t.red : t.green }}>
              ${may.projected}
            </div>
            <div style={{ fontSize: 10, color: t.textTertiary }}>projected (${TARGET_MONTHLY} target)</div>
          </div>
        </div>
        <div style={{ height: 6, background: t.border, borderRadius: 3, overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${Math.min(may.ratio * 100, 100)}%`,
            background: may.projected > TARGET_MONTHLY ? t.red : t.accent,
            borderRadius: 3,
            transition: 'width 0.3s ease',
          }} />
        </div>
        <div style={{ marginTop: 6, fontSize: 10, color: t.textTertiary }}>
          {may.ratio > 0
            ? `$${(may.total / may.ratio - may.total).toFixed(0)} remaining to stay under $${TARGET_MONTHLY}`
            : 'Month not started yet'}
        </div>
      </div>
      )}

      {/* Forecast */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.5px' }}>Hockey Stick</div>
        <div style={{ fontSize: 12, color: t.textSecondary, marginTop: 2 }}>
          ${(startDebt / 1000).toFixed(0)}k debt → $1M net worth. RDSP + VFV on BC PWD.
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 8, marginBottom: 14 }}>
        <StatCard t={t} label="Debt-Free" value={milestones.debtFree?.date || '—'} sub={`$${(startDebt / 1000).toFixed(0)}k to $0`} />
        <StatCard t={t} label="$100k NW" value={milestones.hit100k?.date || '—'} sub="first milestone" />
        <StatCard t={t} label="$1M NW" value={milestones.hit1m?.date || '—'} sub="the big one" />
        <StatCard t={t} label="Final" value={compactCurrency(finalRow.netWorth)} sub={`${(annualReturn * 100).toFixed(0)}% CAGR`} />
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 12, overflowX: 'auto' }}>
        {VIEWS.map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            style={{
              padding: '6px 14px', borderRadius: 100, border: 'none',
              fontSize: 12, fontWeight: 600, fontFamily: SYSTEM_FONT,
              cursor: 'pointer', whiteSpace: 'nowrap',
              background: view === v ? t.text : t.glass,
              color: view === v ? t.bg : t.textSecondary,
              transition: 'all 0.15s ease',
            }}
          >
            {VIEW_LABELS[v]}
          </button>
        ))}
      </div>

      <div style={{ ...glass, padding: 12 }}>
        <div style={{ width: '100%', height: 360 }}>
          <ResponsiveContainer>
            {view === 'netWorth' ? (
              <LineChart data={chartData} margin={{ top: 16, right: 16, left: 0, bottom: 8 }}>
                <CartesianGrid stroke={t.border} strokeDasharray="3 3" />
                <XAxis dataKey="date" stroke={t.textSecondary} tick={{ fontSize: 10, fill: t.textTertiary }} interval={xInterval} />
                <YAxis stroke={t.textSecondary} tick={{ fontSize: 10, fill: t.textTertiary }} tickFormatter={yTick} />
                <Tooltip content={<CustomTooltip t={t} />} />
                <ReferenceLine y={100000} stroke={t.textSecondary} strokeDasharray="4 4" label={{ value: '$100k', fill: t.textSecondary, fontSize: 10 }} />
                <ReferenceLine y={500000} stroke={t.textSecondary} strokeDasharray="4 4" label={{ value: '$500k', fill: t.textSecondary, fontSize: 10 }} />
                <ReferenceLine y={1000000} stroke={t.yellow} strokeDasharray="4 4" label={{ value: '$1M', fill: t.yellow, fontSize: 11, fontWeight: 600 }} />
                <Line type="monotone" dataKey="netWorth" name="Net Worth" stroke={t.accent} strokeWidth={2} dot={false} />
              </LineChart>
            ) : view === 'accounts' ? (
              <AreaChart data={chartData} margin={{ top: 16, right: 16, left: 0, bottom: 8 }}>
                <CartesianGrid stroke={t.border} strokeDasharray="3 3" />
                <XAxis dataKey="date" stroke={t.textSecondary} tick={{ fontSize: 10, fill: t.textTertiary }} interval={xInterval} />
                <YAxis stroke={t.textSecondary} tick={{ fontSize: 10, fill: t.textTertiary }} tickFormatter={yTick} />
                <Tooltip content={<CustomTooltip t={t} />} />
                <Area type="monotone" dataKey="rdsp" name="RDSP" stackId="1" stroke={t.yellow} fill={t.yellow} fillOpacity={0.3} strokeWidth={2} />
                <Area type="monotone" dataKey="tfsa" name="TFSA (VFV)" stackId="1" stroke={t.accent} fill={t.accent} fillOpacity={0.3} strokeWidth={2} />
                <Area type="monotone" dataKey="debtNeg" name="Debt" stackId="2" stroke={t.red} fill={t.red} fillOpacity={0.3} strokeWidth={2} />
              </AreaChart>
            ) : (
              <LineChart data={chartData} margin={{ top: 24, right: 16, left: 0, bottom: 8 }}>
                <CartesianGrid stroke={t.border} strokeDasharray="3 3" />
                <XAxis dataKey="date" stroke={t.textSecondary} tick={{ fontSize: 10, fill: t.textTertiary }} interval={xInterval} />
                <YAxis stroke={t.textSecondary} tick={{ fontSize: 10, fill: t.textTertiary }} tickFormatter={yTick} />
                <Tooltip content={<CustomTooltip t={t} />} />
                <Line type="monotone" dataKey="netWorth" name="Net Worth" stroke={t.accent} strokeWidth={2} dot={false} />
                {milestones.debtFree && (
                  <ReferenceDot x={milestones.debtFree.date} y={milestones.debtFree.netWorth} r={5} fill={t.green} stroke={t.bg} strokeWidth={2}
                    label={{ value: 'Debt-Free', position: 'top', fill: t.green, fontSize: 11, fontWeight: 600 }} />
                )}
                {milestones.hit100k && (
                  <ReferenceDot x={milestones.hit100k.date} y={100000} r={5} fill={t.accent} stroke={t.bg} strokeWidth={2}
                    label={{ value: '$100K', position: 'top', fill: t.accent, fontSize: 11, fontWeight: 600 }} />
                )}
                {milestones.hit500k && (
                  <ReferenceDot x={milestones.hit500k.date} y={500000} r={5} fill={t.purple} stroke={t.bg} strokeWidth={2}
                    label={{ value: '$500K', position: 'top', fill: t.purple, fontSize: 11, fontWeight: 600 }} />
                )}
                {milestones.hit1m && (
                  <ReferenceDot x={milestones.hit1m.date} y={1000000} r={7} fill={t.yellow} stroke={t.bg} strokeWidth={2}
                    label={{ value: '$1M', position: 'top', fill: t.yellow, fontSize: 13, fontWeight: 700 }} />
                )}
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      <div style={glass}>
        <div style={label10}>Parameters</div>
        <ParamSlider t={t} label="Monthly Expenses" value={monthlyExpenses} min={400} max={1500} step={25} onChange={setMonthlyExpenses} format={(v) => `$${v}`} />
        <ParamSlider t={t} label="Annual Return" value={annualReturn} min={0.04} max={0.15} step={0.005} onChange={setAnnualReturn} format={(v) => `${(v * 100).toFixed(1)}%`} />
        <ParamSlider t={t} label="SWE Start Salary" value={sweStartSalary} min={50000} max={200000} step={5000} onChange={setSweStartSalary} format={(v) => `$${(v / 1000).toFixed(0)}k`} />
        <ParamSlider t={t} label="SWE Start Year" value={sweStartYear} min={2028} max={2034} step={1} onChange={setSweStartYear} format={(v) => `${v}`} />
        <ParamSlider t={t} label="Starting Debt" value={startDebt} min={0} max={30000} step={500} onChange={setStartDebt} format={(v) => `$${(v / 1000).toFixed(1)}k`} />

        <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${t.border}`, fontSize: 10, lineHeight: 1.6, color: t.textSecondary }}>
          <div style={{ fontWeight: 600, color: t.textTertiary, marginBottom: 4, letterSpacing: '0.5px' }}>ASSUMPTIONS</div>
          RDSP: $1.5k personal → $3.5k grant (catch-up '27/'28: $4.5k → $10.5k)<br />
          UVic: $5.16k/yr from Sept '26 · Pivot lump: $3.9k Jun '26<br />
          PWD post-May: $1,735/mo · SWE default: $75k from 2030
        </div>
      </div>

      <div style={{ marginTop: 4, fontSize: 10, color: t.textTertiary, textAlign: 'center' }}>
        Income → Expenses → Debt → RDSP → TFSA → Growth
      </div>
    </div>
  );
}
