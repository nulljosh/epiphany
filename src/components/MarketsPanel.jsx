import { useState, useEffect, useMemo, useRef } from 'react';
import { formatCurrency } from '../utils/formatting';
import StockDetail from './StockDetail';
import SparklineChart from './SparklineChart';
import useFearGreed from '../hooks/useFearGreed';
import { SECTOR_MAP, SECTOR_ORDER } from '../hooks/useStocks';

const ASSET_DIMENSIONS = [
  { key: 'all', label: 'All' },
  { key: 'stocks', label: 'Stocks' },
  { key: 'commodities', label: 'Commodities' },
  { key: 'crypto', label: 'Crypto' },
];

const SORT_OPTIONS = [
  { key: 'momentum', label: 'Hot' },
  { key: 'changePercent', label: '% Change' },
  { key: 'price', label: 'Price' },
  { key: 'symbol', label: 'Symbol' },
];

const COMMODITY_KEYS = ['gold', 'silver', 'platinum', 'palladium', 'copper', 'oil', 'natgas'];
const INDEX_KEYS = ['nas100', 'us500', 'us30', 'dxy'];
const CRYPTO_KEYS = ['btc', 'eth'];

function compareItems(a, b, sortKey, sortAsc) {
  let cmp = 0;
  if (sortKey === 'symbol') cmp = a.symbol.localeCompare(b.symbol);
  else if (sortKey === 'price') cmp = a.price - b.price;
  else if (sortKey === 'momentum') {
    const score = item => Math.abs(item.changePercent) * Math.log10(Math.max(10, item.volume || item.avgVolume || 10));
    cmp = score(a) - score(b);
  }
  else cmp = a.changePercent - b.changePercent;
  return sortAsc ? cmp : -cmp;
}

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

