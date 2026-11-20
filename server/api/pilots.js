// GET /api/pilots: famous investors' stock portfolios from their latest SEC 13F filing, read only.
// Each pilot: top 10 holdings by value, and what those 10 did since the quarter the filing covers
// ended, weighted, beside SPY over the same days. 13Fs change once a quarter, so the whole answer
// sits in KV for 12 hours. SEC asks for a contact in the User-Agent; this is the project's public address.
import { getKv } from './_kv.js';
import { YAHOO_HEADERS } from './stocks-shared.js';

export const PILOTS = [
  { id: 'berkshire', name: 'Warren Buffett', fund: 'Berkshire Hathaway', cik: '1067983' },
  { id: 'pershing', name: 'Bill Ackman', fund: 'Pershing Square', cik: '1336528' },
  { id: 'appaloosa', name: 'David Tepper', fund: 'Appaloosa', cik: '1656456' },
  { id: 'baupost', name: 'Seth Klarman', fund: 'Baupost Group', cik: '1061768' },
  { id: 'duquesne', name: 'Stanley Druckenmiller', fund: 'Duquesne Family Office', cik: '1536411' },
  { id: 'tiger', name: 'Chase Coleman', fund: 'Tiger Global', cik: '1167483' },
];

const SEC_UA = { 'User-Agent': 'Epiphany info@jaybulb.com', Accept: 'application/json, text/xml' };
const KV_KEY = 'pilots:v1';
const TTL_SEC = 12 * 3600;
const TOP = 10;

// Holdings from a 13F information table: shares only (no options), summed per CUSIP, by value.
export function parseInfoTable(xml) {
  const byCusip = new Map();
  const field = (block, tag) => (block.match(new RegExp(`<(?:\\w+:)?${tag}>([^<]*)</`)) || [])[1]?.trim();
  for (const [, block] of xml.matchAll(/<(?:\w+:)?infoTable>([\s\S]*?)<\/(?:\w+:)?infoTable>/g)) {
    if (field(block, 'putCall')) continue;
    if ((field(block, 'sshPrnamtType') || 'SH') !== 'SH') continue;
    const cusip = field(block, 'cusip');
    const value = Number(field(block, 'value')) || 0;
    if (!cusip || value <= 0) continue;
    const prev = byCusip.get(cusip) || { cusip, name: field(block, 'nameOfIssuer') || cusip, value: 0 };
    prev.value += value;
    byCusip.set(cusip, prev);
  }
  const rows = [...byCusip.values()].sort((a, b) => b.value - a.value);
  const total = rows.reduce((s, r) => s + r.value, 0);
  return { total, count: rows.length, rows: rows.map(r => ({ ...r, weight: total ? r.value / total : 0 })) };
}

// Weighted return of the holdings between two closes; holdings without a price are left out and the
// rest re-weighted, so one unpriced CUSIP doesn't drag the number to zero.
export function weightedReturn(holdings, startPrice, endPrice) {
  let w = 0, r = 0;
  for (const h of holdings) {
    const a = startPrice[h.ticker], b = endPrice[h.ticker];
    if (!h.ticker || !(a > 0) || !(b > 0)) continue;
    w += h.weight; r += h.weight * (b / a - 1);
  }
  return w > 0 ? r / w : null;
}

