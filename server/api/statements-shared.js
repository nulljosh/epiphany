const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONEY_RE = /^[–-]?\$?[\d,]+\.\d{2}$/;
const INLINE_RE = /^(\d{4}-\d{2}-\d{2})(\d{4}-\d{2}-\d{2})(.+?)([–−-]?\$?[\d,]+\.\d{2})(\$?[–−-]?[\d,]+\.\d{2})$/;

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

  if (lower.includes('interac e-transfer') || lower.includes('transfer out')) return 'transfers';
  if (lower.includes('subway') || lower.includes('wendy') || lower.includes('starbucks') || lower.includes('dominos') || lower.includes('pizza') || lower.includes("mcdonald") || lower.includes("triple o") || lower.includes("tripple o") || lower.includes("a&w") || lower.includes("chachi") || lower.includes('chipotle') || lower.includes('firehouse') || lower.includes('dairy queen') || lower.includes('freshslice') || lower.includes("moreno")) return 'food';
  if (lower.includes('apple.com') || lower.includes('mac mini') || lower.includes('macbook') || lower.includes('apple computer')) return 'tech';
  if (lower.includes('apple store') || lower.includes('london drugs') || lower.includes('dollarama') || lower.includes('marshalls') || lower.includes('homesense') || lower.includes('langley toy') || lower.includes('super fantastic') || lower.includes('costco') || lower.includes('walmart') || lower.includes('wal-mart') || lower.includes('save on') || lower.includes('nofrills') || lower.includes('no frills') || lower.includes('real cdn') || lower.includes('shoppers') || lower.includes('mcfrugal')) return 'shopping';
  if (lower.includes('vapory') || lower.includes('vape street')) return 'vape';
  if (lower.includes('liquor') || lower.includes('shooter')) return 'alcohol';
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

  const firstDate = filtered[0]?.date || transactions[0]?.date || '';
  const sortKey = firstDate ? firstDate.slice(0, 7) : filename;
  const month = firstDate ? monthLabelFromDate(firstDate) : filename.replace(/\.pdf$/i, '');
  const total = roundMoney(Object.values(cleanCategories).reduce((sum, amount) => sum + amount, 0));

  return {
    month,
    sortKey,
    total,
    categories: cleanCategories,
    source: filename,
    version: 2,
    importedAt: new Date().toISOString(),
  };
}
