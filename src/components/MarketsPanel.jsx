import { useState, useMemo } from 'react';
import { formatCurrency } from '../utils/formatting';
import StockDetail from './StockDetail';

const SORT_OPTIONS = [
  { key: 'symbol', label: 'Symbol' },
  { key: 'price', label: 'Price' },
  { key: 'changePercent', label: '% Change' },
];

const COMMODITY_KEYS = ['gold', 'silver', 'platinum', 'palladium', 'copper', 'oil', 'natgas'];
const INDEX_KEYS = ['nas100', 'us500', 'us30', 'dxy'];
const CRYPTO_KEYS = ['btc', 'eth'];

function getMarketStatus() {
  const now = new Date();
  const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const day = et.getDay();
  const minutes = et.getHours() * 60 + et.getMinutes();

  const isWeekday = day >= 1 && day <= 5;
  if (!isWeekday) return { label: 'Market Closed', color: '#8e8e93' };
  if (minutes >= 570 && minutes < 960) return { label: 'Market Open', color: '#30D158' };
  if (minutes >= 240 && minutes < 570) return { label: 'Pre-Market', color: '#FF9F0A' };
  if (minutes >= 960 && minutes < 1200) return { label: 'After Hours', color: '#FF9F0A' };
  return { label: 'Market Closed', color: '#8e8e93' };
}

function ChangePill({ value }) {
  const positive = value >= 0;
  const bg = positive ? '#30D158' : '#FF453A';
  const text = `${positive ? '+' : ''}${value.toFixed(2)}%`;
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 100,
      fontSize: 11, fontWeight: 600, background: bg, color: '#fff',
      whiteSpace: 'nowrap',
    }}>
      {text}
    </span>
  );
}

function MarketRow({ symbol, name, price, changePercent, isWatchlisted, onToggle, canToggle, t, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0',
        borderBottom: `1px solid ${t.border}`,
        cursor: 'pointer',
        transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
      }}
      onMouseEnter={e => e.currentTarget.style.transform = 'translateX(2px)'}
      onMouseLeave={e => e.currentTarget.style.transform = 'translateX(0)'}
    >
      {canToggle ? (
        <button
          aria-label={isWatchlisted ? `Remove ${symbol} from watchlist` : `Add ${symbol} to watchlist`}
          onClick={(e) => { e.stopPropagation(); onToggle(symbol); }}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            color: isWatchlisted ? '#FF9F0A' : t.textTertiary, fontSize: 14,
            transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
          onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.2)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
        >
          {isWatchlisted ? '\u2605' : '\u2606'}
        </button>
      ) : (
        <span style={{ width: 14 }} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: t.text }}>{symbol}</div>
        <div style={{ fontSize: 11, color: t.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: t.text }}>{formatCurrency(price)}</div>
        <ChangePill value={changePercent} />
      </div>
    </div>
  );
}

