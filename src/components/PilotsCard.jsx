// Pilots: famous investors' top 10 holdings from their latest 13F, what those did since the quarter
// ended against the S&P 500, and which of them you also hold. Read only, from /api/pilots.
import { useEffect, useState } from 'react';
import { Card } from './ui';

const pct = (x) => (x == null ? '–' : `${x >= 0 ? '+' : ''}${(x * 100).toFixed(1)}%`);
const short = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

export default function PilotsCard({ dark, t, holdings = [] }) {
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    fetch('/api/pilots').then(r => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(d => { if (live) setData(d); })
      .catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, []);

  const mine = new Set(holdings.map(h => String(h.symbol || '').toUpperCase()));
  const label = { fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: t.textTertiary };
  const color = (x) => (x == null ? t.textSecondary : x >= 0 ? t.green : t.red);

  if (failed) return null; // a missing card beats a broken one
  return (
    <Card dark={dark} t={t} style={{ marginBottom: 16 }}>
      <div style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
          <div style={label}>Pilots</div>
          <div style={{ fontSize: 10, color: t.textTertiary }}>From their latest SEC 13F</div>
        </div>
        {!data && <div style={{ fontSize: 13, color: t.textTertiary, padding: '10px 0' }}>Loading filings…</div>}
        {data?.pilots?.map((p, i) => {
          const shared = p.holdings.filter(h => h.ticker && mine.has(h.ticker)).map(h => h.ticker);
          const isOpen = open === p.id;
          return (
            <div key={p.id} style={{ borderBottom: i === data.pilots.length - 1 ? 'none' : `1px solid ${t.border}` }}>
              <button type="button" onClick={() => setOpen(isOpen ? null : p.id)} aria-expanded={isOpen}
                style={{ all: 'unset', boxSizing: 'border-box', width: '100%', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: t.textTertiary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {p.fund}{shared.length ? ` · you both own ${shared.join(', ')}` : ''}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: color(p.returnSince) }}>{pct(p.returnSince)}</div>
                  <div style={{ fontSize: 11, color: t.textTertiary }}>S&amp;P {pct(p.spySince)} since {short(p.quarterEnd)}</div>
                </div>
              </button>
              {isOpen && (
                <div style={{ paddingBottom: 12 }}>
                  {p.holdings.map(h => (
                    <div key={h.name + h.ticker} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, padding: '4px 0' }}>
                      <span style={{ width: 52, fontWeight: 600, color: h.ticker && mine.has(h.ticker) ? (t.accent || t.blue) : t.text }}>{h.ticker || '–'}</span>
                      <div style={{ flex: 1, height: 6, borderRadius: 3, background: t.border, overflow: 'hidden' }} aria-hidden="true">
                        <div style={{ width: `${Math.min(100, h.weight * 100 / Math.max(p.holdings[0].weight, 0.01))}%`, height: '100%', background: t.accent || t.blue }} />
                      </div>
                      <span style={{ width: 44, textAlign: 'right', color: t.textSecondary, fontVariantNumeric: 'tabular-nums' }}>{(h.weight * 100).toFixed(1)}%</span>
                    </div>
                  ))}
                  <div style={{ fontSize: 11, color: t.textTertiary, marginTop: 6 }}>
                    Top 10 of {p.positions} positions, {(p.topWeight * 100).toFixed(0)}% of the reported value. Filed {short(p.filedAt)}.{' '}
                    <a href={p.filing} target="_blank" rel="noreferrer" style={{ color: t.accent || t.blue }}>Filing</a>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
