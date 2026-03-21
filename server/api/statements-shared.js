const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONEY_RE = /^[–-]?\$?[\d,]+\.\d{2}$/;
const INLINE_RE = /^(\d{4}-\d{2}-\d{2})(\d{4}-\d{2}-\d{2})(.+?)([–−-]?\$?[\d,]+\.\d{2})(\$?[–−-]?[\d,]+\.\d{2})$/;

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

export function categorizeTransaction(description = '') {
  const lower = description.toLowerCase();

  if (
    lower.includes('direct deposit') ||
    lower.includes('transfer in') ||
    lower.includes('interest earned')
  ) {
    return null;
  }

  if (lower.includes('interac e-transfer') || lower.includes('transfer out')) return 'transfers';
  if (lower.includes('starbucks') || lower.includes('dominos') || lower.includes('pizza') || lower.includes("mcdonald") || lower.includes("triple o") || lower.includes("a&w") || lower.includes("chachi")) return 'food';
  if (lower.includes('apple store') || lower.includes('london drugs') || lower.includes('dollarama') || lower.includes('marshalls') || lower.includes('homesense') || lower.includes('langley toy') || lower.includes('super fantastic')) return 'shopping';
  if (lower.includes('vapory')) return 'vape';
  if (lower.includes('liquor')) return 'alcohol';
  if (lower.includes('claude') || lower.includes('anthropic') || lower.includes('openai') || lower.includes('chatgpt') || lower.includes('twilio')) return 'apps';
  if (lower.includes('compass') || lower.includes('chv')) return 'transit';
  if (lower.includes('club')) return 'fitness';
  if (lower.includes('bclc')) return 'entertainment';
  return 'uncategorized';
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
