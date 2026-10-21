export const SUMMARY_VERSION = 4;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONEY_RE = /^[–-]?\$?[\d,]+\.\d{2}$/;
// Columns arrive mashed together from pdf-parse and space-separated from unpdf
// and PDFKit, so every gap is optional whitespace.
const INLINE_RE = /^(\d{4}-\d{2}-\d{2})\s*(\d{4}-\d{2}-\d{2})\s*(.+?)\s*([–−-]?\$?[\d,]+\.\d{2})\s*(\$?[–−-]?[\d,]+\.\d{2})$/;

const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
const MONTH_NAMES = Object.keys(MONTHS).join('|');
const STATEMENT_YEAR_RE = /STATEMENT\s+(?:FROM|PERIOD)\s+\w+\.?\s+\d{1,2},?\s+(?:TO\s+)?\w+\.?\s+\d{1,2},?\s+(\d{4})/i;
const STATEMENT_YEAR_RE2 = /(?:STATEMENT|PERIOD)\s+.*?(\d{4})/i;
const CC_LINE_RE = new RegExp(
  `^(${MONTH_NAMES})\\.?\\s+(\\d{1,2})\\s+(${MONTH_NAMES})\\.?\\s+(\\d{1,2})\\s+(.+?)\\s+(-?\\$?[\\d,]+\\.\\d{2})$`,
  'i'
);

function parseMoney(raw) {
  if (typeof raw !== 'string') return null;
  const normalized = raw.replace(/[–−]/g, '-').replace(/\$/g, '').replace(/,/g, '').trim();
  const value = Number.parseFloat(normalized);
  return Number.isFinite(value) ? value : null;
}

function roundMoney(value) {
  return Math.round(value * 100) / 100;
}

