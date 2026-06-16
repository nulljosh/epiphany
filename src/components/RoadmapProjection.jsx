import { useState, useMemo } from 'react';
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, ReferenceDot,
} from 'recharts';
import { compactCurrency, formatCurrency, SYSTEM_FONT } from '../utils/formatting';
import { simulate } from '../utils/roadmapSim';

const VIEWS = ['netWorth', 'accounts', 'milestones'];
const VIEW_LABELS = { netWorth: 'Net Worth', accounts: 'Accounts', milestones: 'Milestones' };

function CustomTooltip({ active, payload, label, t }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: t.bg, border: `1px solid ${t.border}`, borderRadius: 10,
      padding: '8px 12px', fontSize: 11, fontFamily: SYSTEM_FONT,
    }}>
      <div style={{ fontWeight: 700, marginBottom: 4, color: t.text }}>{label}</div>
      {payload.map((entry) => (
        <div key={entry.dataKey} style={{ color: entry.color, display: 'flex', justifyContent: 'space-between', gap: 16, fontSize: 11 }}>
          <span>{entry.name}</span>
          <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: t.text }}>
            {formatCurrency(Math.abs(entry.value))}
          </span>
        </div>
      ))}
    </div>
  );
}

function StatCard({ t, label, value, sub }) {
  return (
    <div style={{
      background: t.glass, border: `1px solid ${t.border}`,
      borderRadius: 12, padding: 12,
    }}>
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

const yTickFormatter = (v) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`;

export default function RoadmapProjection({ t }) {
  const [view, setView] = useState('netWorth');
  const [monthlyExpenses, setMonthlyExpenses] = useState(650);
  const [annualReturn, setAnnualReturn] = useState(0.10);
  const [sweStartSalary, setSweStartSalary] = useState(75000);
  const [sweStartYear, setSweStartYear] = useState(2030);
  const [startDebt, setStartDebt] = useState(10000);

  const sim = useMemo(
    () => simulate({ monthlyExpenses, annualReturn, sweStartSalary, sweStartYear, startDebt, horizonYears: 17 }),
    [monthlyExpenses, annualReturn, sweStartSalary, sweStartYear, startDebt]
  );

  const { rows, milestones } = sim;
  const finalRow = rows[rows.length - 1];
  const chartData = useMemo(() => rows.filter((_, i) => i % 3 === 0), [rows]);
  const xInterval = Math.max(1, Math.floor(chartData.length / 8));

  const axisColor = t.textSecondary;
  const gridColor = t.border;
  const lineColor = t.accent;

  return (
    <div style={{ padding: 16, fontFamily: SYSTEM_FONT, color: t.text }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.5px' }}>Hockey Stick</div>
        <div style={{ fontSize: 12, color: t.textSecondary, marginTop: 2 }}>
          ${(startDebt / 1000).toFixed(0)}k debt to $1M net worth. RDSP + VFV compounding on BC PWD.
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
              padding: '6px 14px',
              borderRadius: 100,
              border: 'none',
              fontSize: 12,
              fontWeight: 600,
              fontFamily: SYSTEM_FONT,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              background: view === v ? t.text : t.glass,
              color: view === v ? t.bg : t.textSecondary,
              transition: 'all 0.15s ease',
            }}
          >
            {VIEW_LABELS[v]}
          </button>
        ))}
      </div>

      <div style={{ background: t.glass, border: `1px solid ${t.border}`, borderRadius: 12, padding: 12, marginBottom: 12 }}>
        <div style={{ width: '100%', height: 360 }}>
          <ResponsiveContainer>
            {view === 'netWorth' ? (
              <LineChart data={chartData} margin={{ top: 16, right: 16, left: 0, bottom: 8 }}>
                <CartesianGrid stroke={gridColor} strokeDasharray="3 3" />
                <XAxis dataKey="date" stroke={axisColor} tick={{ fontSize: 10, fill: t.textTertiary }} interval={xInterval} />
                <YAxis stroke={axisColor} tick={{ fontSize: 10, fill: t.textTertiary }} tickFormatter={yTickFormatter} />
                <Tooltip content={<CustomTooltip t={t} />} />
                <ReferenceLine y={100000} stroke={axisColor} strokeDasharray="4 4" label={{ value: '$100k', fill: axisColor, fontSize: 10 }} />
                <ReferenceLine y={500000} stroke={axisColor} strokeDasharray="4 4" label={{ value: '$500k', fill: axisColor, fontSize: 10 }} />
                <ReferenceLine y={1000000} stroke={t.yellow} strokeDasharray="4 4" label={{ value: '$1M', fill: t.yellow, fontSize: 11, fontWeight: 600 }} />
                <Line type="monotone" dataKey="netWorth" name="Net Worth" stroke={lineColor} strokeWidth={2} dot={false} />
              </LineChart>
            ) : view === 'accounts' ? (
              <AreaChart data={chartData} margin={{ top: 16, right: 16, left: 0, bottom: 8 }}>
                <CartesianGrid stroke={gridColor} strokeDasharray="3 3" />
                <XAxis dataKey="date" stroke={axisColor} tick={{ fontSize: 10, fill: t.textTertiary }} interval={xInterval} />
                <YAxis stroke={axisColor} tick={{ fontSize: 10, fill: t.textTertiary }} tickFormatter={yTickFormatter} />
                <Tooltip content={<CustomTooltip t={t} />} />
                <Area type="monotone" dataKey="rdsp" name="RDSP" stackId="1" stroke={t.yellow} fill={t.yellow} fillOpacity={0.3} strokeWidth={2} />
                <Area type="monotone" dataKey="tfsa" name="TFSA (VFV)" stackId="1" stroke={lineColor} fill={lineColor} fillOpacity={0.3} strokeWidth={2} />
                <Area type="monotone" dataKey="debtNeg" name="Debt" stackId="2" stroke={t.red} fill={t.red} fillOpacity={0.3} strokeWidth={2} />
              </AreaChart>
            ) : (
              <LineChart data={chartData} margin={{ top: 24, right: 16, left: 0, bottom: 8 }}>
                <CartesianGrid stroke={gridColor} strokeDasharray="3 3" />
                <XAxis dataKey="date" stroke={axisColor} tick={{ fontSize: 10, fill: t.textTertiary }} interval={xInterval} />
                <YAxis stroke={axisColor} tick={{ fontSize: 10, fill: t.textTertiary }} tickFormatter={yTickFormatter} />
                <Tooltip content={<CustomTooltip t={t} />} />
                <Line type="monotone" dataKey="netWorth" name="Net Worth" stroke={lineColor} strokeWidth={2} dot={false} />
                {milestones.debtFree && (
                  <ReferenceDot x={milestones.debtFree.date} y={milestones.debtFree.netWorth} r={5} fill={t.green} stroke={t.bg} strokeWidth={2}
                    label={{ value: 'Debt-Free', position: 'top', fill: t.green, fontSize: 11, fontWeight: 600 }} />
                )}
                {milestones.hit100k && (
                  <ReferenceDot x={milestones.hit100k.date} y={100000} r={5} fill={lineColor} stroke={t.bg} strokeWidth={2}
                    label={{ value: '$100K', position: 'top', fill: lineColor, fontSize: 11, fontWeight: 600 }} />
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

      <div style={{ background: t.glass, border: `1px solid ${t.border}`, borderRadius: 12, padding: 14 }}>
        <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: t.textTertiary, marginBottom: 10 }}>
          Parameters
        </div>
        <ParamSlider t={t} label="Monthly Expenses" value={monthlyExpenses} min={400} max={1500} step={25} onChange={setMonthlyExpenses} format={(v) => `$${v}`} />
        <ParamSlider t={t} label="Annual Return" value={annualReturn} min={0.04} max={0.15} step={0.005} onChange={setAnnualReturn} format={(v) => `${(v * 100).toFixed(1)}%`} />
        <ParamSlider t={t} label="SWE Start Salary" value={sweStartSalary} min={50000} max={200000} step={5000} onChange={setSweStartSalary} format={(v) => `$${(v / 1000).toFixed(0)}k`} />
        <ParamSlider t={t} label="SWE Start Year" value={sweStartYear} min={2028} max={2034} step={1} onChange={setSweStartYear} format={(v) => `${v}`} />
        <ParamSlider t={t} label="Starting Debt" value={startDebt} min={0} max={30000} step={500} onChange={setStartDebt} format={(v) => `$${(v / 1000).toFixed(1)}k`} />

        <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${t.border}`, fontSize: 10, lineHeight: 1.6, color: t.textSecondary }}>
          <div style={{ fontWeight: 600, color: t.textTertiary, marginBottom: 4, letterSpacing: '0.5px' }}>ASSUMPTIONS</div>
          RDSP: $1.5k personal to $3.5k grant<br />
          Catch-up 27/28: $4.5k to $10.5k<br />
          UVIC: $5.16k/yr from Sept '26<br />
          Pivot lump: $3.9k Jun '26<br />
          Debt avalanche first
        </div>
      </div>

      <div style={{ marginTop: 8, fontSize: 10, color: t.textTertiary, textAlign: 'center' }}>
        Monthly tick. Income to Expenses to Debt to RDSP to TFSA to Growth.
      </div>
    </div>
  );
}
