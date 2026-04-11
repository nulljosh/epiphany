import { useEffect, useRef, useState, useMemo } from 'react';
import { useSituation } from '../hooks/useSituation';
import { Card, BlinkingDot } from './ui';

const CONGESTION_LEVELS = { heavy: 85, moderate: 55, clear: 15 };
const SEVERITY = { critical: { label: 'CRITICAL', color: '#ef4444' }, elevated: { label: 'ELEVATED', color: '#f59e0b' }, monitor: { label: 'MONITOR', color: '#3b82f6' }, info: { label: 'INFO', color: '#6b7280' } };

function SeverityBadge({ level }) {
  const s = SEVERITY[level] || SEVERITY.info;
  return (
    <span style={{
      fontSize: 8, fontWeight: 700, letterSpacing: '0.08em',
      padding: '1px 5px', borderRadius: 3,
      background: `${s.color}20`, color: s.color,
      textTransform: 'uppercase',
    }}>{s.label}</span>
  );
}

function DetectionCard({ type, title, detail, severity, time, color, t, font, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', gap: 8, padding: '8px 10px',
        borderLeft: `2px solid ${color || SEVERITY[severity]?.color || t.border}`,
        background: t.surface, borderRadius: '0 6px 6px 0',
        marginBottom: 4, cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
      }}
      onMouseEnter={e => onClick && (e.currentTarget.style.transform = 'translateX(2px)')}
      onMouseLeave={e => onClick && (e.currentTarget.style.transform = 'translateX(0)')}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: t.textTertiary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{type}</span>
          <SeverityBadge level={severity} />
        </div>
        <div style={{ fontSize: 11, color: t.text, fontWeight: 500, lineHeight: 1.3 }}>{title}</div>
        {detail && <div style={{ fontSize: 10, color: t.textTertiary, marginTop: 2, lineHeight: 1.3 }}>{detail}</div>}
      </div>
      {time && <span style={{ fontSize: 9, color: t.textTertiary, flexShrink: 0, whiteSpace: 'nowrap' }}>{time}</span>}
    </div>
  );
}

function SourceHealth({ label, lastUpdate, error, t }) {
  const stale = lastUpdate ? (Date.now() - lastUpdate) > 300000 : true;
  const color = error ? '#ef4444' : stale ? '#f59e0b' : '#30d158';
  const age = lastUpdate ? `${Math.round((Date.now() - lastUpdate) / 60000)}m` : '--';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <div style={{ width: 5, height: 5, borderRadius: '50%', background: color }} />
      <span style={{ fontSize: 9, color: t.textTertiary }}>{label}</span>
      <span style={{ fontSize: 8, color: t.textTertiary }}>{age}</span>
    </div>
  );
}

function CongestionBar({ value, t, font }) {
  const pct = CONGESTION_LEVELS[value] ?? 0;
  const color = pct > 70 ? t.red : pct > 40 ? t.yellow : t.green;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 4, borderRadius: 2, background: t.border, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, transition: 'width 0.4s' }} />
      </div>
      <span style={{ fontSize: 10, color, fontFamily: font, fontWeight: 700, minWidth: 48, textTransform: 'capitalize' }}>
        {value ?? 'unknown'}
      </span>
    </div>
  );
}

