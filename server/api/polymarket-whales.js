import { applyCors } from './_cors.js';

const GAMMA_API = 'https://gamma-api.polymarket.com';
const CLOB_API = 'https://clob.polymarket.com';
const REQUEST_TIMEOUT_MS = 12000;
const CACHE_TTL_MS = 120_000; // 2 min cache
const WHALE_TRADE_MIN_USD = 5000; // Minimum trade size to track
const TOP_TRADERS_LIMIT = 20;

let cache = null;

async function fetchJson(url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

function shortenAddress(addr) {
  if (!addr || addr.length < 10) return addr || 'unknown';
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export default async function handler(req, res) {
  applyCors(req, res);

  if (cache && Date.now() - cache.ts < CACHE_TTL_MS) {
    res.setHeader('X-Monica-Data-Status', 'cache');
    return res.status(200).json(cache.data);
  }

  try {
    // Fetch recent large trades from Gamma API
    const tradesUrl = `${GAMMA_API}/trades?limit=200&order=timestamp&ascending=false`;
    let trades = [];
    try {
      const raw = await fetchJson(tradesUrl);
      trades = Array.isArray(raw) ? raw : [];
    } catch (err) {
      console.warn('[polymarket-whales] Gamma trades fetch failed:', err.message);
    }

    // Fetch top markets for context
    const marketsUrl = `${GAMMA_API}/markets?limit=20&order=volume24hr&ascending=false&closed=false`;
    let topMarkets = [];
    try {
      const raw = await fetchJson(marketsUrl);
      topMarkets = Array.isArray(raw) ? raw : [];
    } catch (err) {
      console.warn('[polymarket-whales] Markets fetch failed:', err.message);
    }

    const marketMap = new Map();
    for (const m of topMarkets) {
      if (m.id) marketMap.set(m.id, { question: m.question, slug: m.slug, eventSlug: m.events?.[0]?.slug || m.slug });
    }

    // Filter for whale-sized trades
    const whaleTrades = trades
      .filter(t => {
        const size = parseFloat(t.size || t.amount || 0) * parseFloat(t.price || 1);
        return size >= WHALE_TRADE_MIN_USD;
      })
      .map(t => {
        const size = parseFloat(t.size || t.amount || 0);
        const price = parseFloat(t.price || 0);
        const usdValue = size * price;
        const market = marketMap.get(t.market || t.asset_id);
        return {
          id: t.id,
          maker: t.maker_address || t.maker || t.owner,
          side: t.side === 'BUY' || t.side === 'buy' ? 'BUY' : 'SELL',
          size,
          price,
          usdValue: Math.round(usdValue),
          outcome: t.outcome || (price > 0.5 ? 'YES' : 'NO'),
          timestamp: t.timestamp || t.created_at,
          marketId: t.market || t.asset_id,
          marketQuestion: market?.question || null,
          marketSlug: market?.eventSlug || market?.slug || null,
        };
      })
      .sort((a, b) => b.usdValue - a.usdValue);

    // Aggregate by wallet to find top traders
    const walletMap = new Map();
    for (const trade of whaleTrades) {
      const addr = trade.maker || 'unknown';
      if (!walletMap.has(addr)) {
        walletMap.set(addr, {
          address: addr,
          shortAddress: shortenAddress(addr),
          totalVolume: 0,
          tradeCount: 0,
          recentTrades: [],
          markets: new Set(),
        });
      }
      const w = walletMap.get(addr);
      w.totalVolume += trade.usdValue;
      w.tradeCount += 1;
      if (w.recentTrades.length < 5) w.recentTrades.push(trade);
      if (trade.marketQuestion) w.markets.add(trade.marketQuestion);
    }

    const topTraders = Array.from(walletMap.values())
      .map(w => ({ ...w, markets: Array.from(w.markets) }))
      .sort((a, b) => b.totalVolume - a.totalVolume)
      .slice(0, TOP_TRADERS_LIMIT);

    // Recent whale moves (last 10 big trades)
    const recentMoves = whaleTrades.slice(0, 10).map(t => ({
      ...t,
      makerShort: shortenAddress(t.maker),
    }));

    const result = {
      topTraders,
      recentMoves,
      totalWhaleTrades: whaleTrades.length,
      updatedAt: new Date().toISOString(),
    };

    cache = { ts: Date.now(), data: result };
    res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=300');
    res.setHeader('X-Monica-Data-Status', 'live');
    return res.status(200).json(result);
  } catch (error) {
    console.error('[polymarket-whales] Error:', error.message);

    if (cache) {
      res.setHeader('X-Monica-Data-Status', 'stale');
      return res.status(200).json(cache.data);
    }

    return res.status(500).json({ error: 'Failed to fetch whale data' });
  }
}