export default function MarketsPanel({ dark, t, stocks, liveAssets, watchlist, toggleSymbol, isAuthenticated }) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('changePercent');
  const [sortAsc, setSortAsc] = useState(false);
  const [selectedStock, setSelectedStock] = useState(null);
  const font = '-apple-system, BlinkMacSystemFont, system-ui, sans-serif';

  const status = getMarketStatus();

  const allItems = useMemo(() => {
    const items = [];

    // Stocks
    if (stocks) {
      Object.values(stocks).forEach(s => {
        if (!s.symbol || typeof s.price !== 'number') return;
        items.push({
          symbol: s.symbol,
          name: s.symbol,
          price: s.price,
          changePercent: s.changePercent || 0,
          kind: 'stock',
        });
      });
    }

    if (liveAssets) {
      const assetGroups = [
        [COMMODITY_KEYS, 'commodity'],
        [INDEX_KEYS, 'commodity'],
        [CRYPTO_KEYS, 'crypto'],
      ];
      for (const [keys, kind] of assetGroups) {
        for (const key of keys) {
          const a = liveAssets[key];
          if (!a || !a.spot) continue;
          items.push({
            symbol: a.name || key.toUpperCase(),
            name: a.full || key,
            price: a.spot,
            changePercent: a.chgPct || 0,
            kind,
          });
        }
      }
    }

    return items;
  }, [stocks, liveAssets]);

  const watchlistItems = useMemo(() => {
    if (!watchlist || watchlist.length === 0) return [];
    return allItems.filter(item => watchlist.includes(item.symbol));
  }, [allItems, watchlist]);

  const filtered = useMemo(() => {
    let list = search
      ? allItems.filter(item => {
          const q = search.toLowerCase();
          return item.symbol.toLowerCase().includes(q) || item.name.toLowerCase().includes(q);
        })
      : [...allItems];
    list.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'symbol') cmp = a.symbol.localeCompare(b.symbol);
      else if (sortKey === 'price') cmp = a.price - b.price;
      else cmp = a.changePercent - b.changePercent;
      return sortAsc ? cmp : -cmp;
    });
    return list;
  }, [allItems, search, sortKey, sortAsc]);

  const glass = {
    background: t.glass,
    backdropFilter: 'blur(20px) saturate(150%)',
    WebkitBackdropFilter: 'blur(20px) saturate(150%)',
    border: `1px solid ${t.cardBorder || t.border}`,
    borderRadius: 12,
  };

  return (
    <div style={{ padding: 16, fontFamily: font, maxHeight: '100%', overflow: 'auto' }}>
      {/* Market status + Search + Sort */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: status.color }} />
        <span style={{ fontSize: 11, color: t.textSecondary }}>{status.label}</span>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <input
          type="text"
          aria-label="Search markets"
          placeholder="Search markets..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            flex: 1, minWidth: 140, padding: '8px 12px', borderRadius: 8,
            border: `1px solid ${t.border}`, background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
            color: t.text, fontSize: 13, fontFamily: font, outline: 'none',
          }}
        />
        <select
          aria-label="Sort by"
          value={sortKey}
          onChange={e => setSortKey(e.target.value)}
          style={{
            padding: '8px 10px', borderRadius: 8, border: `1px solid ${t.border}`,
            background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
            color: t.text, fontSize: 12, fontFamily: font, cursor: 'pointer',
          }}
        >
          {SORT_OPTIONS.map(opt => (
            <option key={opt.key} value={opt.key}>{opt.label}</option>
          ))}
        </select>
        <button
          aria-label={sortAsc ? 'Sort ascending' : 'Sort descending'}
          onClick={() => setSortAsc(prev => !prev)}
          style={{
            padding: '8px 10px', borderRadius: 8, border: `1px solid ${t.border}`,
            background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
            color: t.textSecondary, fontSize: 12, fontWeight: 600, fontFamily: font,
            cursor: 'pointer',
            transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
          onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
        >
          {sortAsc ? 'ASC' : 'DESC'}
        </button>
      </div>

      {/* Watchlist */}
      {watchlistItems.length > 0 && (
        <div style={{ ...glass, padding: 14, marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: t.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
            Watchlist
          </div>
          {watchlistItems.map(item => (
            <MarketRow
              key={`wl-${item.symbol}`}
              symbol={item.symbol}
              name={item.name}
              price={item.price}
              changePercent={item.changePercent}
              isWatchlisted={true}
              onToggle={toggleSymbol}
              canToggle={isAuthenticated}
              t={t}
              onClick={() => setSelectedStock(item)}
            />
          ))}
        </div>
      )}

      {/* All Markets */}
      <div style={{ ...glass, padding: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: t.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
          All Markets ({filtered.length})
        </div>
        {filtered.length === 0 ? (
          <div style={{ padding: '20px 0', textAlign: 'center', color: t.textTertiary, fontSize: 13 }}>
            No results
          </div>
        ) : (
          filtered.map(item => (
            <MarketRow
              key={`${item.kind}-${item.symbol}`}
              symbol={item.symbol}
              name={item.name}
              price={item.price}
              changePercent={item.changePercent}
              isWatchlisted={watchlist?.includes(item.symbol)}
              onToggle={toggleSymbol}
              canToggle={isAuthenticated}
              t={t}
              onClick={() => setSelectedStock(item)}
            />
          ))
        )}
      </div>

      {selectedStock && (
        <StockDetail
          stock={selectedStock}
          onClose={() => setSelectedStock(null)}
          dark={dark}
          t={t}
        />
      )}
    </div>
  );
}
