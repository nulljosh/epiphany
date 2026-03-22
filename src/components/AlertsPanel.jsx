import { useState, useMemo } from 'react';

const styles = {
  overlay: {
    position: 'fixed', inset: 0, background: 'var(--overlay, rgba(0,0,0,0.5))',
    zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  panel: {
    background: 'var(--bg-secondary, #18181b)', border: '1px solid var(--border, #27272a)',
    borderRadius: 12, width: '100%', maxWidth: 420, maxHeight: '80vh',
    overflow: 'auto', padding: 24, position: 'relative',
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20,
  },
  title: {
    fontSize: 18, fontWeight: 600, color: 'var(--text-primary, #f4f4f5)', margin: 0,
  },
  close: {
    background: 'none', border: 'none', color: 'var(--text-secondary, #a1a1aa)',
    fontSize: 20, cursor: 'pointer', padding: '4px 8px', lineHeight: 1,
  },
  form: {
    display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap',
  },
  input: {
    flex: 1, minWidth: 80, padding: '8px 12px', fontSize: 14,
    background: 'var(--bg, #09090b)', border: '1px solid var(--border, #27272a)',
    borderRadius: 6, color: 'var(--text-primary, #f4f4f5)', outline: 'none',
    fontFamily: 'inherit',
  },
  dirBtn: (active) => ({
    padding: '8px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
    border: '1px solid var(--border, #27272a)', borderRadius: 6,
    background: active ? 'var(--accent, #3B82F6)' : 'transparent',
    color: active ? '#fff' : 'var(--text-secondary, #a1a1aa)',
    fontFamily: 'inherit', transition: 'all 0.15s',
  }),
  addBtn: {
    padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
    background: 'var(--accent, #3B82F6)', color: '#fff', border: 'none',
    borderRadius: 6, fontFamily: 'inherit',
  },
  section: { marginBottom: 16 },
  sectionLabel: {
    fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em',
    color: 'var(--text-tertiary, #71717a)', marginBottom: 8,
  },
  alertRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '10px 0', borderBottom: '1px solid var(--border-muted, rgba(255,255,255,0.03))',
  },
  alertInfo: { flex: 1 },
  symbol: { fontWeight: 600, color: 'var(--text-primary, #f4f4f5)', fontSize: 14 },
  detail: { color: 'var(--text-secondary, #a1a1aa)', fontSize: 12 },
  deleteBtn: {
    background: 'none', border: 'none', color: 'var(--danger, #ef4444)',
    cursor: 'pointer', fontSize: 16, padding: '4px 8px',
  },
  triggered: {
    color: 'var(--success, #30d158)', fontSize: 12, fontWeight: 500,
  },
  empty: {
    color: 'var(--text-tertiary, #71717a)', fontSize: 13, padding: '12px 0',
  },
  clearBtn: {
    background: 'none', border: '1px solid var(--border, #27272a)',
    color: 'var(--text-secondary, #a1a1aa)', padding: '6px 12px',
    borderRadius: 6, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
  },
  suggestions: {
    position: 'absolute', background: 'var(--bg-secondary, #18181b)',
    border: '1px solid var(--border, #27272a)', borderRadius: 6,
    maxHeight: 120, overflowY: 'auto', zIndex: 10, width: 'calc(100% - 48px)',
    marginTop: 2,
  },
  suggestionItem: {
    padding: '6px 12px', fontSize: 13, cursor: 'pointer',
    color: 'var(--text-primary, #f4f4f5)',
  },
};

export default function AlertsPanel({ onClose, alerts, onAdd, onRemove, onClearTriggered, watchlist = [] }) {
  const [symbol, setSymbol] = useState('');
  const [price, setPrice] = useState('');
  const [direction, setDirection] = useState('above');
  const [showSuggestions, setShowSuggestions] = useState(false);

  const activeAlerts = useMemo(() => alerts.filter(a => !a.triggered), [alerts]);
  const triggeredAlerts = useMemo(() => alerts.filter(a => a.triggered), [alerts]);

  const filtered = useMemo(() => {
    if (!symbol.trim()) return [];
    const q = symbol.toUpperCase();
    return watchlist.filter(s => s.includes(q) && s !== q).slice(0, 6);
  }, [symbol, watchlist]);

  const handleAdd = () => {
    const sym = symbol.trim().toUpperCase();
    const p = parseFloat(price);
    if (!sym || isNaN(p) || p <= 0) return;
    onAdd(sym, p, direction);
    setSymbol('');
    setPrice('');
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.panel} onClick={e => e.stopPropagation()}>
        <div style={styles.header}>
          <h3 style={styles.title}>Price Alerts</h3>
          <button style={styles.close} onClick={onClose}>&times;</button>
        </div>

        <div style={styles.form}>
          <div style={{ position: 'relative', flex: 1, minWidth: 80 }}>
            <input
              style={styles.input}
              placeholder="Symbol"
              value={symbol}
              onChange={e => { setSymbol(e.target.value); setShowSuggestions(true); }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
            />
            {showSuggestions && filtered.length > 0 && (
              <div style={styles.suggestions}>
                {filtered.map(s => (
                  <div key={s} style={styles.suggestionItem}
                    onMouseDown={() => { setSymbol(s); setShowSuggestions(false); }}>
                    {s}
                  </div>
                ))}
              </div>
            )}
          </div>
          <input
            style={{ ...styles.input, maxWidth: 100 }}
            placeholder="Price"
            type="number"
            step="0.01"
            value={price}
            onChange={e => setPrice(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
          />
          <button style={styles.dirBtn(direction === 'above')} onClick={() => setDirection('above')}>Above</button>
          <button style={styles.dirBtn(direction === 'below')} onClick={() => setDirection('below')}>Below</button>
          <button style={styles.addBtn} onClick={handleAdd}>Add</button>
        </div>

        <div style={styles.section}>
          <div style={styles.sectionLabel}>Active ({activeAlerts.length})</div>
          {activeAlerts.length === 0 && <div style={styles.empty}>No active alerts</div>}
          {activeAlerts.map(a => (
            <div key={a.id} style={styles.alertRow}>
              <div style={styles.alertInfo}>
                <span style={styles.symbol}>{a.symbol}</span>{' '}
                <span style={styles.detail}>{a.direction} ${a.targetPrice.toFixed(2)}</span>
              </div>
              <button style={styles.deleteBtn} onClick={() => onRemove(a.id)}>&times;</button>
            </div>
          ))}
        </div>

        {triggeredAlerts.length > 0 && (
          <div style={styles.section}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={styles.sectionLabel}>Triggered ({triggeredAlerts.length})</div>
              <button style={styles.clearBtn} onClick={onClearTriggered}>Clear All</button>
            </div>
            {triggeredAlerts.map(a => (
              <div key={a.id} style={styles.alertRow}>
                <div style={styles.alertInfo}>
                  <span style={styles.symbol}>{a.symbol}</span>{' '}
                  <span style={styles.triggered}>
                    Hit ${a.triggeredPrice?.toFixed(2)} ({a.direction} ${a.targetPrice.toFixed(2)})
                  </span>
                </div>
                <button style={styles.deleteBtn} onClick={() => onRemove(a.id)}>&times;</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
