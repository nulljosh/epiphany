import { Card } from './ui';
import { formatCurrency } from '../utils/formatting';

const DAY = 86400000;
const label = { fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 };
const monthName = (ym) => new Date(`${ym}-01T12:00:00`).toLocaleDateString(undefined, { month: 'short' });

// This month as a grid, with the days a recurring charge is due marked. Sunday first.
// Mirrors billsCalendar in Shared/MoneyGlance.swift.
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
export default function MoneyGlance({ recurring = [], cashflow = [], insights = [], dark, t }) {
  const today = new Date(new Date().toDateString()).getTime();
  const upcoming = recurring
    .map((r) => ({ ...r, at: new Date(`${r.nextDate}T12:00:00`).getTime() }))
    .filter((r) => r.at >= today && r.at <= today + 30 * DAY)
    .sort((a, b) => a.at - b.at)
    .slice(0, 5);
  const peak = Math.max(1, ...cashflow.flatMap((m) => [m.in, m.out]));
  if (!insights.length && !upcoming.length && !cashflow.length) return null;

  return (
    <>
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