function FearGreedBanner({ score, rating, t }) {
  if (score === null) return null;
  const color = getFearGreedColor(score);
  return (
    <a href="https://www.cnn.com/markets/fear-and-greed" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: 'inherit', display: 'block', margin: '0 -16px 12px -16px' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
        background: `linear-gradient(135deg, ${color}08 0%, ${color}04 100%)`,
        border: `1px solid ${color}40`,
        borderRadius: 0,
        cursor: 'pointer', transition: 'opacity 0.15s',
      }}
      onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
      onMouseLeave={e => e.currentTarget.style.opacity = '1'}
      >
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: t.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
            Fear & Greed
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 24, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>{score}</span>
            <span style={{ fontSize: 13, fontWeight: 600, color }}>{rating}</span>
          </div>
        </div>
        <div style={{ width: 100, height: 8, borderRadius: 4, background: 'rgba(128,128,128,0.2)', overflow: 'hidden', flexShrink: 0 }}>
          <div style={{
            width: `${score}%`, height: '100%', borderRadius: 4, background: color,
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
      <SparklineChart symbol={symbol} changePercent={changePercent} t={t} />
      <div style={{ textAlign: 'right', flexShrink: 0, maxWidth: '45%' }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: t.text, whiteSpace: 'nowrap' }}>{formatCurrency(price)}</div>
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
    // Preserve the order of `filtered` (already sorted by the selected sort option)
    for (const item of filtered) {
      const sector = SECTOR_MAP[item.symbol] || 'Other';
      if (!groups[sector]) groups[sector] = [];
      groups[sector].push(item);
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

function SortPanel({ sortKey, setSortKey, sortAsc, setSortAsc, assetDimension, setAssetDimension, t, onClose }) {
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'flex-end', zIndex: 10,
    }}
    onClick={onClose}
    >
      <div style={{
        background: t.card || t.glass, width: '100%', borderRadius: '12px 12px 0 0',
        padding: 16, display: 'flex', flexDirection: 'column', gap: 16,
        maxHeight: '70vh', overflowY: 'auto',
      }}
      onClick={e => e.stopPropagation()}
      >
        <div style={{ fontSize: 18, fontWeight: 700, color: t.text }}>Sort & Filter</div>

        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: t.textSecondary, marginBottom: 8, textTransform: 'uppercase' }}>Asset Type</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {ASSET_DIMENSIONS.map(dim => (
              <button
                key={dim.key}
                onClick={() => setAssetDimension(dim.key)}
                style={{
                  padding: '10px 12px', borderRadius: 8, border: 'none',
                  background: assetDimension === dim.key ? '#0071e3' : t.border,
                  color: assetDimension === dim.key ? '#fff' : t.text,
                  fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                {dim.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: t.textSecondary, marginBottom: 8, textTransform: 'uppercase' }}>Sort By</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {SORT_OPTIONS.map(opt => (
              <button
                key={opt.key}
                onClick={() => setSortKey(opt.key)}
                style={{
                  padding: '10px 12px', borderRadius: 8, border: 'none', textAlign: 'left',
                  background: sortKey === opt.key ? '#0071e3' : t.border,
                  color: sortKey === opt.key ? '#fff' : t.text,
                  fontSize: 13, fontWeight: sortKey === opt.key ? 600 : 400, cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: t.textSecondary, marginBottom: 8, textTransform: 'uppercase' }}>Order</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {['DESC', 'ASC'].map(order => (
              <button
                key={order}
                onClick={() => setSortAsc(order === 'ASC')}
                style={{
                  padding: '10px 12px', borderRadius: 8, border: 'none',
                  background: (sortAsc && order === 'ASC' || !sortAsc && order === 'DESC') ? '#0071e3' : t.border,
                  color: (sortAsc && order === 'ASC' || !sortAsc && order === 'DESC') ? '#fff' : t.text,
                  fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                {order}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MarketsPanel({ dark, t, stocks, liveAssets, watchlist, toggleSymbol, isAuthenticated, initialSymbol, onConsumeInitialSymbol }) {
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [sortKey, setSortKey] = useState('changePercent');
  const [sortAsc, setSortAsc] = useState(false);
  const [assetDimension, setAssetDimension] = useState('all');
  const [selectedStock, setSelectedStock] = useState(null);
  const [showSortPanel, setShowSortPanel] = useState(false);
  const [showNewsDrawer, setShowNewsDrawer] = useState(false);
  const searchInputRef = useRef(null);
  const { score: fgScore, rating: fgRating } = useFearGreed();

  useEffect(() => {
    if (showSearch && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [showSearch]);

  // Open stock detail when navigated via command bar
  useEffect(() => {
    if (!initialSymbol || !stocks) return;
    const data = stocks[initialSymbol];
    setSelectedStock({ symbol: initialSymbol, name: data?.name || initialSymbol, price: data?.price ?? 0, changePercent: data?.changePercent ?? 0 });
    onConsumeInitialSymbol?.();
  }, [initialSymbol, stocks]);
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
          name: s.shortName || s.symbol,
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
    return allItems
      .filter(item => watchlistSet.has(item.symbol))
      .sort((a, b) => compareItems(a, b, sortKey, sortAsc));
  }, [allItems, watchlistSet, sortKey, sortAsc]);

  const filtered = useMemo(() => {
    let list = allItems.filter(item => {
      if (watchlistSet.has(item.symbol)) return false;

      if (assetDimension !== 'all') {
        if (assetDimension === 'stocks' && item.kind !== 'stock') return false;
        if (assetDimension === 'commodities' && item.kind !== 'commodity') return false;
        if (assetDimension === 'crypto' && item.kind !== 'crypto') return false;
      }

      if (!search) return true;
      const q = search.toLowerCase();
      return item.symbol.toLowerCase().includes(q) || item.name.toLowerCase().includes(q);
    });
    list.sort((a, b) => compareItems(a, b, sortKey, sortAsc));
    return list;
  }, [allItems, search, sortKey, sortAsc, watchlistSet, assetDimension]);

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
    <div style={{ padding: 16, fontFamily: font, minWidth: 0, overflow: 'hidden', boxSizing: 'border-box' }}>
      {/* Sticky header: market status + search icon + sort button */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 3,
        margin: '-16px -16px 12px -16px', padding: '12px 16px 10px',
        background: dark ? 'rgba(2,6,23,0.72)' : 'rgba(255,255,255,0.72)',
        backdropFilter: 'blur(20px) saturate(150%)',
        WebkitBackdropFilter: 'blur(20px) saturate(150%)',
        borderBottom: `1px solid ${t.border}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: status.color }} />
            <span style={{ fontSize: 11, color: t.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Markets
            </span>
          </div>
          <button
            aria-label="Search markets"
            onClick={() => setShowSearch(true)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: t.textSecondary, fontSize: 16, padding: '6px 8px',
              transition: 'color 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.color = t.text}
            onMouseLeave={e => e.currentTarget.style.color = t.textSecondary}
          >
            🔍
          </button>
        </div>
      </div>

      {/* Search Modal */}
      {showSearch && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
          paddingTop: '20vh', zIndex: 20,
        }}
        onClick={() => { setShowSearch(false); setSearch(''); }}
        >
          <div style={{ width: '90%', maxWidth: 500 }} onClick={e => e.stopPropagation()}>
            <input
              ref={searchInputRef}
              type="text"
              aria-label="Search markets"
              placeholder="Search markets..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%', padding: '14px 16px', borderRadius: 12,
                border: `1px solid ${t.border}`, background: t.glass,
                color: t.text, fontSize: 16, fontFamily: font, outline: 'none',
                backdropFilter: 'blur(20px) saturate(150%)',
              }}
              onKeyDown={e => {
                if (e.key === 'Escape') { setShowSearch(false); setSearch(''); }
              }}
            />
          </div>
        </div>
      )}

      {/* Sort Panel Modal */}
      {showSortPanel && (
        <SortPanel
          sortKey={sortKey}
          setSortKey={setSortKey}
          sortAsc={sortAsc}
          setSortAsc={setSortAsc}
          assetDimension={assetDimension}
          setAssetDimension={setAssetDimension}
          t={t}
          onClose={() => setShowSortPanel(false)}
        />
      )}

      <FearGreedBanner score={fgScore} rating={fgRating} t={t} />

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

      {/* Sort Button (sticky during scroll) */}
      {filtered.length > 0 && (
        <div style={{
          position: 'sticky', bottom: 16, zIndex: 2,
          display: 'flex', justifyContent: 'center', marginBottom: 12,
        }}>
          <button
            onClick={() => setShowSortPanel(true)}
            style={{
              padding: '10px 16px', borderRadius: 8,
              background: '#0071e3', color: '#fff', border: 'none',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0,113,227,0.3)',
              transition: 'transform 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
          >
            ⚙️ Sort & Filter
          </button>
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
          onClose={() => { setSelectedStock(null); setShowNewsDrawer(false); }}
          dark={dark}
          t={t}
          currentIndex={filtered.findIndex(s => s.symbol === selectedStock.symbol)}
          totalCount={filtered.length}
          onNavigate={(idx) => setSelectedStock(filtered[idx])}
        />
      )}

      {showNewsDrawer && (
        <>
          <div
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 4, background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(2px)' }}
            onClick={() => setShowNewsDrawer(false)}
          />
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0,
            background: t.glass, backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderTop: `1px solid ${t.border}`, borderRadius: '12px 12px 0 0',
            maxHeight: '70vh', overflow: 'auto', zIndex: 5,
            boxShadow: '0 -4px 12px rgba(0,0,0,0.1)',
            animation: 'slideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}>
            <div style={{ position: 'sticky', top: 0, padding: '12px 16px', borderBottom: `1px solid ${t.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'inherit', zIndex: 1 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>News — {selectedStock?.symbol}</span>
              <button onClick={() => setShowNewsDrawer(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.textSecondary, fontSize: 18 }}>✕</button>
            </div>
            <div style={{ padding: 16 }}>
              <div style={{ color: t.textSecondary, fontSize: 13, textAlign: 'center' }}>No news yet for this ticker</div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
