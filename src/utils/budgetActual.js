// Budget lines are typed by hand ("Food", "Weed"); statement spending is keyed by
// category ("food", "cannabis"). A line can name its categories outright; otherwise
// a keyword guess links the obvious ones and leaves the rest (phone bills) unlinked.
const KEYWORDS = [
  [/food|eat|dining|restaurant/i, ['food', 'groceries', 'coffee', 'starbucks']],
  [/grocer/i, ['groceries']],
  [/coffee|starbucks/i, ['coffee', 'starbucks']],
  [/vape/i, ['vape']],
  [/weed|cannabis/i, ['cannabis']],
  [/liquor|alcohol|booze|beer/i, ['liquor']],
  [/pharma|drug|meds/i, ['pharmacy']],
  [/shop/i, ['shopping']],
  [/tech/i, ['tech']],
  [/subscri/i, ['subscriptions']],
];

export function budgetCategories(item = {}) {
  if (Array.isArray(item.categories) && item.categories.length) return item.categories;
  if (item.category) return [item.category];
  const hit = KEYWORDS.find(([re]) => re.test(item.name || ''));
  return hit ? hit[1] : [];
}

// Spent in `month` (a spendingMonth with categories) against the line's budget.
// status: under 90% ok, up to 110% close, past that over. null when unlinked.
export function budgetActual(item = {}, month) {
  const cats = budgetCategories(item);
  if (!cats.length || !month?.categories || !(item.amount > 0)) return null;
  const spent = Math.round(cats.reduce((sum, c) => sum + (month.categories[c] || 0), 0) * 100) / 100;
  const ratio = spent / item.amount;
  return { spent, ratio, status: ratio <= 0.9 ? 'ok' : ratio <= 1.1 ? 'close' : 'over', month: month.month };
}

// What's left of the line's budget, spread over the days left this month ("$48 a day for 13 days").
// Only when `month` is this calendar month's statement and some is left; an older statement says nothing about today.
export function perDayLeft(item = {}, month, now = new Date()) {
  const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const actual = budgetActual(item, month);
  if (!actual || month.sortKey !== key) return null;
  const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate() + 1;
  const left = item.amount - actual.spent;
  return left > 0 ? { perDay: Math.floor(left / days), days } : null;
}
