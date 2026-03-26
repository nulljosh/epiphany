import { useState, useEffect, useRef, useMemo, useCallback } from 'react';

const COMMANDS = [
  { id: 'dark-mode', label: 'Toggle Dark Mode', category: 'command', action: 'toggleDark' },
  { id: 'toggle-flights', label: 'Toggle Flights Layer', category: 'command', action: 'toggleLayer', layer: 'flights' },
  { id: 'toggle-earthquakes', label: 'Toggle Earthquakes Layer', category: 'command', action: 'toggleLayer', layer: 'earthquakes' },
  { id: 'toggle-news', label: 'Toggle News Layer', category: 'command', action: 'toggleLayer', layer: 'news' },
  { id: 'toggle-traffic', label: 'Toggle Traffic Layer', category: 'command', action: 'toggleLayer', layer: 'traffic' },
  { id: 'toggle-predictions', label: 'Toggle Predictions Layer', category: 'command', action: 'toggleLayer', layer: 'predictions' },
  { id: 'toggle-weather', label: 'Toggle Weather Layer', category: 'command', action: 'toggleLayer', layer: 'weather' },
  { id: 'toggle-heatmap', label: 'Toggle Heat Map', category: 'command', action: 'toggleLayer', layer: 'heatmap' },
  { id: 'show-markets', label: 'Show Markets', category: 'command', action: 'tab', tab: 'markets' },
  { id: 'show-portfolio', label: 'Show Portfolio', category: 'command', action: 'tab', tab: 'portfolio' },
  { id: 'show-situation', label: 'Show Situation Monitor', category: 'command', action: 'tab', tab: 'situation' },
  { id: 'show-people', label: 'Show People', category: 'command', action: 'tab', tab: 'people' },
  { id: 'show-settings', label: 'Show Settings', category: 'command', action: 'tab', tab: 'settings' },
];

const CITIES = [
  { label: 'Vancouver', lat: 49.2827, lon: -123.1207 },
  { label: 'Toronto', lat: 43.6532, lon: -79.3832 },
  { label: 'New York', lat: 40.7128, lon: -74.0060 },
  { label: 'Chicago', lat: 41.8781, lon: -87.6298 },
  { label: 'Los Angeles', lat: 34.0522, lon: -118.2437 },
  { label: 'London', lat: 51.5074, lon: -0.1278 },
  { label: 'Paris', lat: 48.8566, lon: 2.3522 },
  { label: 'Tokyo', lat: 35.6762, lon: 139.6503 },
  { label: 'Sydney', lat: -33.8688, lon: 151.2093 },
  { label: 'San Francisco', lat: 37.7749, lon: -122.4194 },
  { label: 'Miami', lat: 25.7617, lon: -80.1918 },
  { label: 'Seattle', lat: 47.6062, lon: -122.3321 },
  { label: 'Boston', lat: 42.3601, lon: -71.0589 },
  { label: 'Washington DC', lat: 38.9072, lon: -77.0369 },
  { label: 'Berlin', lat: 52.5200, lon: 13.4050 },
  { label: 'Dubai', lat: 25.2048, lon: 55.2708 },
  { label: 'Singapore', lat: 1.3521, lon: 103.8198 },
  { label: 'Hong Kong', lat: 22.3193, lon: 114.1694 },
  { label: 'Mumbai', lat: 19.0760, lon: 72.8777 },
  { label: 'Seoul', lat: 37.5665, lon: 126.9780 },
  { label: 'Montreal', lat: 45.5017, lon: -73.5673 },
  { label: 'Dallas', lat: 32.7767, lon: -96.7970 },
  { label: 'Denver', lat: 39.7392, lon: -104.9903 },
  { label: 'Houston', lat: 29.7604, lon: -95.3698 },
  { label: 'Atlanta', lat: 33.7490, lon: -84.3880 },
  { label: 'Phoenix', lat: 33.4484, lon: -112.0740 },
];

const CATEGORY_LABELS = {
  stock: 'Stocks',
  location: 'Locations',
  market: 'Markets',
  command: 'Commands',
  people: 'Recent People',
};

const CATEGORY_ORDER = ['stock', 'location', 'market', 'people', 'command'];

function fuzzyMatch(query, text) {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (t.startsWith(q)) return 3;
  if (t.includes(q)) return 2;
  // check if all chars appear in order
  let qi = 0;
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) qi++;
  }
  return qi === q.length ? 1 : 0;
}