function TimelineEntry({ icon, color, label, time, t }) {
  return (
    <div style={{ display: 'flex', gap: 8, padding: '4px 0', position: 'relative' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 12 }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
        <div style={{ flex: 1, width: 1, background: t.border, minHeight: 8 }} />
      </div>
      <div style={{ flex: 1, minWidth: 0, paddingBottom: 4 }}>
        <div style={{ fontSize: 10, color: t.text, lineHeight: 1.3 }}>{label}</div>
        {time && <div style={{ fontSize: 9, color: t.textTertiary, marginTop: 1 }}>{time}</div>}
      </div>
    </div>
  );
}

export default function SituationMonitor({
  dark, t, font,
  sim = null,
  pmEdges = [],
  lastPmBetMap = {},
  trades = [],
  pmExits = 0,
  pmWhales = null,
  mapFlyTo,
  mapLayers,
  alerts = [],
}) {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 600);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 600);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  const [showPmEdges, setShowPmEdges] = useState(true);
  const [showWhales, setShowWhales] = useState(false);
  const [showTrades, setShowTrades] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const [showDetections, setShowDetections] = useState(true);
  const initialFlyDone = useRef(false);
  const loadTimestamps = useRef({ flights: null, traffic: null, earthquakes: null, events: null });

  const [tallyPayday, setTallyPayday] = useState(null);

  const {
    activeCenter,
    worldCities, userLocation,
    flights, traffic, flightsLoading, trafficLoading, flightsError, trafficError,
    incidents, earthquakes, events, weatherAlerts, macro,
  } = useSituation();

  useEffect(() => {
    fetch('/api/tally?action=next-payment')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.nextPayment) setTallyPayday(d.nextPayment); })
      .catch(() => {});
  }, []);

  // Track data freshness per source
  useEffect(() => { if (flights.length > 0) loadTimestamps.current.flights = Date.now(); }, [flights]);
  useEffect(() => { if (traffic) loadTimestamps.current.traffic = Date.now(); }, [traffic]);
  useEffect(() => { if (earthquakes.length > 0) loadTimestamps.current.earthquakes = Date.now(); }, [earthquakes]);
  useEffect(() => { if (events.length > 0) loadTimestamps.current.events = Date.now(); }, [events]);

  // Stable ref for mapFlyTo to avoid busting detections memo
  const mapFlyToRef = useRef(mapFlyTo);
  useEffect(() => { mapFlyToRef.current = mapFlyTo; }, [mapFlyTo]);

  const nearbyFlights = flights.slice(0, isMobile ? 3 : 6);
  const congestion = traffic?.flow?.congestion ?? null;
  const tradeExits = trades.filter(tr => tr?.pnl).length;
  const significantQuakes = useMemo(() => earthquakes.filter(e => e.mag >= 4), [earthquakes]);

  // Build detection feed from all sources
  const detections = useMemo(() => {
    const items = [];

    // Weather alerts -> critical
    weatherAlerts.forEach((wa, i) => {
      items.push({
        id: `weather-${i}`,
        type: 'weather',
        severity: wa.severity === 'Extreme' || wa.severity === 'Severe' ? 'critical' : 'elevated',
        title: wa.headline || wa.event || 'Weather Alert',
        detail: wa.source,
        color: '#f59e0b',
        time: wa.effective ? new Date(wa.effective).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null,
        ts: wa.effective ? new Date(wa.effective).getTime() : Date.now(),
      });
    });

    // Significant earthquakes -> critical/elevated
    significantQuakes.forEach((eq, i) => {
      items.push({
        id: `quake-${i}`,
        type: 'seismic',
        severity: eq.mag >= 6 ? 'critical' : 'elevated',
        title: `M${eq.mag.toFixed(1)} -- ${eq.place || 'Earthquake'}`,
        detail: `Depth: ${eq.depth || '?'}km`,
        color: '#ef4444',
        time: eq.time ? new Date(eq.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null,
        ts: eq.time || Date.now(),
        onClick: () => mapFlyToRef.current?.({ center: [eq.lon, eq.lat], zoom: 8, duration: 1200 }),
      });
    });

    // Triggered price alerts
    (alerts || []).filter(a => a.triggered).forEach((a, i) => {
      items.push({
        id: `alert-${a.id || i}`,
        type: 'detection',
        severity: 'elevated',
        title: `${a.symbol} hit $${a.triggeredPrice?.toFixed(2)} (${a.direction} $${a.targetPrice.toFixed(2)})`,
        color: '#30d158',
        ts: a.triggeredAt || Date.now(),
      });
    });

    // Traffic incidents
    (traffic?.incidents || []).slice(0, 3).forEach((inc, i) => {
      items.push({
        id: `traffic-${i}`,
        type: 'traffic',
        severity: 'monitor',
        title: inc.description || inc.type || 'Traffic incident',
        color: '#f97316',
        ts: Date.now(),
      });
    });

    // Sort by severity then time
    const sevOrder = { critical: 0, elevated: 1, monitor: 2, info: 3 };
    items.sort((a, b) => (sevOrder[a.severity] ?? 9) - (sevOrder[b.severity] ?? 9) || (b.ts || 0) - (a.ts || 0));

    return items;
  }, [weatherAlerts, significantQuakes, alerts, traffic]);

  // Build unified timeline
  const timelineEntries = useMemo(() => {
    const entries = [];

    earthquakes.slice(0, 6).forEach(eq => {
      entries.push({
        label: `M${eq.mag?.toFixed?.(1)} ${eq.place || 'Earthquake'}`,
        color: '#ef4444',
        ts: eq.time || Date.now(),
        time: eq.time ? new Date(eq.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null,
      });
    });

    events.slice(0, 6).forEach(ev => {
      entries.push({
        label: `${ev.country ? `[${ev.country}] ` : ''}${ev.title}`,
        color: '#22d3ee',
        ts: ev.dateAdded ? new Date(ev.dateAdded).getTime() : Date.now(),
        time: ev.dateAdded ? new Date(ev.dateAdded).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null,
      });
    });

    trades.slice(-8).filter(tr => tr?.pnl).forEach(tr => {
      const pnl = parseFloat(tr.pnl);
      entries.push({
        label: `${tr.type} ${tr.sym} ${pnl >= 0 ? '+' : ''}${tr.pnl}`,
        color: pnl >= 0 ? '#30d158' : '#ef4444',
        ts: tr.ts || Date.now(),
        time: tr.ts ? new Date(tr.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null,
      });
    });

    weatherAlerts.forEach(wa => {
      entries.push({
        label: wa.headline || wa.event || 'Weather alert',
        color: '#f59e0b',
        ts: wa.effective ? new Date(wa.effective).getTime() : Date.now(),
        time: wa.effective ? new Date(wa.effective).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null,
      });
    });

    entries.sort((a, b) => (b.ts || 0) - (a.ts || 0));
    return entries.slice(0, 15);
  }, [earthquakes, events, trades, weatherAlerts]);

  useEffect(() => {
    if (!initialFlyDone.current && mapFlyTo && activeCenter) {
      mapFlyTo({
        center: [activeCenter.lon, activeCenter.lat],
        zoom: 10,
        duration: 1200,
      });
      initialFlyDone.current = true;
    }
  }, [activeCenter, mapFlyTo]);

  return (
    <Card dark={dark} t={t} style={{ padding: '16px 20px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <BlinkingDot color={t.cyan} speed={3} />
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: t.text, fontFamily: font }}>
            Situation Monitor
          </span>
        </div>
        {detections.length > 0 && (
          <span style={{
            fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 100,
            background: SEVERITY[detections[0].severity]?.color || t.border,
            color: '#fff',
          }}>
            {detections.length}
          </span>
        )}
      </div>

      {/* Source health strip — hidden on mobile */}
      {!isMobile && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
          <SourceHealth label="flights" lastUpdate={loadTimestamps.current.flights} error={flightsError} t={t} />
          <SourceHealth label="traffic" lastUpdate={loadTimestamps.current.traffic} error={trafficError} t={t} />
          <SourceHealth label="seismic" lastUpdate={loadTimestamps.current.earthquakes} t={t} />
          <SourceHealth label="events" lastUpdate={loadTimestamps.current.events} t={t} />
        </div>
      )}

      {/* Detections feed */}
      {detections.length > 0 && (
        <div style={{ background: t.surface, borderRadius: 10, overflow: 'hidden', marginBottom: 10 }}>
          <button
            onClick={() => setShowDetections(!showDetections)}
            style={{ width: '100%', padding: '10px 12px', background: 'transparent', border: 'none', display: 'flex', justifyContent: 'space-between', fontFamily: font, fontSize: 11, color: t.textTertiary, cursor: 'pointer' }}
          >
            <span>detections ({detections.length})</span>
            <span>{showDetections ? '\u2212' : '+'}</span>
          </button>
          {showDetections && (
            <div style={{ padding: '0 8px 8px', maxHeight: 220, overflowY: 'auto' }}>
              {detections.map(d => (
                <DetectionCard key={d.id} {...d} t={t} font={font} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Macro summary */}
      {macro.length > 0 && (() => {
        const byId = Object.fromEntries(macro.map(m => [m.id, m]));
        const fmt = (m) => m ? `${m.value}${m.unit === '%' ? '%' : ''}` : 'n/a';
        const dir = (m) => m?.change > 0 ? 'up' : m?.change < 0 ? 'down' : 'flat';
        const pct = (m) => m ? `${m.change > 0 ? '+' : ''}${m.changePercent}%` : '';
        const fedFunds = byId.fedFunds || byId.fed_funds || macro.find(m => /fed/i.test(m.name));
        const gdp = byId.gdp || macro.find(m => /gdp/i.test(m.name));
        const unemployment = byId.unemployment || macro.find(m => /unemploy/i.test(m.name));
        const cpi = byId.cpi || byId.inflation || macro.find(m => /cpi|inflation/i.test(m.name));
        const lines = [];
        if (fedFunds) lines.push(`Fed funds rate at ${fmt(fedFunds)} (${pct(fedFunds)}).`);
        if (gdp) lines.push(`GDP growth ${dir(gdp)} at ${fmt(gdp)}.`);
        if (cpi) lines.push(`CPI at ${fmt(cpi)} (${pct(cpi)}).`);
        if (unemployment) lines.push(`Unemployment at ${fmt(unemployment)}.`);
        const remaining = macro.filter(m => m !== fedFunds && m !== gdp && m !== cpi && m !== unemployment).slice(0, 2);
        remaining.forEach(m => lines.push(`${m.name} at ${fmt(m)} (${pct(m)}).`));
        return (
          <p style={{ fontSize: 11, color: t.textSecondary, lineHeight: 1.5, margin: '0 0 10px 0' }}>
            {lines.join(' ')}
          </p>
        );
      })()}

      {sim && (
        <>
          <div style={{ height: 1, background: t.border, marginBottom: 12 }} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.08em', color: t.textTertiary, marginBottom: 3 }}>EQUITY</div>
              <div style={{ fontSize: 14, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{sim.equity}</div>
            </div>
            <div>
              <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.08em', color: t.textTertiary, marginBottom: 3 }}>P&amp;L</div>
              <div style={{ fontSize: 14, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: sim.pnlPositive ? t.green : t.red }}>
                {sim.pnl}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.08em', color: t.textTertiary, marginBottom: 3 }}>WIN RATE</div>
              <div style={{ fontSize: 14, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{sim.winRate}</div>
            </div>
            <div>
              <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.08em', color: t.textTertiary, marginBottom: 3 }}>TRADES</div>
              <div style={{ fontSize: 14, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{sim.trades}</div>
            </div>
            {sim.position && (
              <div style={{ gridColumn: '1 / -1' }}>
                <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.08em', color: t.textTertiary, marginBottom: 3 }}>POSITION</div>
                <div style={{ fontSize: 12, fontWeight: 600 }}>
                  <span style={{ color: sim.position.color }}>{sim.position.sym}</span>
                  <span style={{ color: t.textSecondary, marginLeft: 6 }}>
                    ${sim.position.entry} &middot; {sim.position.unrealized} unrealized
                  </span>
                </div>
              </div>
            )}
            <div>
              <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.08em', color: t.textTertiary, marginBottom: 3 }}>RUNTIME</div>
              <div style={{ fontSize: 14, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{sim.runtime}</div>
            </div>
            {sim.allTime && (
              <div>
                <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.08em', color: t.textTertiary, marginBottom: 3 }}>ALL-TIME</div>
                <div style={{ fontSize: 14, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{sim.allTime}</div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Tally payday */}
      {tallyPayday && (
        <div style={{ background: t.surface, borderRadius: 10, padding: '10px 12px', marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 10, color: t.textTertiary, fontFamily: font }}>next payday</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: tallyPayday.daysUntil <= 3 ? t.green : t.text, fontFamily: font }}>
            {tallyPayday.daysUntil === 0 ? 'today' : tallyPayday.daysUntil === 1 ? 'tomorrow' : `${tallyPayday.daysUntil}d`}
            <span style={{ fontSize: 9, color: t.textTertiary, marginLeft: 6 }}>{tallyPayday.date}</span>
          </span>
        </div>
      )}

      {/* PM edges */}
      <div style={{ background: t.surface, borderRadius: 10, overflow: 'hidden', marginBottom: 10 }}>
        <button
          onClick={() => setShowPmEdges(!showPmEdges)}
          style={{ width: '100%', padding: '10px 12px', background: 'transparent', border: 'none', display: 'flex', justifyContent: 'space-between', fontFamily: font, fontSize: 11, color: t.textTertiary, cursor: 'pointer' }}
        >
          <span>polymarket edges ({pmEdges.length})</span>
          <span>{showPmEdges ? '\u2212' : '+'}</span>
        </button>
        {showPmEdges && (
          <div style={{ padding: '0 12px 12px', maxHeight: 180, overflowY: 'auto' }}>
            {pmEdges.length === 0 ? (
              <div style={{ color: t.textTertiary, fontSize: 11, textAlign: 'center', padding: 8 }}>no edges &gt;85%</div>
            ) : pmEdges.map((m, i) => {
              const isYes = m.probability >= 0.85;
              const dispProb = isYes ? m.probability : 1 - m.probability;
              const betTs = lastPmBetMap[m.id || m.slug];
              const msSinceBet = betTs ? Date.now() - betTs : null;
              return (
                <div key={m.id || i} style={{ display: 'flex', flexDirection: 'column', gap: 3, padding: '6px 0', borderBottom: `1px solid ${t.border}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
                    <span style={{ fontSize: 10, color: t.text, flex: 1, lineHeight: 1.3 }}>{m.question?.length > 60 ? `${m.question.slice(0, 60)}...` : m.question}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: isYes ? t.green : t.red, whiteSpace: 'nowrap' }}>
                      {isYes ? 'YES' : 'NO'} {(dispProb * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <div style={{ flex: 1, height: 3, background: t.border, borderRadius: 2 }}>
                      <div style={{ width: `${dispProb * 100}%`, height: '100%', background: isYes ? t.green : t.red, borderRadius: 2 }} />
                    </div>
                    <span style={{ fontSize: 9, color: t.textTertiary }}>Vol ${((m.volume24h || 0) / 1000).toFixed(0)}K</span>
                    {betTs && <span style={{ fontSize: 9, color: t.cyan }}>bet {msSinceBet < 60000 ? `${Math.round(msSinceBet / 1000)}s` : `${Math.round(msSinceBet / 60000)}m`} ago</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Whale activity */}
      {pmWhales && pmWhales.recentMoves?.length > 0 && (
        <div style={{ background: t.surface, borderRadius: 10, overflow: 'hidden', marginBottom: 10 }}>
          <button
            onClick={() => setShowWhales(!showWhales)}
            style={{ width: '100%', padding: '10px 12px', background: 'transparent', border: 'none', display: 'flex', justifyContent: 'space-between', fontFamily: font, fontSize: 11, color: t.textTertiary, cursor: 'pointer' }}
          >
            <span>whale activity ({pmWhales.totalWhaleTrades})</span>
            <span>{showWhales ? '\u2212' : '+'}</span>
          </button>
          {showWhales && (
            <div style={{ padding: '0 12px 12px', maxHeight: 200, overflowY: 'auto' }}>
              {pmWhales.recentMoves.map((move, i) => (
                <div key={move.id || i} style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '5px 0', borderBottom: `1px solid ${t.border}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, color: t.textTertiary, fontFamily: 'monospace' }}>{move.makerShort}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: move.side === 'BUY' ? t.green : t.red }}>
                      {move.side} ${move.usdValue.toLocaleString()}
                    </span>
                  </div>
                  {move.marketQuestion && (
                    <div style={{ fontSize: 10, color: t.text, lineHeight: 1.3 }}>
                      {move.marketQuestion.length > 55 ? `${move.marketQuestion.slice(0, 55)}...` : move.marketQuestion}
                    </div>
                  )}
                </div>
              ))}
              {pmWhales.topTraders?.length > 0 && (
                <div style={{ marginTop: 8, borderTop: `1px solid ${t.border}`, paddingTop: 8 }}>
                  <div style={{ fontSize: 9, color: t.textTertiary, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>top wallets</div>
                  {pmWhales.topTraders.slice(0, 5).map((trader, i) => (
                    <div key={trader.address || i} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 10 }}>
                      <span style={{ color: t.text, fontFamily: 'monospace' }}>{trader.shortAddress}</span>
                      <span style={{ color: t.textSecondary }}>{trader.tradeCount} trades &middot; ${(trader.totalVolume / 1000).toFixed(0)}K</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Trade log */}
      <div style={{ background: t.surface, borderRadius: 10, overflow: 'hidden', marginBottom: 10 }}>
        <button
          onClick={() => setShowTrades(!showTrades)}
          style={{ width: '100%', padding: '10px 12px', background: 'transparent', border: 'none', display: 'flex', justifyContent: 'space-between', fontFamily: font, fontSize: 11, color: t.textTertiary, cursor: 'pointer' }}
        >
          <span>trades ({tradeExits}) &middot; stocks: {tradeExits - pmExits} &middot; PM: {pmExits}</span>
          <span>{showTrades ? '\u2212' : '+'}</span>
        </button>
        {showTrades && (
          <div style={{ padding: '0 12px 12px', maxHeight: 160, overflow: 'auto' }}>
            {trades.length === 0 ? (
              <div style={{ color: t.textTertiary, fontSize: 12, textAlign: 'center', padding: 8 }}>waiting...</div>
            ) : (
              [...trades].reverse().slice(0, 20).map((tr, i) => {
                const pnl = tr.pnl ? parseFloat(tr.pnl) : null;
                return (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '4px 0', borderBottom: `1px solid ${t.border}` }}>
                    <span style={{ color: tr.type === 'BUY' ? t.accent : tr.type?.startsWith('PM_') ? t.cyan : pnl >= 0 ? t.green : t.red }}>
                      {tr.type} {tr.sym}
                    </span>
                    {pnl != null && <span style={{ color: pnl >= 0 ? t.green : t.red }}>{pnl >= 0 ? '+' : ''}{tr.pnl}</span>}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Event Timeline */}
      {timelineEntries.length > 0 && (
        <div style={{ background: t.surface, borderRadius: 10, overflow: 'hidden', marginBottom: 10 }}>
          <button
            onClick={() => setShowTimeline(!showTimeline)}
            style={{ width: '100%', padding: '10px 12px', background: 'transparent', border: 'none', display: 'flex', justifyContent: 'space-between', fontFamily: font, fontSize: 11, color: t.textTertiary, cursor: 'pointer' }}
          >
            <span>timeline ({timelineEntries.length})</span>
            <span>{showTimeline ? '\u2212' : '+'}</span>
          </button>
          {showTimeline && (
            <div style={{ padding: '0 12px 8px', maxHeight: 200, overflowY: 'auto' }}>
              {timelineEntries.map((entry, i) => (
                <TimelineEntry key={i} {...entry} t={t} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Flights + Traffic */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: t.textSecondary, fontFamily: font, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            Flights nearby {flightsLoading && <span style={{ color: t.textTertiary }}>(updating...)</span>}
          </div>
          {flightsError && <div style={{ fontSize: 10, color: t.red, fontFamily: font }}>{flightsError}</div>}
          {nearbyFlights.length === 0 && !flightsLoading && (
            <div style={{ fontSize: 10, color: t.textTertiary, fontFamily: font }}>No flights tracked</div>
          )}
          {nearbyFlights.map((f, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: `1px solid ${t.border}`, fontSize: 10 }}>
              <span style={{ fontWeight: 700, color: t.cyan, fontFamily: font }}>{f.callsign || f.icao24}</span>
              <span style={{ color: t.textTertiary, fontFamily: font }}>{f.altitude ? `FL${Math.round(f.altitude / 100)}` : '\u2014'}</span>
            </div>
          ))}
        </div>

        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: t.textSecondary, fontFamily: font, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            Traffic {trafficLoading && <span style={{ color: t.textTertiary }}>(loading...)</span>}
          </div>
          {trafficError && <div style={{ fontSize: 10, color: t.red, fontFamily: font }}>{trafficError}</div>}
          {congestion !== null && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 9, color: t.textTertiary, fontFamily: font, marginBottom: 4 }}>Congestion</div>
              <CongestionBar value={congestion} t={t} font={font} />
              {traffic?.flow?.source === 'estimated'
                ? <div style={{ fontSize: 9, color: t.textTertiary, fontFamily: font, marginTop: 4, fontStyle: 'italic' }}>EST</div>
                : traffic?.flow?.currentSpeed != null && (
                  <div style={{ fontSize: 9, color: t.textTertiary, fontFamily: font, marginTop: 4 }}>
                    {traffic.flow.currentSpeed} / {traffic.flow.freeFlowSpeed} km/h
                  </div>
                )
              }
            </div>
          )}
        </div>
      </div>

    </Card>
  );
}
