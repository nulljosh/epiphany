// Demo financial data extracted from finn/index.html
// Serves as placeholder until user uploads their own balance sheet

export const DEMO_HOLDINGS = [
  { symbol: 'GOOGL', shares: 0.0277, costBasis: 7.97, value: 7.79, account: 'TFSA' },
  { symbol: 'PLTR', shares: 0.0381, costBasis: 5.99, value: 5.64, account: 'TFSA' },
];

export const DEMO_ACCOUNTS = [
  { name: 'Vacation', type: 'chequing', balance: 17.00, institution: 'Wealthsimple' },
  { name: 'TFSA', type: 'tfsa', balance: 118.94, institution: 'Wealthsimple' },
];

export const DEMO_BUDGET = {
  income: [],
  expenses: [],
};

export const DEMO_DEBT = [
];

export const DEMO_GOALS = [
];

export const DEMO_SPENDING = [
];

export const DEMO_GIVING = [
];

// CRA GST/HST credit: paid ~5th of Jan, Apr, Jul, Oct
function nextCRAQuarterlyDate() {
  const now = new Date();
  const quarterMonths = [0, 3, 6, 9]; // Jan, Apr, Jul, Oct (0-indexed)
  for (let offset = 0; offset <= 1; offset++) {
    for (const m of quarterMonths) {
      const d = new Date(now.getFullYear() + offset, m, 5);
      if (d >= new Date(now.getFullYear(), now.getMonth(), now.getDate())) return d;
    }
  }
  return null;
}

export const UPCOMING_PAYMENTS = [
  { name: 'GST/HST Credit', amount: 87.25, get date() { const d = nextCRAQuarterlyDate(); return d ? d.toISOString().slice(0, 10) : null; }, recurring: 'quarterly', icon: 'dollarsign.circle' },
];

// User-specific income scenarios for debt projection and spending comparison.
// Values are monthly amounts in CAD.
export const INCOME_SCENARIOS = {
  ei: { label: 'EI', monthly: 2200, color: '#FF9F0A' },
  pwd_dtc: { label: 'PWD+DTC', monthly: 1750, color: '#BF5AF2' },
  pwd_work: { label: 'PWD+Work', monthly: 2800, color: '#30D158' },
  actual: { label: 'Actual', monthly: 0, color: '#0A84FF' },
};

function roundMoney(value) {
  return Math.round(value * 100) / 100;
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

export function normalizeSpendingMonth(entry) {
  if (!entry || typeof entry !== 'object' || typeof entry.month !== 'string' || !entry.month.trim()) {
    return null;
  }

  const categories = Object.fromEntries(
    Object.entries(entry.categories || {})
      .map(([name, amount]) => [name, roundMoney(Number(amount))])
      .filter(([name, amount]) => typeof name === 'string' && name && isFiniteNumber(amount) && amount > 0)
  );

  const categoryTotal = roundMoney(
    Object.values(categories).reduce((sum, amount) => sum + amount, 0)
  );

  const rawTotal = isFiniteNumber(entry.total) ? roundMoney(entry.total) : 0;
  let total = rawTotal;

  if (categoryTotal > 0 && (total <= 0 || total < categoryTotal)) {
    total = categoryTotal;
  }

  total = Math.max(0, roundMoney(total));

  return {
    ...entry,
    month: entry.month.trim(),
    sortKey: typeof entry.sortKey === 'string' && entry.sortKey ? entry.sortKey : entry.month.trim(),
    total,
    categories,
  };
}

export function normalizeSpendingMonths(months) {
  if (!Array.isArray(months)) return [];

  return months
    .map((entry) => normalizeSpendingMonth(entry))
    .filter(Boolean)
    .sort((a, b) => String(a.sortKey || a.month).localeCompare(String(b.sortKey || b.month)));
}

export function normalizePortfolioData(data) {
  if (!data || typeof data !== 'object') return data;

  return {
    ...data,
    spending: normalizeSpendingMonths(data.spending || []),
  };
}

// Schema validation for user uploads
const ARRAY_FIELDS = ['holdings', 'accounts', 'debt', 'goals', 'spending', 'giving'];

export function validatePortfolioData(data) {
  if (!data || typeof data !== 'object') return { valid: false, error: 'Invalid data format' };

  const errors = [];

  for (const field of ARRAY_FIELDS) {
    if (data[field] && !Array.isArray(data[field])) errors.push(`${field} must be an array`);
  }

  if (Array.isArray(data.holdings)) {
    data.holdings.forEach((h, i) => {
      if (!h.symbol || typeof h.symbol !== 'string') errors.push(`holdings[${i}]: missing symbol`);
      if (typeof h.shares !== 'number' || h.shares < 0) errors.push(`holdings[${i}]: invalid shares`);
    });
  }

  if (data.budget && typeof data.budget === 'object') {
    if (data.budget.income && !Array.isArray(data.budget.income)) errors.push('budget.income must be an array');
    if (data.budget.expenses && !Array.isArray(data.budget.expenses)) errors.push('budget.expenses must be an array');
  }

  return errors.length > 0 ? { valid: false, error: errors.join('; ') } : { valid: true };
}
