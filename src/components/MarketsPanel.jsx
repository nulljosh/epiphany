import { useState, useEffect, useMemo } from 'react';
import { formatCurrency } from '../utils/formatting';
import StockDetail from './StockDetail';
import useFearGreed from '../hooks/useFearGreed';
import { SECTOR_MAP, SECTOR_ORDER } from '../hooks/useStocks';

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

function getFearGreedColor(score) {
  if (score <= 24) return '#FF453A';
  if (score <= 44) return '#FF9F0A';
  if (score <= 55) return '#8e8e93';
  if (score <= 75) return '#30D158';
  return '#34C759';
}

function FearGreedGauge({ score, rating, t }) {
  if (score === null) return null;
  const color = getFearGreedColor(score);
  return (
    <a href="https://www.cnn.com/markets/fear-and-greed" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
      background: t.glass,
      backdropFilter: 'blur(20px) saturate(150%)',
      WebkitBackdropFilter: 'blur(20px) saturate(150%)',
      border: `1px solid ${t.cardBorder || t.border}`,
      borderRadius: 12, marginBottom: 12,
      cursor: 'pointer', transition: 'opacity 0.15s',
    }}
    onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
    onMouseLeave={e => e.currentTarget.style.opacity = '1'}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: t.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
          Fear & Greed
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ fontSize: 22, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>{score}</span>
          <span style={{ fontSize: 12, fontWeight: 600, color }}>{rating}</span>
        </div>
      </div>
      <div style={{ width: 80, height: 6, borderRadius: 3, background: 'rgba(128,128,128,0.2)', overflow: 'hidden' }}>
        <div style={{
          width: `${score}%`, height: '100%', borderRadius: 3, background: color,
          transition: 'width 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }} />
      </div>
    </div>
    </a>
  );
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <ChangePill value={changePercent} />
          {Math.abs(changePercent) >= 5 && (
            <span title="Anomaly: >5% move" style={{
              width: 6, height: 6, borderRadius: '50%',
              background: '#f59e0b',
              border: '1px solid rgba(245,158,11,0.4)',
              display: 'inline-block',
              animation: 'pulse-anomaly 1.8s infinite',
            }} />
          )}
        </div>
      </div>
      <a
        href={`https://www.tradingview.com/chart/?symbol=${encodeURIComponent(symbol)}`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={e => e.stopPropagation()}
        title={`View ${symbol} on TradingView`}
        style={{ color: t.textTertiary, flexShrink: 0, display: 'flex', alignItems: 'center', paddingLeft: 6 }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
        </svg>
      </a>
    </div>
  );
}

function SectorGroups({ filtered, watchlist, toggleSymbol, isAuthenticated, t, glass, search, onSelect }) {
  const [expanded, setExpanded] = useState({});
  const watchlistSet = useMemo(() => new Set(watchlist || []), [watchlist]);
  const sectors = useMemo(() => {
    const groups = {};
    for (const item of filtered) {
      const sector = SECTOR_MAP[item.symbol] || 'Other';
      if (!groups[sector]) groups[sector] = [];
      groups[sector].push(item);
    }
    // Sort each sector by changePercent desc
    for (const s of Object.keys(groups)) {
      groups[s].sort((a, b) => b.changePercent - a.changePercent);
    }
    return groups;
  }, [filtered]);

  const order = search ? Object.keys(sectors) : SECTOR_ORDER.filter(s => sectors[s]?.length > 0);
  const PREVIEW_COUNT = 5;

  return order.map(sector => {
    const items = sectors[sector] || [];
    if (items.length === 0) return null;
    const isExpanded = expanded[sector] || search;
    const shown = isExpanded ? items : items.slice(0, PREVIEW_COUNT);
    return (
      <div key={sector} style={{ ...glass, padding: 14, marginBottom: 8 }}>
        <div
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', marginBottom: 6 }}
          onClick={() => setExpanded(prev => ({ ...prev, [sector]: !prev[sector] }))}
        >
          <span style={{ fontSize: 11, fontWeight: 600, color: t.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {sector} ({items.length})
          </span>
          <span style={{ fontSize: 10, color: t.textTertiary }}>{isExpanded ? 'Collapse' : 'Show all'}</span>
        </div>
        {shown.map(item => (
          <MarketRow
            key={`${sector}-${item.symbol}`}
            symbol={item.symbol} name={item.name} price={item.price}
            changePercent={item.changePercent}
            isWatchlisted={watchlistSet.has(item.symbol)}
            onToggle={toggleSymbol} canToggle={isAuthenticated} t={t}
            onClick={() => onSelect(item)}
          />
        ))}
      </div>
    );
  });
}

export default function MarketsPanel({ dark, t, stocks, liveAssets, watchlist, toggleSymbol, isAuthenticated, initialSymbol, onConsumeInitialSymbol }) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('changePercent');
  const [sortAsc, setSortAsc] = useState(false);
  const [selectedStock, setSelectedStock] = useState(null);
  const { score: fgScore, rating: fgRating } = useFearGreed();

  // Open stock detail when navigated via command bar
  useEffect(() => {
    if (!initialSymbol || !stocks) return;
    const data = stocks[initialSymbol];
    setSelectedStock({ symbol: initialSymbol, name: data?.name || initialSymbol, price: data?.price ?? 0, changePercent: data?.changePercent ?? 0 });
    onConsumeInitialSymbol?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSymbol]);
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
          name: s.name || s.symbol,
          price: s.price,
          changePercent: s.changePercent || 0,
          kind: 'stock',
          avgVolume: s.avgVolume,
          marketCap: s.marketCap,
          peRatio: s.peRatio,
          eps: s.eps,
          beta: s.beta,
          yield: s.yield,
          open: s.open,
          high: s.high,
          low: s.low,
          prevClose: s.prevClose,
          volume: s.volume,
          week52High: s.week52High,
          week52Low: s.week52Low,
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

  const watchlistSet = useMemo(() => new Set(watchlist || []), [watchlist]);

  const watchlistItems = useMemo(() => {
    if (!watchlist || watchlist.length === 0) return [];
    return allItems.filter(item => watchlistSet.has(item.symbol));
  }, [allItems, watchlistSet]);

  const filtered = useMemo(() => {
    let list = allItems.filter(item => {
      if (watchlistSet.has(item.symbol)) return false;
      if (!search) return true;
      const q = search.toLowerCase();
      return item.symbol.toLowerCase().includes(q) || item.name.toLowerCase().includes(q);
    });
    list.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'symbol') cmp = a.symbol.localeCompare(b.symbol);
      else if (sortKey === 'price') cmp = a.price - b.price;
      else cmp = a.changePercent - b.changePercent;
      return sortAsc ? cmp : -cmp;
    });
    return list;
  }, [allItems, search, sortKey, sortAsc, watchlistSet]);

  const topMovers = useMemo(() => {
    if (filtered.length === 0) return [];
    const sorted = [...filtered].sort((a, b) => b.changePercent - a.changePercent);
    const top = sorted.slice(0, 5);
    const bottom = sorted.slice(-5).reverse();
    return [...top, ...bottom];
  }, [filtered]);

  const glass = {
    background: t.glass,
    backdropFilter: 'blur(20px) saturate(150%)',
    WebkitBackdropFilter: 'blur(20px) saturate(150%)',
    border: `1px solid ${t.cardBorder || t.border}`,
    borderRadius: 12,
  };

  return (
    <div style={{ padding: 16, fontFamily: font }}>
      {/* Sticky header: market status + search + sort stays visible while scrolling results */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 3,
        margin: '-16px -16px 12px -16px', padding: '12px 16px 10px',
        background: dark ? 'rgba(2,6,23,0.72)' : 'rgba(255,255,255,0.72)',
        backdropFilter: 'blur(20px) saturate(150%)',
        WebkitBackdropFilter: 'blur(20px) saturate(150%)',
        borderBottom: `1px solid ${t.border}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: status.color }} />
          <span style={{ fontSize: 11, color: t.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{status.label}</span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            type="text"
            aria-label="Search markets"
            placeholder="Search markets..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              flex: 1, minWidth: 140, padding: '9px 14px', borderRadius: 10,
              border: `1px solid ${t.border}`, background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
              color: t.text, fontSize: 13, fontFamily: font, outline: 'none',
              transition: 'border-color 0.15s',
            }}
            onFocus={e => e.currentTarget.style.borderColor = '#0071e3'}
            onBlur={e => e.currentTarget.style.borderColor = t.border}
          />
          <select
            aria-label="Sort by"
            value={sortKey}
            onChange={e => setSortKey(e.target.value)}
            style={{
              padding: '9px 12px', borderRadius: 10, border: `1px solid ${t.border}`,
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
              padding: '9px 12px', borderRadius: 10, border: `1px solid ${t.border}`,
              background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
              color: t.textSecondary, fontSize: 12, fontWeight: 600, fontFamily: font,
              cursor: 'pointer',
              transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
              minWidth: 48,
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
          >
            {sortAsc ? 'ASC' : 'DESC'}
          </button>
        </div>
      </div>

      <FearGreedGauge score={fgScore} rating={fgRating} t={t} />

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

      {/* Top Movers */}
      {filtered.length > 0 && !search && (
        <div style={{ ...glass, padding: 14, marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: t.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
            Top Movers
          </div>
          {topMovers.map(item => (
            <MarketRow
              key={`mover-${item.symbol}`}
              symbol={item.symbol} name={item.name} price={item.price}
              changePercent={item.changePercent}
              isWatchlisted={watchlistSet.has(item.symbol)}
              onToggle={toggleSymbol} canToggle={isAuthenticated} t={t}
              onClick={() => setSelectedStock(item)}
            />
          ))}
        </div>
      )}

      {/* All Markets by Sector */}
      {filtered.length === 0 ? (
        <div style={{ ...glass, padding: 14 }}>
          <div style={{ padding: '20px 0', textAlign: 'center', color: t.textTertiary, fontSize: 13 }}>No results</div>
        </div>
      ) : (
        <SectorGroups filtered={filtered} watchlist={watchlist} toggleSymbol={toggleSymbol}
          isAuthenticated={isAuthenticated} t={t} glass={glass} search={search}
          onSelect={item => setSelectedStock(item)} />
      )}

      {selectedStock && (
        <StockDetail
          stock={selectedStock}
          onClose={() => setSelectedStock(null)}
          dark={dark}
          t={t}
          currentIndex={filtered.findIndex(s => s.symbol === selectedStock.symbol)}
          totalCount={filtered.length}
          onNavigate={(idx) => setSelectedStock(filtered[idx])}
        />
      )}
    </div>
  );
}
