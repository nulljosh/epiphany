import { useState, useMemo } from 'react';
import { Card } from './ui';
import { formatCurrency, compactCurrency, capitalize, CAT_COLORS, SYSTEM_FONT } from '../utils/formatting';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Line, LineChart, ComposedChart, Area, PieChart, Pie, Cell,
} from 'recharts';
import { simulateDebtCuts, simulateStrategies, projectNetWorth, projectLive, computeSimulator } from '../utils/debtProjections';

const axisTickStyle = (t) => ({ fill: t.textTertiary, fontSize: 9 });
const yTickFormatter = (v) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`;

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
          <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{compactCurrency(entry.value)}</span>
        </div>
      ))}
    </div>
  );
}

const PHASE_COLORS = { current: '#0a84ff', soon: '#ffd60a', pending: '#bf5af2', future: '#ff9f0a', done: '#30d158' };
const DONUT_COLORS = ['#0a84ff', '#5ac8fa', '#ff453a', '#30d158', '#bf5af2', '#ff9f0a', '#ffd60a', '#ff2d55'];
const TIMELINE_EVENTS = [
  { label: 'Telus plan ends', date: 'Nov 2027', amount: '+$155/mo freed', status: 'future', description: '$700+/mo surplus' },
  { label: 'Debt-free', date: '~Early 2028', amount: '$0 debt', status: 'done', description: 'Savings begin' },
];

const VARIABLE_CATEGORIES = new Set(['Food', 'Vape', 'Weed', 'Other']);

export default function FinanceDashboard({ dark, t, spending, totalIncome, debt: debtItems, budget, incomePhases, totalExpenses, surplus }) {
  const font = SYSTEM_FONT;
  const labelStyle = { fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: t.textTertiary, marginBottom: 12 };

  const totalDebt = useMemo(
    () => Array.isArray(debtItems) ? debtItems.reduce((s, d) => s + (d.balance || 0), 0) : 0,
    [debtItems]
  );

  const fixedExpenses = useMemo(() => {
    const expenses = budget?.expenses || [];
    return expenses
      .filter(e => !VARIABLE_CATEGORIES.has(e.name))
      .reduce((s, e) => s + (e.amount || 0), 0);
  }, [budget]);

  const incomeGoal = useMemo(() => {
    if (!incomePhases || incomePhases.length === 0) return 0;
    return Math.max(...incomePhases.map(p => p.monthly || 0));
  }, [incomePhases]);

  const debtFreeMonths = useMemo(() => {
    if (totalDebt <= 0) return 0;
    const s = surplus || 0;
    return s > 0 ? Math.ceil(totalDebt / s) : null;
  }, [totalDebt, surplus]);

  const spendingDonutData = useMemo(() => {
    const expenses = budget?.expenses || [];
    if (expenses.length === 0) return [];
    const data = expenses.map(e => ({ name: e.name, value: e.amount || 0 }));
    if (surplus > 0) data.push({ name: 'Savings', value: surplus });
    return data;
  }, [budget, surplus]);

  const waterfallData = useMemo(() => {
    if (!incomePhases || incomePhases.length === 0) return [];
    const sorted = [...incomePhases].sort((a, b) => (a.monthly || 0) - (b.monthly || 0));
    return sorted.map((phase, i) => {
      const prev = i > 0 ? sorted[i - 1].monthly : 0;
      const delta = (phase.monthly || 0) - prev;
      return { name: phase.label, base: prev, delta, total: phase.monthly };
    });
  }, [incomePhases]);

  const projectionPhases = useMemo(() => {
    if (!incomePhases || incomePhases.length === 0) {
      return [{ startMonth: 0, payment: Math.max(0, surplus || 0) }];
    }
    const sorted = [...incomePhases].sort((a, b) => (a.monthly || 0) - (b.monthly || 0));
    const expenses = totalExpenses || 0;
    return sorted.map((phase, i) => ({
      startMonth: i === 0 ? 0 : i * 3 + (i > 1 ? 4 : 0),
      payment: Math.max(0, (phase.monthly || 0) - expenses),
    }));
  }, [incomePhases, totalExpenses, surplus]);

  const strategiesData = useMemo(() => {
    if (!debtItems || debtItems.length === 0) return null;
    return simulateStrategies(debtItems, 500, 36);
  }, [debtItems]);

  const netWorthData = useMemo(() => {
    return projectNetWorth(totalDebt, projectionPhases, 42);
  }, [totalDebt, projectionPhases]);

  const { vapeExpense, weedExpense } = useMemo(() => {
    const expenses = budget?.expenses || [];
    let vape = 0, weed = 0;
    for (const e of expenses) {
      if (e.name === 'Vape') vape = e.amount || 0;
      else if (e.name === 'Weed') weed = e.amount || 0;
    }
    return { vapeExpense: vape, weedExpense: weed };
  }, [budget]);

  const vapeImpactData = useMemo(() => {
    return simulateDebtCuts(totalDebt, { months: 30, phases: projectionPhases }, [
      { label: 'Current spending', extra: 0, color: '#ff453a' },
      { label: `Cut vape (+$${vapeExpense})`, extra: vapeExpense, color: '#ffd60a' },
      { label: `Cut vape+weed (+$${vapeExpense + weedExpense})`, extra: vapeExpense + weedExpense, color: '#30d158' },
    ]);
  }, [totalDebt, projectionPhases, vapeExpense, weedExpense]);

  const [simFood, setSimFood] = useState(300);
  const [simVape, setSimVape] = useState(150);
  const [simWeed, setSimWeed] = useState(75);
  const [simOther, setSimOther] = useState(140);

  const simResult = useMemo(() => {
    const phase2Income = incomePhases?.find(p => p.status === 'soon')?.monthly || 1500;
    return computeSimulator(phase2Income, fixedExpenses, { food: simFood, vape: simVape, weed: simWeed, other: simOther }, totalDebt);
  }, [simFood, simVape, simWeed, simOther, totalDebt, fixedExpenses, incomePhases]);

  const liveProjection = useMemo(() => {
    const proj = projectLive(totalDebt, Math.max(0, simResult.surplus), 42);
    return proj.labels.map((label, i) => ({
      name: label,
      debt: proj.debt[i],
      savings: proj.savings[i],
    }));
  }, [totalDebt, simResult.surplus]);

  if (totalDebt <= 0 && (!spending || spending.length === 0) && (!budget?.expenses || budget.expenses.length === 0)) {
    return (
      <Card dark t={t} style={{ padding: 20, textAlign: 'center' }}>
        <div style={{ color: t.textSecondary, fontSize: 13 }}>
          Add debt, budget, or spending data in the Budget tab to populate the dashboard.
        </div>
      </Card>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontFamily: font }}>

      {/* Key Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        {[
          { value: formatCurrency(totalDebt), label: 'Total Debt', color: t.red },
          { value: formatCurrency(totalIncome || 0), label: 'Income Now', color: t.accent || '#0a84ff' },
          { value: formatCurrency(incomeGoal), label: 'Income Goal', color: '#bf5af2' },
          { value: debtFreeMonths ? `~${debtFreeMonths}mo` : 'N/A', label: 'Debt-Free ETA', color: t.green },
        ].map((stat) => (
          <Card key={stat.label} dark t={t} style={{ padding: 12, textAlign: 'center', marginBottom: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.02em', color: stat.color, fontVariantNumeric: 'tabular-nums' }}>{stat.value}</div>
            <div style={{ fontSize: 9, color: t.textTertiary, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 3 }}>{stat.label}</div>
          </Card>
        ))}
      </div>

      {/* Income Timeline */}
      {incomePhases && incomePhases.length > 0 && (
        <Card dark t={t} style={{ padding: 20, marginBottom: 0 }}>
          <div style={labelStyle}>Timeline</div>
          <div style={{ position: 'relative', paddingLeft: 24 }}>
            <div style={{ position: 'absolute', left: 5, top: 10, bottom: 10, width: 2, background: t.border, borderRadius: 1 }} />
            {[...incomePhases, ...TIMELINE_EVENTS].map((phase, i) => {
              const status = phase.status || 'current';
              const color = PHASE_COLORS[status] || '#0a84ff';
              return (
                <div key={phase.label + i} style={{ position: 'relative', marginBottom: i < incomePhases.length + TIMELINE_EVENTS.length - 1 ? 18 : 0 }}>
                  <div style={{
                    position: 'absolute', left: -21, top: 10, width: 10, height: 10,
                    borderRadius: '50%', background: color, border: `2px solid ${t.bg}`,
                    transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  }} />
                  <div style={{
                    background: t.glass, border: `1px solid ${t.border}`, borderRadius: 12,
                    padding: '10px 14px', transition: 'background 0.2s, transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  }}>
                    <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: t.textTertiary }}>
                      {phase.date || ''}
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.02em', color, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
                      {phase.amount || `$${(phase.monthly || 0).toLocaleString()}/mo`}
                    </div>
                    <div style={{ fontSize: 12, color: t.textSecondary, marginTop: 2 }}>
                      {phase.description || phase.label}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Debt Breakdown Bars */}
      {debtItems && debtItems.length > 0 && (
        <Card dark t={t} style={{ padding: 20, marginBottom: 0 }}>
          <div style={labelStyle}>Debt Breakdown</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {debtItems.map((d, i) => {
              const pct = totalDebt > 0 ? (d.balance / totalDebt) * 100 : 0;
              const colors = ['#ff453a', '#ff9f0a', '#ffd60a', '#bf5af2', '#0a84ff'];
              const color = colors[i % colors.length];
              return (
                <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, minWidth: 48, color: t.textSecondary }}>{d.name}</span>
                  <div style={{ flex: 1, height: 8, borderRadius: 4, background: t.border || 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 4, background: color,
                      width: `${pct}%`, transition: 'width 1.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    }} />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, minWidth: 55, textAlign: 'right', color, fontVariantNumeric: 'tabular-nums' }}>
                    {formatCurrency(d.balance)}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Spending Donut */}
      {spendingDonutData.length > 0 && (
        <Card dark t={t} style={{ padding: 20, marginBottom: 0 }}>
          <div style={labelStyle}>Where ${formatCurrency(totalIncome || totalExpenses || 0).replace('$', '')} Goes</div>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={spendingDonutData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={95}
                paddingAngle={2}
                stroke="none"
              >
                {spendingDonutData.map((_, i) => (
                  <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip t={t} />} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
            {spendingDonutData.map((item, i) => (
              <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                <span style={{ color: t.textSecondary }}>{item.name}</span>
                <span style={{ fontWeight: 600, color: t.text, fontVariantNumeric: 'tabular-nums' }}>${item.value}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Income Waterfall */}
      {waterfallData.length > 0 && (
        <Card dark t={t} style={{ padding: 20, marginBottom: 0 }}>
          <div style={labelStyle}>Income Stack by Phase</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={waterfallData}>
              <XAxis dataKey="name" tick={axisTickStyle(t)} axisLine={{ stroke: t.border }} tickLine={false} />
              <YAxis tick={axisTickStyle(t)} axisLine={false} tickLine={false} tickFormatter={yTickFormatter} />
              <Tooltip content={<CustomTooltip t={t} />} />
              <Bar dataKey="base" stackId="income" fill="transparent" name="Base" />
              <Bar dataKey="delta" stackId="income" fill="#0a84ff" radius={[6, 6, 0, 0]} name="Added" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Vape Impact */}
      {totalDebt > 0 && (
        <Card dark t={t} style={{ padding: 20, marginBottom: 0 }}>
          <div style={labelStyle}>Vape Cut Impact</div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={vapeImpactData.labels.map((label, i) => {
              const row = { name: label };
              vapeImpactData.datasets.forEach(ds => { row[ds.label] = ds.data[i]; });
              return row;
            })}>
              <XAxis dataKey="name" tick={axisTickStyle(t)} axisLine={{ stroke: t.border }} tickLine={false} />
              <YAxis tick={axisTickStyle(t)} axisLine={false} tickLine={false} tickFormatter={yTickFormatter} />
              <Tooltip content={<CustomTooltip t={t} />} />
              {vapeImpactData.datasets.map(ds => (
                <Line key={ds.label} type="monotone" dataKey={ds.label} stroke={ds.color} strokeWidth={2} dot={false} name={ds.label} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Strategies */}
      {strategiesData && (
        <Card dark t={t} style={{ padding: 20, marginBottom: 0 }}>
          <div style={labelStyle}>Avalanche vs Snowball vs Doing Nothing</div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={strategiesData.labels.map((label, i) => {
              const row = { name: label };
              strategiesData.datasets.forEach(ds => { row[ds.label] = ds.data[i]; });
              return row;
            })}>
              <XAxis dataKey="name" tick={axisTickStyle(t)} axisLine={{ stroke: t.border }} tickLine={false} />
              <YAxis tick={axisTickStyle(t)} axisLine={false} tickLine={false} tickFormatter={yTickFormatter} />
              <Tooltip content={<CustomTooltip t={t} />} />
              {strategiesData.datasets.map(ds => (
                <Line key={ds.label} type="monotone" dataKey={ds.label} stroke={ds.color} strokeWidth={2} dot={false} name={ds.label} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Net Worth */}
      {totalDebt > 0 && (
        <Card dark t={t} style={{ padding: 20, marginBottom: 0 }}>
          <div style={labelStyle}>Net Worth Over Time</div>
          <ResponsiveContainer width="100%" height={200}>
            <ComposedChart data={netWorthData.labels.map((label, i) => ({ name: label, value: netWorthData.data[i] }))}>
              <XAxis dataKey="name" tick={axisTickStyle(t)} axisLine={{ stroke: t.border }} tickLine={false} />
              <YAxis tick={axisTickStyle(t)} axisLine={false} tickLine={false} tickFormatter={yTickFormatter} />
              <Tooltip content={<CustomTooltip t={t} />} />
              <Area type="monotone" dataKey="value" fill={t.green} fillOpacity={0.08} stroke={t.green} strokeWidth={2.5} name="Net Worth" />
            </ComposedChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Live Projection */}
      {totalDebt > 0 && (
        <Card dark t={t} style={{ padding: 20, marginBottom: 0 }}>
          <div style={labelStyle}>Live Projection</div>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={liveProjection}>
              <XAxis dataKey="name" tick={axisTickStyle(t)} axisLine={{ stroke: t.border }} tickLine={false} />
              <YAxis tick={axisTickStyle(t)} axisLine={false} tickLine={false} tickFormatter={yTickFormatter} />
              <Tooltip content={<CustomTooltip t={t} />} />
              <Line type="monotone" dataKey="debt" stroke="#ff453a" strokeWidth={2} dot={false} name="Debt" />
              <Line type="monotone" dataKey="savings" stroke="#30d158" strokeWidth={2} dot={false} name="Savings" />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Spending Simulator */}
      {totalDebt > 0 && (
        <Card dark t={t} style={{ padding: 20, marginBottom: 0 }}>
          <div style={labelStyle}>Spending Simulator</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
            {[
              { label: 'Food', value: simFood, set: setSimFood, min: 150, max: 500, step: 10 },
              { label: 'Vape', value: simVape, set: setSimVape, min: 0, max: 200, step: 10 },
              { label: 'Weed', value: simWeed, set: setSimWeed, min: 0, max: 150, step: 5 },
              { label: 'Other', value: simOther, set: setSimOther, min: 0, max: 300, step: 10 },
            ].map((slider) => (
              <div key={slider.label} style={{
                background: t.glass, border: `1px solid ${t.border}`, borderRadius: 12, padding: 12,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: t.textTertiary, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                  <span>{slider.label}</span>
                  <span style={{ fontWeight: 700, color: t.text, fontSize: 11 }}>${slider.value}</span>
                </div>
                <input
                  type="range"
                  min={slider.min}
                  max={slider.max}
                  step={slider.step}
                  value={slider.value}
                  onChange={(e) => slider.set(Number(e.target.value))}
                  style={{
                    width: '100%', WebkitAppearance: 'none', height: 4, borderRadius: 2,
                    background: t.border || 'rgba(255,255,255,0.08)', outline: 'none', cursor: 'pointer',
                  }}
                />
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {[
              {
                label: 'Surplus/mo',
                value: `${simResult.surplus >= 0 ? '+' : ''}$${simResult.surplus}`,
                color: simResult.surplus > 200 ? t.green : simResult.surplus > 0 ? '#ffd60a' : t.red,
              },
              {
                label: 'Debt-Free',
                value: isFinite(simResult.monthsToPayoff) ? `${simResult.monthsToPayoff} mo` : 'Never',
                color: t.accent || '#0a84ff',
              },
              {
                label: '2yr Savings',
                value: `$${simResult.savingsAfter2yr.toLocaleString()}`,
                color: t.green,
              },
            ].map((res) => (
              <div key={res.label} style={{
                background: t.glass, border: `1px solid ${t.border}`, borderRadius: 12,
                padding: 12, textAlign: 'center',
                transition: 'background 0.2s, transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
              }}>
                <div style={{ fontSize: 9, color: t.textTertiary, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{res.label}</div>
                <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.02em', color: res.color, fontVariantNumeric: 'tabular-nums' }}>{res.value}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Existing: Monthly Spending by Category (if spending data exists) */}
      {spending && spending.length > 0 && (() => {
        const allCategories = [...new Set(spending.flatMap(e => Object.keys(e.categories || {})))].sort();
        const chartData = spending.map((entry) => {
          const row = { month: entry.month, total: entry.total };
          for (const cat of allCategories) row[cat] = entry.categories?.[cat] || 0;
          return row;
        });
        return (
          <Card dark t={t} style={{ padding: 20, marginBottom: 0 }}>
            <div style={labelStyle}>Monthly Spending by Category</div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData}>
                <XAxis dataKey="month" tick={axisTickStyle(t)} axisLine={{ stroke: t.border }} tickLine={false} />
                <YAxis tick={axisTickStyle(t)} axisLine={false} tickLine={false} tickFormatter={yTickFormatter} />
                <Tooltip content={<CustomTooltip t={t} />} />
                {allCategories.map((cat) => (
                  <Bar key={cat} dataKey={cat} stackId="spend" fill={CAT_COLORS[cat] || '#888'} radius={0} name={capitalize(cat)} />
                ))}
              </BarChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
              {allCategories.map((cat) => (
                <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: CAT_COLORS[cat] || '#888' }} />
                  <span style={{ color: t.textSecondary }}>{capitalize(cat)}</span>
                </div>
              ))}
            </div>
          </Card>
        );
      })()}
    </div>
  );
}