export default function CommandBar({
  open,
  onClose,
  stocks = {},
  markets = [],
  onSelectStock,
  onSelectCity,
  onSelectMarket,
  onSelectPeople,
  onCommand,
  t,
  font,
}) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.trim();
    const hits = [];

    // Search stocks
    if (stocks) {
      Object.entries(stocks).forEach(([sym, data]) => {
        const name = data?.name || data?.shortName || sym;
        const symScore = fuzzyMatch(q, sym);
        const nameScore = fuzzyMatch(q, name);
        const score = Math.max(symScore, nameScore);
        if (score > 0) {
          hits.push({
            id: `stock-${sym}`,
            category: 'stock',
            label: sym,
            sublabel: name,
            detail: data?.price != null ? `$${Number(data.price).toFixed(2)}` : '',
            score,
            data: { symbol: sym },
          });
        }
      });
    }

    // Search cities
    CITIES.forEach(city => {
      const score = fuzzyMatch(q, city.label);
      if (score > 0) {
        hits.push({
          id: `city-${city.label}`,
          category: 'location',
          label: city.label,
          sublabel: `${city.lat.toFixed(2)}, ${city.lon.toFixed(2)}`,
          score,
          data: city,
        });
      }
    });

    // Search prediction markets
    if (markets) {
      markets.slice(0, 200).forEach((m, i) => {
        const question = m.question || m.title || '';
        const score = fuzzyMatch(q, question);
        if (score > 0) {
          const prob = typeof m.probability === 'number' ? m.probability : 0.5;
          hits.push({
            id: `market-${m.id || m.slug || i}`,
            category: 'market',
            label: question.length > 60 ? question.slice(0, 60) + '...' : question,
            sublabel: `${(prob * 100).toFixed(0)}% YES`,
            score,
            data: m,
          });
        }
      });
    }

    // Search recent people from localStorage
    try {
      const recent = JSON.parse(localStorage.getItem('monica-people-recent') || '[]');
      recent.forEach(name => {
        const score = fuzzyMatch(q, name);
        if (score > 0) {
          hits.push({
            id: `people-${name}`,
            category: 'people',
            label: name,
            sublabel: 'Recent search',
            score,
            data: { query: name },
          });
        }
      });
    } catch {}

    // Search commands
    COMMANDS.forEach(cmd => {
      const score = fuzzyMatch(q, cmd.label);
      if (score > 0) {
        hits.push({
          id: cmd.id,
          category: 'command',
          label: cmd.label,
          score,
          data: cmd,
        });
      }
    });

    // Sort by score desc, then alphabetically
    hits.sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));

    // Group by category, limit per category
    const grouped = {};
    hits.forEach(h => {
      if (!grouped[h.category]) grouped[h.category] = [];
      if (grouped[h.category].length < 5) grouped[h.category].push(h);
    });

    // Flatten in category order
    const flat = [];
    CATEGORY_ORDER.forEach(cat => {
      if (grouped[cat]?.length) {
        flat.push(...grouped[cat]);
      }
    });

    return flat;
  }, [query, stocks, markets]);

  const handleSelect = useCallback((item) => {
    if (!item) return;
    onClose();

    switch (item.category) {
      case 'stock':
        onSelectStock?.(item.data.symbol);
        break;
      case 'location':
        onSelectCity?.(item.data);
        break;
      case 'market':
        onSelectMarket?.(item.data);
        break;
      case 'people':
        onSelectPeople?.(item.data.query);
        break;
      case 'command':
        onCommand?.(item.data);
        break;
    }
  }, [onClose, onSelectStock, onSelectCity, onSelectMarket, onSelectPeople, onCommand]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, results.length - 1));
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (results[selectedIndex]) handleSelect(results[selectedIndex]);
    }
  }, [results, selectedIndex, handleSelect, onClose]);

  // Keep selectedIndex in bounds
  useEffect(() => {
    if (selectedIndex >= results.length) setSelectedIndex(Math.max(0, results.length - 1));
  }, [results.length, selectedIndex]);

  // Scroll selected into view
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  if (!open) return null;

  // Group results for section headers
  let lastCategory = null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 99999,
        background: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '15vh',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 520,
          background: t.cardBg || t.bg,
          border: `1px solid ${t.border}`,
          borderRadius: 14,
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
          animation: 'fadeUp 0.15s ease-out',
          margin: '0 16px',
        }}
      >
        {/* Search input */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '14px 16px',
          borderBottom: `1px solid ${t.border}`,
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.textTertiary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setSelectedIndex(0); }}
            onKeyDown={handleKeyDown}
            placeholder="Search stocks, cities, markets, commands..."
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: t.text, fontSize: 15, fontFamily: font || 'inherit',
            }}
          />
          <kbd style={{
            background: t.border, borderRadius: 4, padding: '2px 6px',
            fontSize: 10, color: t.textTertiary, fontFamily: 'monospace',
          }}>ESC</kbd>
        </div>

        {/* Results */}
        <div ref={listRef} style={{ maxHeight: 360, overflowY: 'auto', padding: '4px 0' }}>
          {query.trim() && results.length === 0 && (
            <div style={{ padding: '20px 16px', color: t.textTertiary, fontSize: 13, textAlign: 'center' }}>
              No results for "{query}"
            </div>
          )}
          {!query.trim() && (
            <div style={{ padding: '20px 16px', color: t.textTertiary, fontSize: 12, textAlign: 'center' }}>
              Type to search across all data
            </div>
          )}
          {results.map((item, idx) => {
            const showHeader = item.category !== lastCategory;
            lastCategory = item.category;
            const isSelected = idx === selectedIndex;

            return (
              <div key={item.id}>
                {showHeader && (
                  <div style={{
                    padding: '8px 16px 4px', fontSize: 9, fontWeight: 700,
                    letterSpacing: '0.1em', textTransform: 'uppercase',
                    color: t.textTertiary,
                  }}>
                    {CATEGORY_LABELS[item.category] || item.category}
                  </div>
                )}
                <div
                  data-index={idx}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 16px', cursor: 'pointer',
                    background: isSelected ? (t.surface || 'rgba(255,255,255,0.06)') : 'transparent',
                    borderRadius: 6, margin: '0 4px',
                    transition: 'background 0.1s',
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.label}
                    </div>
                    {item.sublabel && (
                      <div style={{ fontSize: 11, color: t.textSecondary, marginTop: 1 }}>
                        {item.sublabel}
                      </div>
                    )}
                  </div>
                  {item.detail && (
                    <span style={{ fontSize: 12, color: t.textSecondary, fontWeight: 600, flexShrink: 0, marginLeft: 8 }}>
                      {item.detail}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
