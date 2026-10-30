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

// YNAB's "move money": cover an overspent line from the line with the most left. Linked lines only, since an
// unlinked line has no spending to say what it can spare. Mirrors FinanceData.Budget.coverPlan.
const cents = (n) => Math.round(n * 100) / 100;
export function coverPlan(expenses = [], month, index) {
  const target = budgetActual(expenses[index], month);
  if (!target || target.spent <= expenses[index].amount) return null;
  let best = null;
  expenses.forEach((item, i) => {
    const a = i === index ? null : budgetActual(item, month);
    const room = a ? cents(item.amount - a.spent) : 0;
    if (room > 0 && (!best || room > best.room)) best = { from: i, room };
  });
  return best && { from: best.from, amount: Math.min(cents(target.spent - expenses[index].amount), best.room) };
}

// The total budget doesn't change: what one line gives, the other gets.
export const moveBudget = (expenses, from, to, amount) =>
  expenses.map((e, i) => (i === from ? { ...e, amount: cents(e.amount - amount) } : i === to ? { ...e, amount: cents(e.amount + amount) } : e));

// The month's whole budget against everything spent in the newest statement month. Mirrors BudgetRing.left.
export function budgetLeft(expenses = [], month) {
  const budget = expenses.reduce((s, e) => s + (e.amount > 0 ? e.amount : 0), 0);
  if (!(budget > 0) || !month) return null;
  const spent = month.total || 0;
  return { budget, spent, left: budget - spent, ratio: spent / budget, month: month.month };
}

// How far through the month today is (0 to 1), for a marker on budget bars. Only for this month's statement;
// a lagging statement's month is over, so no marker. Mirrors BudgetRing.pace.
export function monthPace(month, now = new Date()) {
  const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  if (month?.sortKey !== key) return null;
  return now.getDate() / new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
}
