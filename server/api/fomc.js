// Fed rate decision days from the Fed's own calendar page (the last day of each FOMC meeting).
// ponytail: scrapes federalreserve.gov's HTML; BLS blocks bots, so CPI and jobs dates wait on a BLS key.
const PAGE = 'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm';
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** Decision dates ("2026-12-09"), sorted, from the calendar HTML. */
export function parseFomc(html = '') {
  const out = [];
  const years = [...html.matchAll(/(\d{4}) FOMC Meetings/g)];
  years.forEach((y, i) => {
    const seg = html.slice(y.index, years[i + 1]?.index ?? html.length);
    for (const m of seg.matchAll(/fomc-meeting__month[^>]*>\s*<strong>([^<]+)<\/strong>[\s\S]*?fomc-meeting__date[^>]*>([^<]+)</g)) {
      const monthWords = m[1].toLowerCase().split('/');
      const days = m[2].replace(/[^\d-]/g, '').split('-').filter(Boolean).map(Number);
      const day = days.at(-1);
      // "Apr/May 30-1" ends in the second month.
      const month = MONTHS.indexOf(monthWords.at(-1).trim().slice(0, 3));
      if (month < 0 || !day) continue;
      out.push(`${y[1]}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
    }
  });
  return [...new Set(out)].sort();
}

export default async function handler(req, res) {
  try {
    const r = await fetch(PAGE, { headers: { 'User-Agent': 'Mozilla/5.0 (Epiphany)' }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error(String(r.status));
    const today = new Date().toISOString().slice(0, 10);
    const decisions = parseFomc(await r.text()).filter((d) => d >= today);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.status(200).json({ next: decisions[0] ?? null, decisions });
  } catch {
    return res.status(502).json({ error: 'Fed calendar unavailable' });
  }
}
