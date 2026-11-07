// CNN Fear & Greed Index proxy
// Source: production.dataviz.cnn.io (requires browser UA)
//
// CNN returns 418 to Cloudflare Workers egress even with a browser UA — it is
// IP-based, and there is no keyed tier or comparable free source for the *stock
// market* index. So a good response is cached in KV and served stale when CNN
// refuses. useFearGreed.js renders this as a widget, so stale beats broken and
// an empty state beats a 502.
import { getKv } from './_kv.js';
import { YAHOO_HEADERS } from './stocks-shared.js';

const KV_KEY = 'fear-greed:last';
const STALE_TTL_SEC = 7 * 24 * 3600;

const clamp = (x) => Math.max(0, Math.min(100, x));
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;

export function ratingFor(score) {
  if (score < 25) return 'extreme fear';
  if (score < 45) return 'fear';
  if (score <= 55) return 'neutral';
  if (score < 75) return 'greed';
  return 'extreme greed';
}

// Our own gauge when CNN refuses: two of CNN's seven inputs, equally weighted.
// S&P 500 vs its 125-day average (+-8% spans the scale) and VIX vs its 50-day
// average (+-25% spans it, high VIX = fear).
// ponytail: two signals, not seven; add breadth/put-call if it drifts from CNN.
export function moodScore(spx, vix) {
  if (spx.length < 125 || vix.length < 50) return null;
  const momentum = spx.at(-1) / mean(spx.slice(-125)) - 1;
  const vol = vix.at(-1) / mean(vix.slice(-50)) - 1;
  return Math.round((clamp(50 + momentum * 625) + clamp(50 - vol * 200)) / 2);
}

async function closes(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1y`;
  const r = await fetch(url, { headers: YAHOO_HEADERS, signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`Yahoo ${symbol} ${r.status}`);
  const c = (await r.json()).chart?.result?.[0]?.indicators?.quote?.[0]?.close || [];
  return c.filter((x) => typeof x === 'number');
}

async function ownGauge() {
  const [spx, vix] = await Promise.all([closes('^GSPC'), closes('^VIX')]);
  const score = moodScore(spx, vix);
  if (score == null) throw new Error('not enough history');
  return { score, rating: ratingFor(score), timestamp: new Date().toISOString(), source: 'epiphany' };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch('https://production.dataviz.cnn.io/index/fearandgreed/graphdata', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) throw new Error(`CNN API returned ${response.status}`);

    const data = await response.json();
    const fg = data.fear_and_greed;

    if (!fg || typeof fg.score !== 'number') {
      throw new Error('Unexpected response shape');
    }

    const payload = {
      score: Math.round(fg.score),
      rating: fg.rating,
      timestamp: fg.timestamp,
    };

    try {
      const kv = await getKv();
      await kv?.set(KV_KEY, JSON.stringify(payload), { ex: STALE_TTL_SEC });
    } catch { /* cache write is best-effort */ }

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json(payload);
  } catch (err) {
    console.warn('[FEAR-GREED] CNN failed, using own gauge:', err.message);

    try {
      const payload = await ownGauge();
      res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=1800');
      return res.status(200).json(payload);
    } catch (gaugeErr) {
      console.warn('[FEAR-GREED] Own gauge failed, trying cache:', gaugeErr.message);
    }

    try {
      const kv = await getKv();
      const cached = await kv?.get(KV_KEY);
      if (cached) {
        const payload = typeof cached === 'string' ? JSON.parse(cached) : cached;
        res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
        return res.status(200).json({ ...payload, stale: true });
      }
    } catch (cacheErr) {
      console.error('[FEAR-GREED] Cache read failed:', cacheErr.message);
    }

    // Cold cache: hand the widget an explicit empty state rather than a 502.
    res.setHeader('Cache-Control', 'public, s-maxage=60');
    return res.status(200).json({ score: null, rating: null, timestamp: null, unavailable: true });
  }
}
