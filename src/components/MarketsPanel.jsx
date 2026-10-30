import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { formatCurrency } from '../utils/formatting';
import StockDetail from './StockDetail';
import SparklineChart from './SparklineChart';
import useFearGreed from '../hooks/useFearGreed';
import { useVisibilityPolling } from '../hooks/useVisibilityPolling';
import { SECTOR_MAP, SECTOR_ORDER } from '../hooks/useStocks';
import { sectorMoves, heatAlpha } from '../utils/sectors';

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
const INDEX_KEYS = ['nas100', 'us500', 'us30', 'dxy', 'us10y'];
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
    // Matches iOS: no card fill or border, label/score/rating on one baseline,
    // full-width bar flush beneath it rather than a small gauge off to the side.
    <a href="https://www.cnn.com/markets/fear-and-greed" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: 'inherit', display: 'block', margin: '0 -16px 12px -16px' }}>
      <div style={{ padding: '12px 16px', cursor: 'pointer', transition: 'opacity 0.15s' }}
        onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
        onMouseLeave={e => e.currentTarget.style.opacity = '1'}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: t.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Fear & Greed
          </span>
          <span style={{ fontSize: 15, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>{score}</span>
          <span style={{ fontSize: 12, fontWeight: 600, color }}>{rating}</span>
        </div>
        <div style={{ width: '100%', height: 6, borderRadius: 3, background: 'rgba(128,128,128,0.2)', overflow: 'hidden' }}>
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
      // iOS Stocks pill: fixed width, small radius.
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 72, height: 26, borderRadius: 6,
      fontSize: 13, fontWeight: 600, background: bg, color: '#fff',
      whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums',
    }}>
      {text}
    </span>
  );
}

function SignalBadge({ signal }) {
  if (!signal) return null;
  const color = signal.label === 'Long' ? '#30D158' : signal.label === 'Short' ? '#FF453A' : '#8e8e93';
  return (
    <span
      title={signal.reasons.join(', ')}
      style={{
        display: 'inline-block', padding: '2px 6px', borderRadius: 100,
        fontSize: 10, fontWeight: 700, color, border: `1px solid ${color}`,
        whiteSpace: 'nowrap', flexShrink: 0,
      }}
    >
      {signal.label.toUpperCase()}
    </span>
  );
}

