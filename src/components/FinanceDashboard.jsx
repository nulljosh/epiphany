import { useState, useMemo } from 'react';
import { Card } from './ui';
import { formatCurrency, compactCurrency, capitalize, CAT_COLORS, SYSTEM_FONT } from '../utils/formatting';
import { INCOME_SCENARIOS } from '../utils/financeData';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Line, ComposedChart, Area,
} from 'recharts';

function getCatColor(cat) {
  return CAT_COLORS[cat] || '#888';
}

const axisTickStyle = (t) => ({ fill: t.textTertiary, fontSize: 9 });
const yTickFormatter = (v) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`;

function buildDebtProjection(spending, totalDebt, totalIncome) {
  const avgSpend = spending.length > 0
    ? spending.reduce((s, m) => s + m.total, 0) / spending.length
    : 0;

  return Object.entries(INCOME_SCENARIOS).map(([key, scenario]) => {
    const income = key === 'actual'
      ? (totalIncome || avgSpend * 1.1)
      : scenario.monthly;
    const surplus = Math.max(0, income - avgSpend);
    const months = surplus > 0 ? Math.ceil(totalDebt / surplus) : Infinity;
    return {
      key,
      label: scenario.label,
      color: scenario.color,
      income,
      surplus,
      months: months === Infinity ? null : months,
    };
  });
}

function CustomTooltip({ active, payload, label, t }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: t.bg,
      border: `1px solid ${t.border}`,
      borderRadius: 10,
      padding: '8px 12px',
      fontSize: 11,
      fontFamily: SYSTEM_FONT,
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

export default function FinanceDashboard({ dark, t, spending, totalIncome, debt: debtItems }) {
  const [selectedMonth, setSelectedMonth] = useState(null);
  const font = SYSTEM_FONT;

  const totalDebt = useMemo(
    () => Array.isArray(debtItems) ? debtItems.reduce((s, d) => s + (d.balance || 0), 0) : 0,
    [debtItems]
  );

  const allCategories = useMemo(() => {
    const cats = new Set();
    for (const entry of spending) {
      for (const cat of Object.keys(entry.categories || {})) {
        cats.add(cat);
      }
    }
    return [...cats].sort();
  }, [spending]);

  const chartData = useMemo(() => {
    return spending.map((entry) => {
      const row = { month: entry.month, total: entry.total };
      for (const cat of allCategories) {
        row[cat] = entry.categories?.[cat] || 0;
      }
      for (const [key, scenario] of Object.entries(INCOME_SCENARIOS)) {
        row[key] = key === 'actual' ? (totalIncome || 0) : scenario.monthly;
      }
      return row;
    });
  }, [spending, allCategories, totalIncome]);

  const selectedData = useMemo(() => {
    if (!selectedMonth) return null;
    const entry = spending.find((e) => e.month === selectedMonth);
    if (!entry?.categories) return null;
    return Object.entries(entry.categories)
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value, color: getCatColor(name) }));
  }, [selectedMonth, spending]);

  const debtProjections = useMemo(
    () => buildDebtProjection(spending, totalDebt, totalIncome),
    [spending, totalDebt, totalIncome]
  );

  const labelStyle = { fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: t.textTertiary, marginBottom: 12 };

  if (!spending || spending.length === 0) {
    return (
      <Card dark t={t} style={{ padding: 20, textAlign: 'center' }}>
        <div style={{ color: t.textSecondary, fontSize: 13 }}>
          Upload bank statements in the Spending tab to populate the dashboard.
        </div>
      </Card>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: font }}>
      <Card dark t={t} style={{ padding: 20 }}>
        <div style={labelStyle}>Monthly Spending by Category</div>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData} onClick={(e) => {
            if (e?.activeLabel) setSelectedMonth(e.activeLabel);
          }}>
            <XAxis dataKey="month" tick={axisTickStyle(t)} axisLine={{ stroke: t.border }} tickLine={false} />
            <YAxis tick={axisTickStyle(t)} axisLine={false} tickLine={false} tickFormatter={yTickFormatter} />
            <Tooltip content={<CustomTooltip t={t} />} />
            {allCategories.map((cat) => (
              <Bar key={cat} dataKey={cat} stackId="spend" fill={getCatColor(cat)} radius={0} name={capitalize(cat)} />
            ))}
          </BarChart>
        </ResponsiveContainer>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
          {allCategories.map((cat) => (
            <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: getCatColor(cat) }} />
              <span style={{ color: t.textSecondary }}>{capitalize(cat)}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card dark t={t} style={{ padding: 20 }}>
        <div style={labelStyle}>Spending vs Income Scenarios</div>
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={chartData}>
            <XAxis dataKey="month" tick={axisTickStyle(t)} axisLine={{ stroke: t.border }} tickLine={false} />
            <YAxis tick={axisTickStyle(t)} axisLine={false} tickLine={false} tickFormatter={yTickFormatter} />
            <Tooltip content={<CustomTooltip t={t} />} />
            <Area type="monotone" dataKey="total" fill={t.green} fillOpacity={0.12} stroke={t.green} strokeWidth={2} name="Spending" />
            {Object.entries(INCOME_SCENARIOS).map(([key, scenario]) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={scenario.color}
                strokeWidth={1.5}
                strokeDasharray={key === 'actual' ? '0' : '6 4'}
                dot={false}
                name={scenario.label}
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </Card>

      {selectedData && (
        <Card dark t={t} style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={labelStyle}>{selectedMonth} Breakdown</div>
            <button
              onClick={() => setSelectedMonth(null)}
              style={{
                border: `1px solid ${t.border}`,
                background: t.glass,
                color: t.textSecondary,
                borderRadius: 999,
                padding: '4px 10px',
                fontSize: 10,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: font,
                transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
              }}
            >
              Close
            </button>
          </div>
          {selectedData.map((item) => {
            const maxVal = selectedData[0]?.value || 1;
            const pct = (item.value / maxVal) * 100;
            return (
              <div key={item.name} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 2 }}>
                  <span style={{ color: t.text, fontWeight: 600 }}>{capitalize(item.name)}</span>
                  <span style={{ color: t.textSecondary, fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(item.value)}</span>
                </div>
                <div style={{ height: 6, background: t.glass, borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: item.color, borderRadius: 3, transition: 'width 0.3s' }} />
                </div>
              </div>
            );
          })}
        </Card>
      )}

      {totalDebt > 0 && (
        <Card dark t={t} style={{ padding: 20 }}>
          <div style={labelStyle}>Debt Payoff Projection ({formatCurrency(totalDebt)})</div>
          {debtProjections.map((proj) => (
            <div key={proj.key} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600 }}>
                <span style={{ color: proj.color }}>{proj.label}</span>
                <span style={{ color: t.text, fontVariantNumeric: 'tabular-nums' }}>
                  {proj.months ? `${proj.months} months` : 'N/A'}
                </span>
              </div>
              <div style={{ fontSize: 11, color: t.textSecondary, marginTop: 2 }}>
                Income: {formatCurrency(proj.income)}/mo | Surplus: {formatCurrency(proj.surplus)}/mo
              </div>
              {proj.months && (
                <div style={{ height: 6, background: t.glass, borderRadius: 3, overflow: 'hidden', marginTop: 4 }}>
                  <div style={{
                    width: `${Math.min(100, (12 / proj.months) * 100)}%`,
                    height: '100%',
                    background: proj.color,
                    borderRadius: 3,
                    transition: 'width 0.3s',
                  }} />
                </div>
              )}
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
