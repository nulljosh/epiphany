import { Card } from './ui';
import { formatCurrency } from '../utils/formatting';
import { projectCash, leftThisMonth } from '../utils/moneyGlance';

const DAY = 86400000;
const label = { fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 };
const monthName = (ym) => new Date(`${ym}-01T12:00:00`).toLocaleDateString(undefined, { month: 'short' });

// This month as a grid, with the days a recurring charge is due marked. Sunday first.
// Mirrors billsCalendar in Shared/MoneyGlance.swift.
// Cash over the next 30 days as a line, Today at the left edge, with the low point called out.
function CashLine({ cash, recurring, income, dark, t }) {
  const { points, low, events } = projectCash(cash, recurring, income);
  if (!events) return null;
  const W = 320, H = 90;
  // Scale to the line's own range (zero only when it dips below), padded so a flat stretch isn't on the edge.
  const vals = points.map((p) => p.balance);
  const min = Math.min(...vals), max = Math.max(...vals), pad = (max - min) * 0.15 || Math.abs(max) * 0.05 || 1;
  const lo = min < 0 ? Math.min(min, 0) - pad : min - pad, hi = max + pad;
  const y = (v) => H - ((v - lo) / (hi - lo || 1)) * H;
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${(p.day / 30) * W},${y(p.balance)}`).join(' ');
  const dateOf = (day) => { const d = new Date(); d.setDate(d.getDate() + day); return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); };
  const end = points.at(-1).balance;
  const money = (v) => `${v < 0 ? '-' : ''}${formatCurrency(Math.abs(v))}`;
  return (
    <Card dark={dark} t={t} style={{ marginBottom: 16, padding: '16px 20px' }}>
      <div style={{ ...label, color: t.textTertiary, marginBottom: 4 }}>Cash in 30 days</div>
      <div style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: end < 0 ? t.red : t.text }}>{money(end)}</div>
      {low.day > 0 && low.balance < Math.min(cash, end) && (
        <div style={{ fontSize: 13, color: low.balance < 0 ? t.red : t.textSecondary }}>Lowest {money(low.balance)} on {dateOf(low.day)}</div>
      )}
      <svg viewBox={`-6 -6 ${W + 12} ${H + 22}`} style={{ width: '100%', height: 112, marginTop: 8 }} role="img" aria-label="Projected cash balance for the next 30 days">
        {lo < 0 && <line x1="0" x2={W} y1={y(0)} y2={y(0)} stroke={t.border} strokeDasharray="3 3" />}
        <path d={path} fill="none" stroke={t.accent || '#0a84ff'} strokeWidth="2" strokeLinejoin="round" />
        <circle cx="0" cy={y(cash)} r="4" fill={t.accent || '#0a84ff'} />
        <text x="0" y={H + 14} fontSize="10" fill={t.textTertiary}>Today</text>
        <text x={W} y={H + 14} fontSize="10" fill={t.textTertiary} textAnchor="end">{dateOf(30)}</text>
      </svg>
    </Card>
  );
}

function BillsCalendar({ recurring, t }) {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  const days = new Date(y, m + 1, 0).getDate();
  // Monthly bills land on the same day every month; the rest only on their next date.
  const due = new Set(recurring.flatMap((r) => {
    const d = new Date(`${r.nextDate}T12:00:00`);
    if (r.cadence === 'monthly') return [Math.min(d.getDate(), days)];
    return d.getFullYear() === y && d.getMonth() === m ? [d.getDate()] : [];
  }));
  const lead = new Date(y, m, 1).getDay();
  const cells = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 12, textAlign: 'center', fontSize: 11 }}>
      {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <div key={`h${i}`} style={{ color: t.textTertiary, fontWeight: 600 }}>{d}</div>)}
      {cells.map((d, i) => (
        <div key={i} style={{
          height: 24, lineHeight: '24px', borderRadius: 12, fontVariantNumeric: 'tabular-nums',
          color: d == null ? 'transparent' : due.has(d) ? t.text : d < now.getDate() ? t.textTertiary : t.textSecondary,
          fontWeight: due.has(d) || d === now.getDate() ? 700 : 400,
          background: due.has(d) ? 'rgba(255,159,10,0.22)' : 'transparent',
          boxShadow: d === now.getDate() ? `inset 0 0 0 1px ${t.textSecondary}` : 'none',
        }}>{d ?? ''}</div>
      ))}
    </div>
  );
}

// Top of Spending: what changed, what's due in the next 30 days, money in vs out.
// Each part hides when it has no data. Same shape as Shared/MoneyGlance.swift.
export default function MoneyGlance({ recurring = [], cashflow = [], insights = [], income = [], cash = 0, dark, t }) {
  const today = new Date(new Date().toDateString()).getTime();
  const upcoming = recurring
    .map((r) => ({ ...r, at: new Date(`${r.nextDate}T12:00:00`).getTime() }))
    .filter((r) => r.at >= today && r.at <= today + 30 * DAY)
    .sort((a, b) => a.at - b.at)
    .slice(0, 5);
  const peak = Math.max(1, ...cashflow.flatMap((m) => [m.in, m.out]));
  if (!insights.length && !upcoming.length && !cashflow.length) return null;

  const left = leftThisMonth(cashflow);

  return (
    <>
      {left && (
        <Card dark={dark} t={t} style={{ marginBottom: 16, padding: '16px 20px' }}>
          <div style={{ ...label, color: t.textTertiary, marginBottom: 4 }}>{left.title}</div>
          <div style={{ fontSize: 28, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: left.left >= 0 ? t.text : t.red }}>
            {left.left < 0 ? '-' : ''}{formatCurrency(Math.abs(left.left))}
          </div>
          <div style={{ fontSize: 13, color: t.textSecondary, fontVariantNumeric: 'tabular-nums' }}>
            {formatCurrency(left.in)} in, {formatCurrency(left.out)} spent
          </div>
        </Card>
      )}

      {insights.length > 0 && (
        <div style={{ display: 'flex', gap: 10, overflowX: 'auto', marginBottom: 16 }}>
          {insights.map((i) => (
            <Card key={i.kind} dark={dark} t={t} style={{ padding: 14, minWidth: 170, flex: '0 0 auto' }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{i.title.charAt(0).toUpperCase() + i.title.slice(1)}</div>
              <div style={{ fontSize: 18, fontWeight: 600, fontVariantNumeric: 'tabular-nums', margin: '4px 0' }}>{formatCurrency(i.amount)}</div>
              <div style={{ fontSize: 11, color: t.textTertiary }}>{i.detail}</div>
            </Card>
          ))}
        </div>
      )}

      {upcoming.length > 0 && (
        <Card dark={dark} t={t} style={{ marginBottom: 16, padding: '16px 20px' }}>
          <div style={{ ...label, color: t.textTertiary, display: 'flex', justifyContent: 'space-between' }}>
            <span>Next 30 days</span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(upcoming.reduce((s, r) => s + r.amount, 0))}</span>
          </div>
          <BillsCalendar recurring={recurring} t={t} />
          {upcoming.map((r) => (
            <div key={`${r.merchant}-${r.amount}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${t.border}` }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, textTransform: 'capitalize' }}>{r.merchant}</div>
                <div style={{ fontSize: 11, color: t.textTertiary }}>
                  {new Date(r.at).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                </div>
              </div>
              <div style={{ fontWeight: 600, fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(r.amount)}</div>
            </div>
          ))}
        </Card>
      )}

      {cash > 0 && <CashLine cash={cash} recurring={recurring} income={income} dark={dark} t={t} />}

      {cashflow.length > 0 && (
        <Card dark={dark} t={t} style={{ marginBottom: 16, padding: '16px 20px' }}>
          <div style={{ ...label, color: t.textTertiary, display: 'flex', justifyContent: 'space-between' }}>
            <span>Money in vs spending</span>
            <span><span style={{ color: t.green }}>In</span> · <span style={{ color: t.red }}>Spent</span></span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 120 }}>
            {cashflow.map((m) => (
              <div key={m.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%' }}>
                <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: 3, width: '100%', justifyContent: 'center' }}
                  title={`${monthName(m.month)}: in ${formatCurrency(m.in)}, spent ${formatCurrency(m.out)}`}>
                  <div style={{ width: '40%', maxWidth: 18, height: `${(m.in / peak) * 100}%`, background: t.green, borderRadius: 3 }} />
                  <div style={{ width: '40%', maxWidth: 18, height: `${(m.out / peak) * 100}%`, background: t.red, borderRadius: 3 }} />
                </div>
                <div style={{ fontSize: 10, color: t.textTertiary }}>{monthName(m.month)}</div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </>
  );
}
