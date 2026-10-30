// Sunday earnings digest: everyone who turned on the "weekly" alert gets one email listing the
// watched stocks that report in the next seven days. Nothing to report means no email.
import { sparkRequest, sparkConfigured } from './spark.js';
import { fetchYahooBatch } from './stocks-free.js';
import { sendEmail } from './_email.js';
import { verifyCronSecret } from './_shared-secret.js';

const WEEK = 7 * 24 * 3600 * 1000;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** Quotes reporting within a week of `now`, soonest first. */
export function reportingThisWeek(quotes, now = Date.now()) {
  return quotes
    .filter((q) => typeof q.nextEarnings === 'number' && q.nextEarnings * 1000 >= now - 24 * 3600 * 1000 && q.nextEarnings * 1000 - now <= WEEK)
    .sort((a, b) => a.nextEarnings - b.nextEarnings);
}

export function digestEmail(quotes) {
  const day = (ts) => new Date(ts * 1000).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'America/New_York' });
  const lines = quotes.map((q) => `${esc(q.symbol)} reports ${day(q.nextEarnings)}.`);
  return {
    subject: quotes.length === 1 ? lines[0].replace(/\.$/, '') : `${quotes.length} of your stocks report this week`,
    html: `<p>${lines.join('<br>')}</p><p><a href="https://epiphany.jaybulb.com">Open Epiphany</a></p>`
      + '<p style="color:#888;font-size:12px">You turned on the weekly earnings email in Epiphany. Delete that alert to stop it.</p>',
  };
}

export default async function handler(req, res) {
  const auth = verifyCronSecret(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
  if (!sparkConfigured()) return res.status(503).json({ error: 'Database not configured' });

  const subscribers = [...new Set(((await sparkRequest('alerts?kind=eq.digest&select=user_email')) || []).map((r) => r.user_email))];
  let sent = 0;
  for (const email of subscribers) {
    const rows = (await sparkRequest(`watchlists?user_email=eq.${encodeURIComponent(email)}&select=symbol`)) || [];
    const symbols = [...new Set(rows.map((r) => r.symbol))].slice(0, 50);
    if (!symbols.length) continue;
    const soon = reportingThisWeek((await fetchYahooBatch(symbols)) || []);
    if (!soon.length) continue;
    try { await sendEmail({ to: email, ...digestEmail(soon) }); sent += 1; } catch (e) { console.warn('[earnings-digest] mail failed', e.message); }
  }
  return res.status(200).json({ subscribers: subscribers.length, emails: sent });
}
