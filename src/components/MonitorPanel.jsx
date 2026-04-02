import { useState } from 'react';
import MarketsPanel from './MarketsPanel';
import SituationMonitor from './SituationMonitor';
import { SYSTEM_FONT as font } from '../utils/formatting';

export default function MonitorPanel({ dark, t, stocks, liveAssets, watchlist, toggleSymbol, isAuthenticated, initialSymbol, onConsumeInitialSymbol, sim, pmEdges, lastPmBetMap, trades, pmExits, mapFlyTo, mapLayers }) {
  const [subTab, setSubTab] = useState('situation');

  const pillStyle = (active) => ({
    padding: '4px 12px',
    borderRadius: 100,
    fontSize: 10,
    fontWeight: 600,
    fontFamily: font,
    cursor: 'pointer',
    background: active ? (dark ? 'rgba(255,255,255,0.92)' : 'rgba(15,23,42,0.92)') : 'transparent',
    color: active ? (dark ? '#020617' : '#ffffff') : t.textSecondary,
    border: active ? '1px solid transparent' : `1px solid ${t.border}`,
    boxShadow: 'none',
    transition: 'all 0.15s ease',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', gap: 4, padding: '8px 16px 4px', borderBottom: `1px solid ${t.border}` }}>
        <button onClick={() => setSubTab('situation')} style={pillStyle(subTab === 'situation')}>Situation</button>
        <button onClick={() => setSubTab('markets')} style={pillStyle(subTab === 'markets')}>Markets</button>
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {subTab === 'situation' && (
          <SituationMonitor
            dark={dark} t={t} font={font}
            sim={sim}
            pmEdges={pmEdges}
            lastPmBetMap={lastPmBetMap}
            trades={trades}
            pmExits={pmExits}
            mapFlyTo={mapFlyTo}
            mapLayers={mapLayers}
          />
        )}
        {subTab === 'markets' && (
          <MarketsPanel
            dark={dark} t={t} stocks={stocks} liveAssets={liveAssets}
            watchlist={watchlist} toggleSymbol={toggleSymbol}
            isAuthenticated={isAuthenticated}
            initialSymbol={initialSymbol}
            onConsumeInitialSymbol={onConsumeInitialSymbol}
          />
        )}
      </div>
    </div>
  );
}
