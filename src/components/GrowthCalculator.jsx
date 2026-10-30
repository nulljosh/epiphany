import { useMemo, useState } from 'react';
import { Card } from './ui';
import { formatCurrency } from '../utils/formatting';
import { growthCurve } from '../utils/growth';

// What a monthly amount grows to: three inputs, the end value, and the curve against what went in.
export default function GrowthCalculator({ t, dark }) {
  const [monthly, setMonthly] = useState(500);
  const [years, setYears] = useState(20);
  const [rate, setRate] = useState(6);
  const points = useMemo(() => growthCurve(monthly || 0, Math.min(years || 0, 60), rate || 0), [monthly, years, rate]);
  const end = points.at(-1);
  const W = 320, H = 120;
  const max = Math.max(end.value, 1);
  const path = (key) => points.map((p, i) => `${i ? 'L' : 'M'}${(p.year / Math.max(end.year, 1)) * W},${H - (p[key] / max) * H}`).join(' ');
  const dollars = (n) => formatCurrency(Math.round(n)).replace(/\.00$/, '');
  const field = (label, value, set) => (
    <label style={{ flex: 1, minWidth: 0, fontSize: 11, color: t.textSecondary }}>
      {label}
      <div style={{ marginTop: 4 }}>
        <input type="number" inputMode="decimal" min="0" value={value} aria-label={label}
          onChange={(e) => set(e.target.value === '' ? '' : Number(e.target.value))}
          style={{ width: '100%', minWidth: 0, borderRadius: 10, border: `1px solid ${t.border}`, background: 'transparent', color: t.text, padding: '8px 10px', fontSize: 15, fontFamily: 'inherit' }} />
      </div>
    </label>
  );
  return (
    <Card dark={dark} t={t} style={{ padding: 16, marginTop: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: t.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Compound growth</div>
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        {field('Each month ($)', monthly, setMonthly)}
        {field('Years', years, setYears)}
        {field('Return a year (%)', rate, setRate)}
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: t.text, marginTop: 14, fontVariantNumeric: 'tabular-nums' }}>{dollars(end.value)}</div>
      <div style={{ fontSize: 13, color: t.textSecondary }}>
        {dollars(end.contributed)} put in, {dollars(Math.max(end.value - end.contributed, 0))} growth
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height: 120, marginTop: 10 }} role="img" aria-label="Value against money put in, by year">
        <path d={`${path('value')} L${W},${H} L0,${H} Z`} fill={t.green} opacity="0.18" />
        <path d={path('value')} fill="none" stroke={t.green} strokeWidth="2" vectorEffect="non-scaling-stroke" />
        <path d={path('contributed')} fill="none" stroke={t.textSecondary} strokeWidth="1.5" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
      </svg>
    </Card>
  );
}
