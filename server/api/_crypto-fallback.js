// CoinGecko rate-limits by IP, and Cloudflare Workers egress shares addresses
// with everyone else on the platform, so it returns 429/451 far more often here
// than it did on Vercel. Kraken and Coinbase are keyless and don't IP-gate, so
// they stand in when CoinGecko refuses.
//
// ponytail: same primary-then-fallback shape as stocks-free.js (FMP -> Yahoo);
// no new pattern to learn.

// Kraken uses its own asset codes; XBT is bitcoin.
const KRAKEN_PAIRS = {
  bitcoin: 'XBTUSD', ethereum: 'ETHUSD', solana: 'SOLUSD', dogecoin: 'XDGUSD',
  cardano: 'ADAUSD', ripple: 'XRPUSD', polkadot: 'DOTUSD', 'avalanche-2': 'AVAXUSD',
  chainlink: 'LINKUSD', litecoin: 'LTCUSD',
};

const META = {
  bitcoin: ['BTC', 'Bitcoin'], ethereum: ['ETH', 'Ethereum'], solana: ['SOL', 'Solana'],
  dogecoin: ['DOGE', 'Dogecoin'], cardano: ['ADA', 'Cardano'], ripple: ['XRP', 'XRP'],
  polkadot: ['DOT', 'Polkadot'], 'avalanche-2': ['AVAX', 'Avalanche'],
  chainlink: ['LINK', 'Chainlink'], litecoin: ['LTC', 'Litecoin'],
};

// Kraken returns results keyed by its own normalised pair names (XXBTZUSD for
// XBTUSD, etc), so match loosely on the base asset rather than exact key.
function findTicker(result, pair) {
  if (result[pair]) return result[pair];
  const base = pair.replace(/USD$/, '');
  const key = Object.keys(result).find((k) => k.includes(base) && k.endsWith('USD'));
  return key ? result[key] : null;
}

export async function krakenMarkets(ids) {
  const pairs = ids.map((id) => KRAKEN_PAIRS[id]).filter(Boolean);
  if (pairs.length === 0) return [];

  const r = await fetch(`https://api.kraken.com/0/public/Ticker?pair=${pairs.join(',')}`, {
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new Error(`Kraken ${r.status}`);
  const j = await r.json();
  if (j.error?.length) throw new Error(`Kraken ${j.error[0]}`);

  const out = [];
  for (const id of ids) {
    const pair = KRAKEN_PAIRS[id];
    const t = pair && findTicker(j.result || {}, pair);
    if (!t) continue;
    const price = Number(t.c?.[0]);
    const open = Number(t.o);
    const [symbol, name] = META[id] || [id.toUpperCase(), id];
    out.push({
      symbol,
      name,
      price,
      change24h: open ? ((price - open) / open) * 100 : 0,
      // Kraken has no market cap; the UI treats it as optional.
      marketCap: null,
      volume: Number(t.v?.[1]) * price || null,
      high24h: Number(t.h?.[1]) ?? null,
      low24h: Number(t.l?.[1]) ?? null,
      image: null,
    });
  }
  return out;
}

// Coinbase spot has no 24h change, so pair it with yesterday's spot to derive one.
export async function coinbaseSpot(symbol) {
  const at = new Date(Date.now() - 86400_000).toISOString().slice(0, 10);
  const [nowRes, prevRes] = await Promise.all([
    fetch(`https://api.coinbase.com/v2/prices/${symbol}-USD/spot`, { signal: AbortSignal.timeout(8000) }),
    fetch(`https://api.coinbase.com/v2/prices/${symbol}-USD/spot?date=${at}`, { signal: AbortSignal.timeout(8000) }),
  ]);
  if (!nowRes.ok) throw new Error(`Coinbase ${nowRes.status}`);

  const spot = Number((await nowRes.json())?.data?.amount);
  let chgPct = null;
  if (prevRes.ok) {
    const prev = Number((await prevRes.json())?.data?.amount);
    if (prev) chgPct = ((spot - prev) / prev) * 100;
  }
  return { spot: Number.isFinite(spot) ? spot : null, chgPct };
}