async function json(url, opts = {}) {
  const r = await fetch(url, { ...opts, signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
}

async function latestFiling(cik) {
  const d = await json(`https://data.sec.gov/submissions/CIK${cik.padStart(10, '0')}.json`, { headers: SEC_UA });
  const f = d.filings.recent;
  const i = f.form.findIndex(x => x === '13F-HR');
  if (i < 0) return null;
  const acc = f.accessionNumber[i];
  const dir = `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${acc.replace(/-/g, '')}`;
  const index = await json(`${dir}/index.json`, { headers: SEC_UA });
  const table = index.directory.item.find(x => /\.xml$/i.test(x.name) && !/primary_doc/i.test(x.name));
  if (!table) return null;
  const r = await fetch(`${dir}/${table.name}`, { headers: SEC_UA, signal: AbortSignal.timeout(10000) });
  if (!r.ok) return null;
  return { filedAt: f.filingDate[i], quarterEnd: f.reportDate[i], url: `${dir}/`, ...parseInfoTable(await r.text()) };
}

// CUSIP to US ticker through OpenFIGI (no key: 10 per request), remembered in KV for good.
async function tickers(kv, cusips) {
  const out = {};
  const missing = [];
  for (const c of cusips) {
    const hit = kv ? await kv.get(`figi:${c}`).catch(() => null) : null;
    if (hit) out[c] = hit; else missing.push(c);
  }
  for (let i = 0; i < missing.length; i += 10) {
    const batch = missing.slice(i, i + 10);
    const res = await json('https://api.openfigi.com/v3/mapping', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(batch.map(c => ({ idType: 'ID_CUSIP', idValue: c, exchCode: 'US' }))),
    }).catch(() => []);
    batch.forEach((c, j) => {
      const t = res[j]?.data?.find(x => x.ticker && /Common|ADR|ETP|REIT/i.test(x.securityType || ''))?.ticker || res[j]?.data?.[0]?.ticker;
      if (t) { out[c] = t.replace('/', '-'); kv?.set(`figi:${c}`, out[c]).catch(() => {}); }
    });
  }
  return out;
}

// Close on or before `date` and the latest close, per symbol, from Yahoo's spark (20 symbols a call).
async function closes(symbols, date) {
  const start = {}, end = {};
  const cutoff = Date.parse(`${date}T23:59:59Z`) / 1000;
  for (let i = 0; i < symbols.length; i += 20) {
    const batch = symbols.slice(i, i + 20);
    const d = await json(`https://query1.finance.yahoo.com/v8/finance/spark?symbols=${batch.map(encodeURIComponent).join(',')}&range=1y&interval=1d`, { headers: YAHOO_HEADERS }).catch(() => ({}));
    for (const s of batch) {
      const ts = d[s]?.timestamp || [], cl = d[s]?.close || [];
      let k = -1;
      for (let j = 0; j < ts.length; j++) if (ts[j] <= cutoff && cl[j] != null) k = j;
      if (k >= 0) start[s] = cl[k];
      for (let j = cl.length - 1; j >= 0; j--) if (cl[j] != null) { end[s] = cl[j]; break; }
    }
  }
  return { start, end };
}

async function build(kv) {
  const pilots = [];
  for (const p of PILOTS) {
    const f = await latestFiling(p.cik).catch(() => null);
    if (!f || !f.rows.length) continue;
    const top = f.rows.slice(0, TOP);
    const map = await tickers(kv, top.map(r => r.cusip));
    const holdings = top.map(r => ({ ticker: map[r.cusip] || null, name: r.name, weight: r.weight }));
    const syms = [...new Set([...holdings.map(h => h.ticker).filter(Boolean), 'SPY'])];
    const { start, end } = await closes(syms, f.quarterEnd);
    const topWeight = holdings.reduce((s, h) => s + h.weight, 0);
    pilots.push({
      ...p, filedAt: f.filedAt, quarterEnd: f.quarterEnd, filing: f.url, positions: f.count, topWeight, holdings,
      returnSince: weightedReturn(holdings, start, end),
      spySince: start.SPY > 0 && end.SPY > 0 ? end.SPY / start.SPY - 1 : null,
    });
  }
  return { pilots, builtAt: new Date().toISOString() };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const kv = await getKv();
  const cached = kv ? await kv.get(KV_KEY).catch(() => null) : null;
  if (cached?.pilots?.length) return res.status(200).json(cached);
  try {
    const data = await build(kv);
    if (kv && data.pilots.length) await kv.set(KV_KEY, data, { ex: TTL_SEC }).catch(() => {});
    return res.status(200).json(data);
  } catch (err) {
    console.error('[PILOTS]', err?.message || err);
    return res.status(502).json({ error: 'Filings temporarily unavailable' });
  }
}