function monthLabelFromDate(dateString) {
  const date = new Date(`${dateString}T00:00:00Z`);
  return Number.isNaN(date.getTime())
    ? dateString
    : date.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function monthDayToISO(monthAbbr, day, year) {
  const m = MONTHS[monthAbbr.toLowerCase().slice(0, 3)];
  if (m === undefined) return null;
  return `${year}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// Picks the YYYY-MM the statement really belongs to: the month holding the most
// transactions. Returns a representative date string in that month, or '' if the
// list has no usable dates. Ties go to the later month.
function dominantMonthDate(transactions = []) {
  const counts = new Map();

  for (const txn of transactions) {
    const date = txn?.date;
    if (typeof date !== 'string' || !DATE_RE.test(date)) continue;
    const key = date.slice(0, 7);
    const entry = counts.get(key);
    if (entry) entry.count += 1;
    else counts.set(key, { count: 1, date });
  }

  let best = null;
  for (const [key, entry] of counts) {
    if (!best || entry.count > best.count || (entry.count === best.count && key > best.key)) {
      best = { key, count: entry.count, date: entry.date };
    }
  }

  return best?.date || '';
}

export function categorizeTransaction(description = '') {
  const lower = description.toLowerCase();

  if (
    lower.includes('direct deposit') ||
    lower.includes('transfer in') ||
    lower.includes('interest earned')
  ) {
    return null;
  }

  if (lower.includes('payment') && (lower.includes('thank you') || lower.includes('merci') || lower.includes('paiement'))) return null;

  if (lower.includes('e-transfer') || lower.includes('interac e-transfer')) return 'etransfer_friends';
  if (lower.includes('abm withdrawal') || lower.includes('atm withdrawal') || lower.includes('cash withdrawal')) return 'atm_withdrawals';
  // Internal account-to-account moves (e.g. funding the prepaid card) are not
  // spending — the card's purchases already appear as their own transactions.
  if (lower.includes('transfer out')) return null;
  if (lower.includes('transfer')) return 'inter_account';
  if (lower.includes('starbucks')) return 'starbucks';
  if (lower.includes('subway') || lower.includes('wendy') || lower.includes('dominos') || lower.includes('pizza') || lower.includes("mcdonald") || lower.includes("triple o") || lower.includes("tripple o") || lower.includes("a&w") || lower.includes("chachi") || lower.includes('chipotle') || lower.includes('firehouse') || lower.includes('dairy queen') || lower.includes('freshslice') || lower.includes("moreno")) return 'food';
  if (lower.includes('apple.com') || lower.includes('mac mini') || lower.includes('macbook') || lower.includes('apple computer')) return 'tech';
  // ponytail: groceries, pharmacy and coffee used to fall into the generic
  // 'shopping'/'food' buckets, which is why the pie chart read as vague — the
  // largest recurring lines were invisible inside a catch-all wedge. These three
  // must stay ABOVE the 'shopping' and generic-food checks or they'd be swallowed.
  if (lower.includes('costco') || lower.includes('walmart') || lower.includes('wal-mart') || lower.includes('save on') || lower.includes('save-on') || lower.includes('nofrills') || lower.includes('no frills') || lower.includes('real cdn') || lower.includes('superstore') || lower.includes('safeway') || lower.includes('t&t') || lower.includes('freshco') || lower.includes('iga ') || lower.includes('produce')) return 'groceries';
  if (lower.includes('shoppers') || lower.includes('london drugs') || lower.includes('pharmacy') || lower.includes('rexall') || lower.includes('pharmasave')) return 'pharmacy';
  if (lower.includes('tim horton') || lower.includes('blenz') || lower.includes('jj bean') || lower.includes('waves coffee') || lower.includes('coffee') || lower.includes('cafe') || lower.includes('espresso')) return 'coffee';
  if (lower.includes('netflix') || lower.includes('spotify') || lower.includes('icloud') || lower.includes('youtube premium') || lower.includes('disney') || lower.includes('crave') || lower.includes('patreon') || lower.includes('prime video')) return 'subscriptions';
  if (lower.includes('apple store') || lower.includes('dollarama') || lower.includes('marshalls') || lower.includes('homesense') || lower.includes('langley toy') || lower.includes('super fantastic') || lower.includes('mcfrugal')) return 'shopping';
  if (lower.includes('vapory') || lower.includes('vape street')) return 'vape';
  if (lower.includes('liquor') || lower.includes('shooter')) return 'liquor';
  if (lower.includes('cannabis') || lower.includes('420')) return 'cannabis';
  if (lower.includes('claude') || lower.includes('anthropic') || lower.includes('openai') || lower.includes('chatgpt') || lower.includes('twilio') || lower.includes('codex')) return 'apps';
  if (lower.includes('compass') || lower.includes('chv')) return 'transit';
  if (lower.includes('chevron') || lower.includes('super save gas') || lower.includes('petro') || lower.includes('esso') || lower.includes('shell')) return 'gas';
  if (lower.includes('homes alive') || lower.includes('pet')) return 'pets';
  if (lower.includes('coin laundry') || lower.includes("kim's coin")) return 'laundry';
  if (lower.includes('club')) return 'fitness';
  if (lower.includes('bclc')) return 'entertainment';
  if (lower.includes('lordco') || lower.includes('auto')) return 'auto';
  if (lower.includes('accounting') || lower.includes('trinity')) return 'services';
  return 'uncategorized';
}

function parseWealthsimple(lines) {
  const transactions = [];

  for (const line of lines) {
    const m = INLINE_RE.exec(line);
    if (!m) continue;
    const amount = parseMoney(m[4]);
    const balance = parseMoney(m[5]);
    if (amount === null || balance === null) continue;
    const description = m[3].trim();
    transactions.push({
      date: m[1],
      postedDate: m[2],
      description,
      amount,
      balance,
      category: categorizeTransaction(description),
    });
  }

  if (transactions.length > 0) return transactions;

  for (let i = 0; i < lines.length - 4; i += 1) {
    if (!DATE_RE.test(lines[i]) || !DATE_RE.test(lines[i + 1])) continue;
    if (!MONEY_RE.test(lines[i + 3]) || !MONEY_RE.test(lines[i + 4])) continue;

    const amount = parseMoney(lines[i + 3]);
    const balance = parseMoney(lines[i + 4]);

    if (amount === null || balance === null) continue;

    transactions.push({
      date: lines[i],
      postedDate: lines[i + 1],
      description: lines[i + 2],
      amount,
      balance,
      category: categorizeTransaction(lines[i + 2]),
    });

    i += 4;
  }

  return transactions;
}

function parseCreditCard(lines, fullText) {
  let year = null;
  const yearMatch = STATEMENT_YEAR_RE.exec(fullText) || STATEMENT_YEAR_RE2.exec(fullText);
  if (yearMatch) year = parseInt(yearMatch[1], 10);
  if (!year) year = new Date().getFullYear();

  const transactions = [];

  for (const line of lines) {
    const m = CC_LINE_RE.exec(line);
    if (!m) continue;

    const date = monthDayToISO(m[1], parseInt(m[2], 10), year);
    const postedDate = monthDayToISO(m[3], parseInt(m[4], 10), year);
    if (!date || !postedDate) continue;

    const description = m[5].trim();
    const rawAmount = m[6];
    const amount = parseMoney(rawAmount);
    if (amount === null) continue;

    // Credit card: positive amounts are charges, negative are payments/credits
    // Normalize to negative = spending for consistency with bank statements
    const normalizedAmount = rawAmount.startsWith('-') ? amount : -amount;

    transactions.push({
      date,
      postedDate,
      description,
      amount: normalizedAmount,
      balance: null,
      category: categorizeTransaction(description),
    });
  }

  return transactions;
}

export function parseStatementText(text = '') {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^page \d+ of \d+$/i.test(line))
    .filter((line) => !line.startsWith('Wealthsimple Payments Inc.'))
    .filter((line) => line !== 'DATE' && line !== 'POSTED DATE' && line !== 'DESCRIPTION' && line !== 'AMOUNT (CAD)' && line !== 'BALANCE (CAD)')
    .filter((line) => !line.startsWith('DATEPOSTED DATE'));

  const wealthsimple = parseWealthsimple(lines);
  if (wealthsimple.length > 0) return wealthsimple;

  const creditCard = parseCreditCard(lines, text);
  if (creditCard.length > 0) return creditCard;

  return [];
}

// Merchant key for "fix it once": store numbers, dates and a trailing province or
// city code are dropped, so TIM HORTONS #1234 VANCOUVER BC and TIM HORTONS #77 match.
export const MIN_MERCHANT_KEY_LENGTH = 3;

export function normalizeMerchant(description = '') {
  const tokens = String(description)
    .toUpperCase()
    .replace(/\d{1,4}[/.-]\d{1,2}(?:[/.-]\d{1,4})?/g, ' ')
    .replace(/#/g, ' ')
    .replace(/[^A-Z&' ]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  while (tokens.length > 1 && /^[A-Z]{2}$/.test(tokens[tokens.length - 1])) tokens.pop();
  return tokens.join(' ').toLowerCase();
}

// rules maps a merchant key to the category the user chose for it. Returns the
// same transaction objects when nothing changes, so callers can detect a no-op.
export function applyCategoryRules(transactions = [], rules = {}) {
  if (!rules || typeof rules !== 'object') return transactions;
  return transactions.map((txn) => {
    const key = normalizeMerchant(txn?.description);
    if (key.length < MIN_MERCHANT_KEY_LENGTH || !Object.hasOwn(rules, key)) return txn;
    return rules[key] === txn.category ? txn : { ...txn, category: rules[key] };
  });
}

// Charges that repeat. Within a merchant key, charges are split into amount bands
// (within 15%), so two plans at one gym are two rows and a price change starts a
// new band. A band counts when it spans 2+ months, about once per month, with a gap
// near a month or a year. Coffee shops fail the once-a-month test.
const DAY_MS = 24 * 3600 * 1000;
const CADENCES = [
  { name: 'biweekly', min: 12, max: 16, days: 14, perMonth: 2.6 },
  { name: 'monthly', min: 26, max: 35, days: 30, perMonth: 1.5 },
  { name: 'yearly', min: 350, max: 380, days: 365, perMonth: 1.1 },
];
export function detectRecurring(transactions = [], today = new Date()) {
  const groups = new Map();
  for (const txn of transactions) {
    if (!(txn?.amount < 0) || !DATE_RE.test(txn?.date || '')) continue;
    // Banks rename the same biller ("PRE AUTHORIZED DEBIT TO ABC CLUB", "ABC CLUB
    // FITNESS"), so recurring matching drops the bank prefix and keeps two words.
    const key = normalizeMerchant(txn.description)
      .replace(/^(pre ?authorized debit( to)?|pad( to)?|pos purchase|purchase)\s+/, '')
      .split(' ').slice(0, 2).join(' ');
    // Money moved between your own accounts or to people is not a bill.
    if (key.length < MIN_MERCHANT_KEY_LENGTH || /^(transfer|e transfer|interac|withdrawal|atm)\b/.test(key)) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(txn);
  }

  // Judge "stopped" against the newest statement, not the clock: months without an
  // upload should not make every subscription look cancelled.
  const newest = Math.max(...[...groups.values()].flat().map((t) => Date.parse(`${t.date}T00:00:00Z`)));
  const ref = Math.min(today.getTime(), newest);
  const out = [];
  for (const [key, all] of groups) {
    const bands = [];
    for (const txn of [...all].sort((a, b) => Math.abs(a.amount) - Math.abs(b.amount))) {
      const band = bands[bands.length - 1];
      if (band && Math.abs(txn.amount) <= Math.abs(band[0].amount) * 1.15) band.push(txn);
      else bands.push([txn]);
    }
    for (const band of bands) {
      const txns = band.sort((a, b) => a.date.localeCompare(b.date));
      const months = new Set(txns.map((t) => t.date.slice(0, 7))).size;
      if (months < 2) continue;
      const times = txns.map((t) => Date.parse(`${t.date}T00:00:00Z`));
      const gaps = times.slice(1).map((t, i) => (t - times[i]) / DAY_MS).sort((a, b) => a - b);
      const gap = gaps[Math.floor(gaps.length / 2)];
      const cadence = CADENCES.find((c) => gap >= c.min && gap <= c.max);
      // The rate check is what keeps a daily coffee out.
      if (!cadence || txns.length / months > cadence.perMonth) continue;
      const last = txns[txns.length - 1];
      const next = new Date(times[times.length - 1] + cadence.days * DAY_MS);
      // Two missed cycles: probably cancelled.
      if (ref - next > cadence.days * 1.2 * DAY_MS) continue;
      const amount = Math.abs(last.amount);
      const prev = Math.abs(txns[txns.length - 2].amount);
      out.push({
        merchant: key,
        name: last.description,
        amount,
        cadence: cadence.name,
        lastDate: last.date,
        nextDate: next.toISOString().slice(0, 10),
        priceDelta: Math.round((amount - prev) * 100) / 100,
        count: txns.length,
      });
    }
  }
  return out.sort((a, b) => a.nextDate.localeCompare(b.nextDate));
}

export function summarizeTransactions(transactions = [], filename = '') {
  const filtered = transactions.filter((txn) => typeof txn?.amount === 'number' && txn.category && txn.amount < 0);
  const categories = {};

  for (const txn of filtered) {
    const delta = roundMoney(-txn.amount);
    categories[txn.category] = roundMoney((categories[txn.category] || 0) + delta);
  }

  const cleanCategories = Object.fromEntries(
    Object.entries(categories).filter(([, amount]) => Math.abs(amount) >= 0.01)
  );

  // ponytail: the statement's month is the month MOST of its transactions fall in,
  // not the first one's. A credit-card cycle runs mid-month to mid-month (e.g.
  // Jun 25 - Jul 24), so keying off `filtered[0].date` labelled the July statement
  // "Jun" — and since the upload handler dedupes by this month string, uploading
  // July then silently deleted June and replaced it. That is the "June was fine,
  // July no luck" bug. Ties break to the later month (statements are named for the
  // month they close in).
  const periodDate = dominantMonthDate(filtered.length > 0 ? filtered : transactions);
  const sortKey = periodDate ? periodDate.slice(0, 7) : filename;
  const month = periodDate ? monthLabelFromDate(periodDate) : filename.replace(/\.pdf$/i, '');
  const total = roundMoney(Object.values(cleanCategories).reduce((sum, amount) => sum + amount, 0));

  return {
    month,
    sortKey,
    total,
    categories: cleanCategories,
    source: filename,
    // Bumped to 4 when the month became the dominant month rather than the first
    // transaction's. refreshStoredStatements re-parses anything below this.
    version: SUMMARY_VERSION,
    importedAt: new Date().toISOString(),
  };
}
