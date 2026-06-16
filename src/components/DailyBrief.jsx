import { useEffect, useState } from 'react';

export default function DailyBrief({ t, font, dark }) {
  const [brief, setBrief] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/daily-brief', { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setBrief(data);
      } catch { /* ignore */ } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) return null;
  if (!brief) return null;

  const ts = brief.generatedAt ? new Date(brief.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;

  return (
    <div style={{
      background: dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
      border: `1px solid ${t.border}`,
      borderRadius: 10,
      padding: '10px 12px',
      marginBottom: 12,
      fontFamily: font,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: expanded ? 8 : 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: t.textSecondary }}>Daily Brief</span>
          {ts && <span style={{ fontSize: 9, color: t.textTertiary }}>{ts}</span>}
        </div>
        <button
          onClick={() => setExpanded(v => !v)}
          style={{ background: 'none', border: 'none', color: t.textTertiary, cursor: 'pointer', fontSize: 10, padding: '0 2px', fontFamily: font }}
        >
          {expanded ? '▲' : '▼'}
        </button>
      </div>


      {expanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {brief.points?.length > 0 ? brief.points.map((pt, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, fontSize: 10, color: t.textSecondary, lineHeight: 1.45 }}>
              <span style={{ color: t.textTertiary, flex: '0 0 auto' }}>·</span>
              <span>{pt}</span>
            </div>
          )) : (
            <div style={{ fontSize: 10, color: t.textTertiary }}>No data available</div>
          )}
          {(brief.gainers?.length > 0 || brief.losers?.length > 0) && (
            <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
              {brief.gainers?.slice(0, 3).map(g => (
                <span key={g.symbol} style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: 'rgba(74,222,128,0.15)', color: '#4ade80' }}>
                  {g.symbol} +{Math.abs(g.change).toFixed(1)}%
                </span>
              ))}
              {brief.losers?.slice(0, 3).map(l => (
                <span key={l.symbol} style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: 'rgba(248,113,113,0.15)', color: '#f87171' }}>
                  {l.symbol} -{Math.abs(l.change).toFixed(1)}%
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
