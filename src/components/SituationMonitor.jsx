import { useEffect, useRef, useState } from 'react';
import { useSituation } from '../hooks/useSituation';
import { Card, BlinkingDot } from './ui';

const CONGESTION_LEVELS = { heavy: 85, moderate: 55, clear: 15 };

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

export default function SituationMonitor({
  dark, t, font,
  sim = null,
  pmEdges = [],
  lastPmBetMap = {},
  trades = [],
  pmExits = 0,
}) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const [showPmEdges, setShowPmEdges] = useState(true);
  const [showTrades, setShowTrades] = useState(false);
  const [mapSelection, setMapSelection] = useState(null);

  const {
    activeCenter, selectedCity, setSelectedCity,
    worldCities, userLocation,
    flights, traffic, flightsLoading, trafficLoading, flightsError, trafficError,
    incidents, earthquakes, events, weatherAlerts,
  } = useSituation();

  // Initialize MapLibre
  useEffect(() => {
    let map;
    (async () => {
      try {
        const maplibregl = (await import('maplibre-gl')).default;
        await import('maplibre-gl/dist/maplibre-gl.css');
        if (!mapRef.current || mapInstanceRef.current) return;
        map = new maplibregl.Map({
          container: mapRef.current,
          style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
          center: [activeCenter.lon, activeCenter.lat],
          zoom: 8,
          attributionControl: false,
        });
        mapInstanceRef.current = map;
        map.addControl(new maplibregl.AttributionControl({ compact: true }));
      } catch (err) {
        console.warn('MapLibre init failed:', err.message);
      }
    })();
    return () => {
      if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fly to active center
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.flyTo({ center: [activeCenter.lon, activeCenter.lat], zoom: 8, duration: 1200 });
  }, [activeCenter.lat, activeCenter.lon]);

  // Update all markers (click/hover to inspect details)
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];
    (async () => {
      try {
        const maplibregl = (await import('maplibre-gl')).default;
        const mkEl = (style, title, data) => {
          const el = document.createElement('div');
          el.style.cssText = style;
          if (title) el.title = title;
          el.addEventListener('mouseenter', () => setMapSelection(data));
          el.addEventListener('click', (e) => {
            e.stopPropagation();
            setMapSelection(data);
          });
          return el;
        };

        // User pin (drop pin)
        if (userLocation?.lat != null && userLocation?.lon != null) {
          const locationData = {
            type: 'location',
            title: userLocation.city || 'Current location',
            subtitle: `${userLocation.lat.toFixed(4)}, ${userLocation.lon.toFixed(4)}`,
            level: 'local',
          };
          const pin = document.createElement('div');
          pin.style.cssText = `
            width:14px;height:14px;border-radius:50% 50% 50% 0;
            transform:rotate(-45deg);
            background:#3B82F6;
            border:2px solid rgba(255,255,255,0.8);
            box-shadow:0 0 0 0 rgba(59,130,246,0.55);
            animation:pulse-blue 2.2s infinite;
            cursor:pointer;
          `;
          pin.title = `You: ${locationData.title}`;
          pin.addEventListener('mouseenter', () => setMapSelection(locationData));
          pin.addEventListener('click', (e) => {
            e.stopPropagation();
            setMapSelection(locationData);
          });
          markersRef.current.push(
            new maplibregl.Marker({ element: pin }).setLngLat([userLocation.lon, userLocation.lat]).addTo(mapInstanceRef.current)
          );
        }

        // Flights — cyan pulses
        flights.slice(0, 50).forEach(f => {
          if (f.lon == null || f.lat == null) return;
          const callsign = f.callsign || f.icao24 || 'flight';
          const data = {
            type: 'flight',
            title: callsign,
            subtitle: f.altitude ? `FL${Math.round(f.altitude / 100)} • ${Math.round(f.velocity || 0)} kt` : 'altitude unknown',
            level: 'live',
          };
          const el = mkEl(
            'width:7px;height:7px;border-radius:50%;background:#64D2FF;opacity:0.92;box-shadow:0 0 0 0 rgba(100,210,255,0.5);animation:pulse-cyan 1.9s infinite;cursor:pointer;',
            callsign,
            data
          );
          markersRef.current.push(new maplibregl.Marker({ element: el }).setLngLat([f.lon, f.lat]).addTo(mapInstanceRef.current));
        });

        // Incidents — amber pulses
        incidents.forEach(inc => {
          if (inc.lon == null || inc.lat == null) return;
          const data = {
            type: 'incident',
            title: (inc.type || 'incident').toUpperCase(),
            subtitle: inc.description || 'No details',
            level: 'local',
          };
          const el = mkEl(
            'width:9px;height:9px;border-radius:50%;background:#FF9500;opacity:0.95;box-shadow:0 0 0 0 rgba(255,149,0,0.55);animation:pulse-amber 1.8s infinite;cursor:pointer;',
            inc.description || inc.type,
            data
          );
          markersRef.current.push(new maplibregl.Marker({ element: el }).setLngLat([inc.lon, inc.lat]).addTo(mapInstanceRef.current));
        });

        // Earthquakes — red pulses (size by magnitude)
        earthquakes.forEach(eq => {
          if (eq.lon == null || eq.lat == null) return;
          const size = Math.max(6, Math.min(20, eq.mag * 3));
          const data = {
            type: 'earthquake',
            title: `M${eq.mag?.toFixed?.(1) ?? eq.mag}`,
            subtitle: eq.place || 'Seismic event',
            level: eq.mag >= 6 ? 'critical' : eq.mag >= 4 ? 'elevated' : 'monitor',
          };
          const el = mkEl(
            `width:${size}px;height:${size}px;border-radius:50%;background:#FF3B30;opacity:0.82;cursor:pointer;border:1px solid rgba(255,59,48,0.55);box-shadow:0 0 0 0 rgba(255,59,48,0.5);animation:pulse-red 2s infinite;`,
            `M${eq.mag} — ${eq.place}`,
            data
          );
          markersRef.current.push(new maplibregl.Marker({ element: el }).setLngLat([eq.lon, eq.lat]).addTo(mapInstanceRef.current));
        });
      } catch { /* ignore maplibre errors */ }
    })();
  }, [flights, incidents, earthquakes, userLocation]);

  const nearbyFlights = flights.slice(0, 6);
  const congestion = traffic?.flow?.congestion ?? null;
  const tradeExits = trades.filter(tr => tr?.pnl).length;
  const significantQuakes = earthquakes.filter(e => e.mag >= 4);
  const cityList = userLocation
    ? [{ id: 'me', label: userLocation.city, lat: userLocation.lat, lon: userLocation.lon }, ...worldCities]
    : worldCities;

  return (
    <Card dark={dark} t={t} style={{ padding: '16px 20px' }}>
      <style>{`
        @keyframes pulse-blue { 0% { box-shadow:0 0 0 0 rgba(59,130,246,.55) } 70% { box-shadow:0 0 0 16px rgba(59,130,246,0) } 100% { box-shadow:0 0 0 0 rgba(59,130,246,0) } }
        @keyframes pulse-cyan { 0% { box-shadow:0 0 0 0 rgba(100,210,255,.5) } 70% { box-shadow:0 0 0 12px rgba(100,210,255,0) } 100% { box-shadow:0 0 0 0 rgba(100,210,255,0) } }
        @keyframes pulse-amber { 0% { box-shadow:0 0 0 0 rgba(255,149,0,.5) } 70% { box-shadow:0 0 0 12px rgba(255,149,0,0) } 100% { box-shadow:0 0 0 0 rgba(255,149,0,0) } }
        @keyframes pulse-red { 0% { box-shadow:0 0 0 0 rgba(255,59,48,.45) } 70% { box-shadow:0 0 0 16px rgba(255,59,48,0) } 100% { box-shadow:0 0 0 0 rgba(255,59,48,0) } }
      `}</style>

      {/* Weather alert banner */}
      {weatherAlerts.length > 0 && (
        <div style={{
          background: `${t.yellow}18`, border: `1px solid ${t.yellow}40`,
          borderRadius: 8, padding: '6px 12px', marginBottom: 10,
          fontSize: 10, color: t.yellow, fontFamily: font, lineHeight: 1.5,
        }}>
          {weatherAlerts[0].headline || `${weatherAlerts[0].event} — ${weatherAlerts[0].source}`}
          {weatherAlerts.length > 1 && <span style={{ color: t.textTertiary }}> +{weatherAlerts.length - 1} more</span>}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <BlinkingDot color={t.cyan} speed={3} />
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: t.text, fontFamily: font }}>
            Situation Monitor
          </span>
        </div>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {cityList.slice(0, 7).map(city => {
            const isSelected = selectedCity
              ? selectedCity.id === city.id
              : city.id === 'me' ? !!userLocation : !userLocation && city.id === worldCities[0].id;
            return (
              <button key={city.id} onClick={() => setSelectedCity(city.id === 'me' ? null : city)} style={{
                padding: '3px 8px', borderRadius: 12, fontSize: 10, fontWeight: 600,
                border: isSelected ? `1.5px solid ${t.cyan}` : `1px solid ${t.border}`,
                background: isSelected ? `${t.cyan}18` : 'transparent',
                color: isSelected ? t.cyan : t.textTertiary,
                cursor: 'pointer', fontFamily: font,
              }}>
                {city.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Macro rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: t.textSecondary, display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: t.red }}>AI Bubble</span>
          <span>Mag7 = 35% S&P 500</span>
        </div>
        <div style={{ fontSize: 11, color: t.textSecondary, display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: t.yellow }}>US Debt</span>
          <span>$36T / 120% GDP</span>
        </div>
        <div style={{ fontSize: 11, color: t.textSecondary, display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: t.cyan }}>BTC ETF</span>
          <span>+$40B inflow</span>
        </div>
        <div style={{ fontSize: 11, color: t.textSecondary, display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: t.green }}>Gold CB</span>
          <span>+1,037t reserves</span>
        </div>
      </div>

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

      {/* PM edges */}
      <div style={{ background: t.surface, borderRadius: 10, overflow: 'hidden', marginBottom: 10 }}>
        <button
          onClick={() => setShowPmEdges(!showPmEdges)}
          style={{ width: '100%', padding: '10px 12px', background: 'transparent', border: 'none', display: 'flex', justifyContent: 'space-between', fontFamily: font, fontSize: 11, color: t.textTertiary, cursor: 'pointer' }}
        >
          <span>polymarket edges ({pmEdges.length})</span>
          <span>{showPmEdges ? '−' : '+'}</span>
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

      {/* Trade log */}
      <div style={{ background: t.surface, borderRadius: 10, overflow: 'hidden', marginBottom: 12 }}>
        <button
          onClick={() => setShowTrades(!showTrades)}
          style={{ width: '100%', padding: '10px 12px', background: 'transparent', border: 'none', display: 'flex', justifyContent: 'space-between', fontFamily: font, fontSize: 11, color: t.textTertiary, cursor: 'pointer' }}
        >
          <span>trades ({tradeExits}) &middot; stocks: {tradeExits - pmExits} &middot; PM: {pmExits}</span>
          <span>{showTrades ? '−' : '+'}</span>
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

      {/* Map */}
      <div ref={mapRef} style={{
        width: '100%', height: 260, borderRadius: 12, overflow: 'hidden', marginBottom: 14,
        background: '#1a1a2e', border: `1px solid ${t.border}`, position: 'relative',
      }}>
        <div style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
          fontSize: 10, color: 'rgba(255,255,255,0.2)', fontFamily: font, pointerEvents: 'none', zIndex: 0,
        }}>
          {activeCenter.lat.toFixed(4)}, {activeCenter.lon.toFixed(4)}
        </div>
      </div>

      {/* Map selection detail */}
      {mapSelection && (
        <div style={{
          marginTop: -4,
          marginBottom: 12,
          border: `1px solid ${t.border}`,
          background: t.surface,
          borderRadius: 10,
          padding: '8px 10px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: t.text, fontFamily: font }}>{mapSelection.title}</div>
            <div style={{ fontSize: 9, color: t.textTertiary, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: font }}>{mapSelection.level}</div>
          </div>
          <div style={{ marginTop: 2, fontSize: 10, color: t.textSecondary, fontFamily: font }}>{mapSelection.subtitle}</div>
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
              <span style={{ color: t.textTertiary, fontFamily: font }}>{f.altitude ? `FL${Math.round(f.altitude / 100)}` : '—'}</span>
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
          {(traffic?.incidents ?? []).slice(0, 3).map((inc, i) => (
            <div key={i} style={{ fontSize: 9, color: t.textTertiary, fontFamily: font, padding: '2px 0' }}>
              {inc.type}: {inc.description || 'No details'}
            </div>
          ))}
        </div>
      </div>

      {/* Earthquakes (significant only, M4+) */}
      {significantQuakes.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: t.red, fontFamily: font, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            Seismic ({significantQuakes.length} M4+)
          </div>
          {significantQuakes.slice(0, 4).map((eq, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, fontSize: 10, padding: '2px 0', fontFamily: font }}>
              <span style={{ color: eq.mag >= 6 ? t.red : t.yellow, fontWeight: 700, minWidth: 28 }}>M{eq.mag.toFixed(1)}</span>
              <span style={{ color: t.textSecondary }}>{eq.place}</span>
            </div>
          ))}
        </div>
      )}

      {/* Global events panel */}
      {events.length > 0 && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: t.textSecondary, fontFamily: font, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            Global Events
          </div>
          <div style={{ maxHeight: 100, overflowY: 'auto' }}>
            {events.slice(0, 6).map((ev, i) => (
              <div key={i} style={{ fontSize: 9, color: t.textTertiary, fontFamily: font, padding: '2px 0', borderBottom: `1px solid ${t.border}`, lineHeight: 1.4 }}>
                <span style={{ color: t.textSecondary }}>{ev.country ? `[${ev.country}] ` : ''}</span>
                {ev.title}
              </div>
            ))}
          </div>
        </div>
      )}

    </Card>
  );
}
