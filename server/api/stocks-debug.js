// Debug endpoint: raw responses from each data source for a single symbol.
// Not cached, not rate-limited. For live debugging only, never expose publicly.
// Usage: GET /api/stocks-debug?symbol=AAPL
import {
  YAHOO_HEADERS,
  FMP_BASE,
  getFmpApiKey,
} from './stocks-shared.js';

const YAHOO_URLS = [
  'https://query1.finance.yahoo.com',
  'https://query2.finance.yahoo.com',
];
const REQUEST_TIMEOUT_MS = 10000;

function toFmpSymbol(yahooSymbol) {
  return yahooSymbol.replace(/-([A-Z])$/, '.$1');
}
function toYahooSymbol(fmpSymbol) {
  return fmpSymbol.replace(/\.([A-Z])$/, '-$1');
}

async function fetchRaw(url, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* not JSON */ }
    return { status: res.status, ok: res.ok, json, text: json ? null : text.slice(0, 500) };
  } catch (err) {
    clearTimeout(timeoutId);
    return { error: err.message };
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  const symbol = (req.query.symbol || '').trim().toUpperCase();
  if (!symbol || !/^[A-Z0-9.-]{1,10}$/.test(symbol)) {
    return res.status(400).json({ error: 'Provide ?symbol=TICKER (e.g. AAPL, BRK-B)' });
  }

  const fmpSymbol = toFmpSymbol(symbol);
  const yahooSymbol = toYahooSymbol(symbol);

  const out = {
    requested: symbol,
    fmpSymbol,
    yahooSymbol,
    sources: {},
    merged: null,
    mergedSources: {},
  };

  // --- FMP batch quote ---
  const apiKey = getFmpApiKey();
  if (!apiKey) {
    out.sources.fmp = { error: 'FMP_API_KEY not set' };
  } else {
    const fmpUrl = `${FMP_BASE}/quote/${fmpSymbol}?apikey=${apiKey}`;
    out.sources.fmp = await fetchRaw(fmpUrl);
  }

  // --- Yahoo v7 batch quote ---
  const v7Fields = [
    'regularMarketPrice', 'regularMarketChange', 'regularMarketChangePercent',
    'regularMarketVolume', 'regularMarketDayHigh', 'regularMarketDayLow',
    'regularMarketOpen', 'regularMarketPreviousClose', 'fiftyTwoWeekHigh', 'fiftyTwoWeekLow',
    'marketCap', 'trailingPE', 'epsTrailingTwelveMonths', 'averageDailyVolume3Month',
    'beta', 'trailingAnnualDividendYield',
  ].join(',');
  let v7Result = null;
  for (const base of YAHOO_URLS) {
    const url = `${base}/v7/finance/quote?symbols=${encodeURIComponent(yahooSymbol)}&fields=${v7Fields}`;
    const r = await fetchRaw(url, { headers: YAHOO_HEADERS });
    if (r.ok) { v7Result = r; break; }
    out.sources.yahooV7 = r; // keep last error
  }
  if (v7Result) out.sources.yahooV7 = v7Result;

  // --- Yahoo v10 quoteSummary ---
  let v10Result = null;
  for (const base of YAHOO_URLS) {
    const url = `${base}/v10/finance/quoteSummary/${encodeURIComponent(yahooSymbol)}?modules=summaryDetail,defaultKeyStatistics`;
    const r = await fetchRaw(url, { headers: YAHOO_HEADERS });
    if (r.ok) { v10Result = r; break; }
    out.sources.yahooV10 = r;
  }
  if (v10Result) out.sources.yahooV10 = v10Result;

  // --- Merge: produce annotated final result ---
  const merged = {};
  const mergedSources = {};

  // FMP price fields
  const fmpQuote = out.sources.fmp?.json?.[0];
  if (fmpQuote) {
    merged.price = fmpQuote.price;         mergedSources.price = 'fmp';
    merged.change = fmpQuote.change;       mergedSources.change = 'fmp';
    merged.changePercent = fmpQuote.changesPercentage; mergedSources.changePercent = 'fmp';
    merged.volume = fmpQuote.volume;       mergedSources.volume = 'fmp';
    merged.high = fmpQuote.dayHigh;        mergedSources.high = 'fmp';
    merged.low = fmpQuote.dayLow;          mergedSources.low = 'fmp';
    merged.prevClose = fmpQuote.previousClose; mergedSources.prevClose = 'fmp';
    if (fmpQuote.pe) { merged.peRatio = fmpQuote.pe; mergedSources.peRatio = 'fmp'; }
    if (fmpQuote.marketCap) { merged.marketCap = fmpQuote.marketCap; mergedSources.marketCap = 'fmp'; }
    if (fmpQuote.eps) { merged.eps = fmpQuote.eps; mergedSources.eps = 'fmp'; }
    if (fmpQuote.avgVolume) { merged.avgVolume = fmpQuote.avgVolume; mergedSources.avgVolume = 'fmp'; }
    if (fmpQuote.beta) { merged.beta = fmpQuote.beta; mergedSources.beta = 'fmp'; }
    // raw values for diagnosis
    merged._fmpRawPe = fmpQuote.pe;
    merged._fmpRawMarketCap = fmpQuote.marketCap;
  }

  // Yahoo v7 supplement
  const v7Quote = out.sources.yahooV7?.json?.quoteResponse?.result?.[0];
  if (v7Quote) {
    if (!merged.price) { merged.price = v7Quote.regularMarketPrice; mergedSources.price = 'yahooV7'; }
    if (!merged.peRatio && v7Quote.trailingPE) { merged.peRatio = v7Quote.trailingPE; mergedSources.peRatio = 'yahooV7'; }
    if (!merged.marketCap && v7Quote.marketCap) { merged.marketCap = v7Quote.marketCap; mergedSources.marketCap = 'yahooV7'; }
    if (!merged.eps && v7Quote.epsTrailingTwelveMonths) { merged.eps = v7Quote.epsTrailingTwelveMonths; mergedSources.eps = 'yahooV7'; }
    merged._yahooV7RawPe = v7Quote.trailingPE;
    merged._yahooV7RawMarketCap = v7Quote.marketCap;
  }

  // Yahoo v10 supplement
  const v10Data = out.sources.yahooV10?.json?.quoteSummary?.result?.[0];
  const sd = v10Data?.summaryDetail;
  const ks = v10Data?.defaultKeyStatistics;
  if (sd || ks) {
    if (!merged.peRatio) {
      const pe = sd?.trailingPE?.raw ?? ks?.trailingPE?.raw;
      if (pe) { merged.peRatio = pe; mergedSources.peRatio = 'yahooV10'; }
    }
    if (!merged.marketCap) {
      const mc = sd?.marketCap?.raw;
      if (mc) { merged.marketCap = mc; mergedSources.marketCap = 'yahooV10'; }
    }
    if (!merged.beta) {
      const b = ks?.beta?.raw;
      if (b) { merged.beta = b; mergedSources.beta = 'yahooV10'; }
    }
    merged._yahooV10RawPe = sd?.trailingPE?.raw ?? ks?.trailingPE?.raw;
    merged._yahooV10RawMarketCap = sd?.marketCap?.raw;
  }

  out.merged = merged;
  out.mergedSources = mergedSources;
  out.diagnosis = {
    peRatioFound: !!merged.peRatio,
    marketCapFound: !!merged.marketCap,
    peRatioSource: mergedSources.peRatio || null,
    marketCapSource: mergedSources.marketCap || null,
    fmpHadPe: !!fmpQuote?.pe,
    fmpHadMarketCap: !!fmpQuote?.marketCap,
    v7HadPe: !!v7Quote?.trailingPE,
    v7HadMarketCap: !!v7Quote?.marketCap,
    v10HadPe: !!(sd?.trailingPE?.raw ?? ks?.trailingPE?.raw),
    v10HadMarketCap: !!sd?.marketCap?.raw,
  };

  return res.status(200).json(out);
}