function MarketRow({ symbol, name, price, changePercent, isWatchlisted, onToggle, canToggle, t, onClick }) {
  const [signal, setSignal] = useState(null);
  // Stable identity: SparklineChart's effect deps include this callback, an
  // inline arrow here would change identity every render (the setSignal call
  // itself causes one) and re-fire the effect forever.
  const handleSignal = useCallback((_, s) => setSignal(s), []);
  // Green or red behind the price for a moment when it ticks, like TradingView.
  // Only the digits that changed take the tick colour.
  const prevPrice = useRef(price);
  const [flash, setFlash] = useState(null);
  const [tick, setTick] = useState(null);
  useEffect(() => {
    if (prevPrice.current === price) return;
    const up = price > prevPrice.current;
    setFlash(up ? 'rgba(48,209,88,0.15)' : 'rgba(255,69,58,0.15)');
    setTick({ prev: formatCurrency(prevPrice.current).replace('$', ''), color: up ? '#30d158' : '#ff453a' });
    prevPrice.current = price;
    const id = setTimeout(() => { setFlash(null); setTick(null); }, 1200);
    return () => clearTimeout(id);
  }, [price]);
  const priceText = formatCurrency(price).replace('$', '');
  let same = 0;
  if (tick) while (same < priceText.length && priceText[same] === tick.prev[same]) same++;
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0',
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
        <div style={{ fontWeight: 700, fontSize: 17, color: t.text }}>{symbol}</div>
        <div style={{ fontSize: 15, color: t.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>{name}</div>
      </div>
      <SparklineChart symbol={symbol} changePercent={changePercent} t={t} onSignal={handleSignal} />
      <SignalBadge signal={signal} />
      <div style={{ textAlign: 'right', flexShrink: 0, maxWidth: '45%', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
        {/* No dollar sign, like iOS Stocks. */}
        <div style={{ fontWeight: 500, fontSize: 17, color: t.text, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', padding: '0 4px', margin: '0 -4px', borderRadius: 4, background: flash || 'transparent', transition: flash ? 'none' : 'background 0.8s ease-out' }}>{tick ? <>{priceText.slice(0, same)}<span style={{ color: tick.color }}>{priceText.slice(same)}</span></> : priceText}</div>
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
  const [searchResults, setSearchResults] = useState([]);
  const { score: fgScore, rating: fgRating } = useFearGreed();

  // Any ticker or company, not just the loaded list (/api/search, Yahoo).
  useEffect(() => {
    const q = search.trim();
    if (!showSearch || q.length < 1) { setSearchResults([]); return undefined; }
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        .then(r => (r.ok ? r.json() : { results: [] }))
        .then(d => setSearchResults(d.results || []))
        .catch(() => {});
    }, 250);
    return () => { clearTimeout(timer); ctrl.abort(); };
  }, [search, showSearch]);

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

  // The index cards' own quotes: the default list may not carry QQQ or DIA.
  const [indexQuotes, setIndexQuotes] = useState([]);
  useVisibilityPolling(async () => {
    try {
      const res = await fetch('/api/stocks-free?symbols=SPY,QQQ,DIA');
      if (res.ok) setIndexQuotes((await res.json()).map(q => ({ ...q, name: q.shortName || q.symbol, kind: 'stock' })));
    } catch { /* keep the last quotes */ }
  }, 60000);

  const watchlistSet = useMemo(() => new Set(watchlist || []), [watchlist]);

  // Named lists beyond the main watchlist, saved per account (server/api/watchlist-lists.js).
  const [lists, setLists] = useState([]);
  const [activeList, setActiveList] = useState(null); // null = the main watchlist
  const [listDraft, setListDraft] = useState(null);   // text while naming a new list
  const [symbolDraft, setSymbolDraft] = useState('');
  useEffect(() => {
    if (!isAuthenticated) return;
    fetch('/api/watchlist-lists', { credentials: 'include' }).then(r => (r.ok ? r.json() : null)).then(d => d && setLists(d.lists || [])).catch(() => {});
  }, [isAuthenticated]);
  const saveLists = (next) => {
    setLists(next);
    fetch('/api/watchlist-lists', { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lists: next }) }).catch(() => {});
  };
  const shownList = lists.find(l => l.name === activeList);

  const watchlistItems = useMemo(() => {
    const wanted = shownList ? new Set(shownList.symbols) : watchlistSet;
    if (wanted.size === 0) return [];
    return allItems
      .filter(item => wanted.has(item.symbol))
      .sort((a, b) => compareItems(a, b, sortKey, sortAsc));
  }, [allItems, watchlistSet, shownList, sortKey, sortAsc]);

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

  // Paging walks the list in screen order: watchlist first, then the rest.
  // Paging only `filtered` left watchlist stocks at "0 / N".
  const pagerItems = useMemo(() => [...watchlistItems, ...filtered], [watchlistItems, filtered]);

  const topMovers = useMemo(() => {
    if (filtered.length === 0) return [];
    const sorted = [...filtered].sort((a, b) => b.changePercent - a.changePercent);
    const top = sorted.slice(0, 5);
    const bottom = sorted.slice(-5).reverse();
    return [...top, ...bottom];
  }, [filtered]);

  const sectors = useMemo(() => sectorMoves(allItems), [allItems]);

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
      {/* top: -16 cancels this panel's padding: sticky measures from the padding edge, so top: 0 pushed the header 16px down over the index cards. */}
      <div style={{
        position: 'sticky', top: -16, zIndex: 3,
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
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>
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
            {searchResults.length > 0 && (
              <div style={{ marginTop: 8, borderRadius: 12, border: `1px solid ${t.border}`, background: t.glass, backdropFilter: 'blur(20px) saturate(150%)', overflow: 'hidden' }}>
                {searchResults.map(r => {
                  const added = watchlistSet.has(r.symbol);
                  return (
                    <div key={r.symbol} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderBottom: `1px solid ${t.border}` }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: t.text, fontWeight: 600, fontSize: 14 }}>{r.symbol}</div>
                        <div style={{ color: t.textSecondary, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{[r.name, r.exchange].filter(Boolean).join(' · ')}</div>
                      </div>
                      <button
                        onClick={() => toggleSymbol(r.symbol)}
                        style={{ minHeight: 32, padding: '0 14px', borderRadius: 999, border: 'none', cursor: 'pointer', fontFamily: font, fontWeight: 600, fontSize: 13, background: added ? t.border : '#1462e0', color: added ? t.text : '#fff' }}
                      >
                        {added ? 'Added' : 'Add'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
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

      {/* The three big indexes, as their ETFs, from their own quotes above. */}
      {!search && (() => {
        const bySym = new Map(indexQuotes.map(i => [i.symbol, i]));
        const cards = [['SPY', 'S&P 500'], ['QQQ', 'Nasdaq 100'], ['DIA', 'Dow']].filter(([sym]) => bySym.has(sym));
        if (!cards.length) return null;
        return (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, marginTop: 8, marginBottom: 12 }}>
            {cards.map(([sym, label]) => {
              const item = bySym.get(sym);
              const up = (item.changePercent ?? 0) >= 0;
              return (
                <button key={sym} onClick={() => setSelectedStock(item)} style={{ ...glass, padding: 12, marginBottom: 0, textAlign: 'left', cursor: 'pointer', color: t.text, font: 'inherit', minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
                  <div style={{ margin: '6px 0' }}><SparklineChart symbol={sym} changePercent={item.changePercent} t={t} /></div>
                  <div style={{ fontSize: 13, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(item.price)}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: up ? '#30d158' : '#ff453a' }}>{up ? '+' : ''}{(item.changePercent ?? 0).toFixed(2)}%</div>
                </button>
              );
            })}
          </div>
        );
      })()}

      {/* Watchlist */}
      {(watchlistItems.length > 0 || lists.length > 0 || (watchlist || []).length > 0) && (
        <div style={{ ...glass, padding: 14, marginBottom: 12 }}>
          {isAuthenticated ? (
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 8, alignItems: 'center' }}>
              {[null, ...lists.map(l => l.name)].map(name => (
                <button key={name ?? '__main'} type="button" onClick={() => setActiveList(name)}
                  style={{ height: 28, padding: '0 12px', borderRadius: 14, border: `1px solid ${t.border}`, whiteSpace: 'nowrap', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: activeList === name ? t.text : 'transparent', color: activeList === name ? t.bg : t.textSecondary }}>
                  {name ?? 'Watchlist'}
                </button>
              ))}
              {listDraft === null ? (
                <button type="button" onClick={() => setListDraft('')} aria-label="New list"
                  style={{ height: 28, padding: '0 10px', borderRadius: 14, border: `1px dashed ${t.border}`, background: 'transparent', color: t.textSecondary, cursor: 'pointer', fontSize: 12, whiteSpace: 'nowrap' }}>+ New list</button>
              ) : (
                <form onSubmit={(e) => { e.preventDefault(); const name = listDraft.trim(); if (name && !lists.some(l => l.name.toLowerCase() === name.toLowerCase())) { saveLists([...lists, { name, symbols: [] }]); setActiveList(name); } setListDraft(null); }}>
                  <input autoFocus value={listDraft} onChange={e => setListDraft(e.target.value)} onBlur={() => setListDraft(null)} placeholder="List name" maxLength={24} aria-label="New list name"
                    style={{ height: 28, width: 120, padding: '0 10px', borderRadius: 14, border: `1px solid ${t.border}`, background: 'transparent', color: t.text, fontSize: 12 }} />
                </form>
              )}
            </div>
          ) : (
            <div style={{ fontSize: 11, fontWeight: 600, color: t.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
              Watchlist
            </div>
          )}
          {shownList && (
            <form style={{ display: 'flex', gap: 6, marginBottom: 6 }} onSubmit={(e) => {
              e.preventDefault();
              const sym = symbolDraft.trim().toUpperCase();
              if (sym && !shownList.symbols.includes(sym)) saveLists(lists.map(l => (l.name === shownList.name ? { ...l, symbols: [...l.symbols, sym] } : l)));
              setSymbolDraft('');
            }}>
              <input value={symbolDraft} onChange={e => setSymbolDraft(e.target.value)} placeholder={`Add a symbol to ${shownList.name}`} maxLength={12} aria-label="Add symbol"
                style={{ flex: 1, height: 32, padding: '0 12px', borderRadius: 16, border: `1px solid ${t.border}`, background: 'transparent', color: t.text, fontSize: 13 }} />
              <button type="button" onClick={() => { saveLists(lists.filter(l => l.name !== shownList.name)); setActiveList(null); }}
                style={{ height: 32, padding: '0 12px', borderRadius: 16, border: 'none', background: 'transparent', color: t.red, cursor: 'pointer', fontSize: 12 }}>Delete list</button>
            </form>
          )}
          {shownList && watchlistItems.length === 0 && (
            <div style={{ fontSize: 12, color: t.textTertiary, padding: '6px 0' }}>Nothing here yet. Add a symbol above.</div>
          )}
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

      {/* Sector heat map: one tile per sector, coloured by today's average move */}
      {sectors.length > 1 && !search && (
        <div style={{ ...glass, padding: 14, marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: t.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
            Sectors
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: 6 }}>
            {sectors.map(({ sector, change, count }) => (
              <div key={sector} title={`${count} stocks`} style={{
                borderRadius: 8, padding: '10px 8px',
                background: change >= 0 ? `rgba(48,209,88,${heatAlpha(change)})` : `rgba(255,69,58,${heatAlpha(change)})`,
              }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: t.text }}>{sector}</div>
                <div style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums', color: t.text }}>{change >= 0 ? '+' : ''}{change.toFixed(2)}%</div>
              </div>
            ))}
          </div>
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
              boxShadow: 'none',
              transition: 'transform 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
          >
            Sort & Filter
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
          currentIndex={pagerItems.findIndex(s => s.symbol === selectedStock.symbol)}
          totalCount={pagerItems.length}
          onNavigate={(idx) => setSelectedStock(pagerItems[idx])}
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
            boxShadow: 'none',
            animation: 'slideUp 0.25s ease-out',
            willChange: 'transform',
          }}>
            <div style={{ position: 'sticky', top: 0, padding: '12px 16px', borderBottom: `1px solid ${t.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'inherit', zIndex: 1 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{selectedStock?.symbol} news</span>
              <button onClick={() => setShowNewsDrawer(false)} aria-label="Close news" style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.textSecondary, fontSize: 18 }}>✕</button>
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
