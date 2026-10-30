// A stock's last four quarters of earnings (EPS actual against the estimate) and the analysts' price target,
// plus insider buys and sells, from Yahoo's quoteSummary earningsHistory, financialData, insiderTransactions, institutionOwnership and majorHoldersBreakdown modules (same cookie and crumb session as the fundamentals).
import { getYahooCrumb, YAHOO_HEADERS } from './stocks-shared.js';
import { errorResponse } from './auth-helpers.js';

const BASES = ['https://query1.finance.yahoo.com', 'https://query2.finance.yahoo.com'];

/** Quarters oldest first: { quarter: "Q2 2026", actual, estimate, surprise } with surprise in percent. */
export function parseEarningsHistory(json) {
  const rows = json?.quoteSummary?.result?.[0]?.earningsHistory?.history || [];
  return rows
    .filter((r) => typeof r?.epsActual?.raw === 'number' && typeof r?.epsEstimate?.raw === 'number')
    .map((r) => {
      const d = new Date((r.quarter?.raw || 0) * 1000);
      return {
        quarter: `Q${Math.floor(d.getUTCMonth() / 3) + 1} ${d.getUTCFullYear()}`,
        actual: r.epsActual.raw,
        estimate: r.epsEstimate.raw,
        surprise: typeof r.surprisePercent?.raw === 'number' ? r.surprisePercent.raw * 100 : null,
      };
    })
    .slice(-4);
}

/** Analysts' mean target, range, count and consensus ("buy", "hold"...), or null when there's no coverage. */
export function parseAnalysts(json) {
  const f = json?.quoteSummary?.result?.[0]?.financialData;
  const mean = f?.targetMeanPrice?.raw;
  if (typeof mean !== 'number' || !(f?.numberOfAnalystOpinions?.raw > 0)) return null;
  return {
    mean, high: f.targetHighPrice?.raw ?? null, low: f.targetLowPrice?.raw ?? null,
    count: f.numberOfAnalystOpinions.raw,
    consensus: typeof f.recommendationKey === 'string' && f.recommendationKey !== 'none' ? f.recommendationKey.replace(/_/g, ' ') : null,
  };
}

// "NEWSTEAD JENNIFER" -> "Jennifer Newstead". SEC filer names come last name first.
// ponytail: moves the first word to the end; a two-word last name ("DE LA CRUZ") reads a little off.
const filerName = (n = '') => {
  const words = n.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()).split(/\s+/).filter(Boolean);
  return words.length > 1 ? [...words.slice(1), words[0]].join(' ') : words.join('');
};

/** Open-market insider buys and sells in the last 90 days: counts, dollar totals and the three newest. Awards, gifts and option exercises are left out. */
export function parseInsiders(json, now = Date.now()) {
  const since = now / 1000 - 90 * 86400;
  const rows = (json?.quoteSummary?.result?.[0]?.insiderTransactions?.transactions || [])
    .map((t) => ({ side: /^sale\b/i.test(t.transactionText || '') ? 'sell' : /^purchase\b|^buy\b/i.test(t.transactionText || '') ? 'buy' : null, t }))
    .filter(({ side, t }) => side && (t.startDate?.raw || 0) >= since)
    .map(({ side, t }) => ({ name: filerName(t.filerName), role: t.filerRelation || null, side, shares: t.shares?.raw ?? null, value: t.value?.raw ?? null, date: t.startDate?.fmt || null }));
  if (!rows.length) return null;
  const total = (side) => rows.filter((r) => r.side === side).reduce((sum, r) => sum + (r.value || 0), 0);
  return {
    buys: rows.filter((r) => r.side === 'buy').length, sells: rows.filter((r) => r.side === 'sell').length,
    bought: total('buy'), sold: total('sell'), recent: rows.slice(0, 3),
  };
}

/** Who owns the stock: institution and insider shares of it, fund count, and the five biggest holders with their last quarterly change. */
export function parseOwnership(json) {
  const r = json?.quoteSummary?.result?.[0];
  const m = r?.majorHoldersBreakdown;
  if (typeof m?.institutionsPercentHeld?.raw !== 'number') return null;
  return {
    institutions: m.institutionsPercentHeld.raw,
    insiders: m.insidersPercentHeld?.raw ?? null,
    count: m.institutionsCount?.raw ?? null,
    top: (r.institutionOwnership?.ownershipList || []).slice(0, 5).map((o) => ({
      name: o.organization, pct: o.pctHeld?.raw ?? null, change: o.pctChange?.raw ?? null, date: o.reportDate?.fmt || null,
    })),
  };
}

export default async function handler(req, res) {
  const symbol = String(req.query?.symbol || '').toUpperCase().trim();
  if (!/^[A-Z0-9.\-^=]{1,15}$/.test(symbol)) return errorResponse(res, 400, 'symbol required');
  for (const base of BASES) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const session = await getYahooCrumb({ force: attempt > 0 });
      const crumb = session.crumb ? `&crumb=${encodeURIComponent(session.crumb)}` : '';
      try {
        const r = await fetch(`${base}/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=earningsHistory,financialData,insiderTransactions,institutionOwnership,majorHoldersBreakdown${crumb}`,
          { headers: session.cookie ? { ...YAHOO_HEADERS, Cookie: session.cookie } : YAHOO_HEADERS, signal: AbortSignal.timeout(8000) });
        if (r.status === 401 && attempt === 0) continue;
        if (!r.ok) break;
        res.setHeader('Cache-Control', 'public, max-age=3600');
        const json = await r.json();
        return res.status(200).json({ symbol, quarters: parseEarningsHistory(json), analysts: parseAnalysts(json), insiders: parseInsiders(json), ownership: parseOwnership(json) });
      } catch {
        break;
      }
    }
  }
  return errorResponse(res, 502, 'Earnings history unavailable');
}
