// Cash for the next `days` days: today's cash, minus each bill on its day, plus each payday.
// Statements lag, so a nextDate in the past rolls forward by its cadence until it lands on or after today.
// Mirrors CashProjection in Shared/CashProjection.swift.
const step = (d, cadence) => {
  const n = new Date(d);
  if (cadence === 'biweekly') n.setDate(n.getDate() + 14);
  else if (cadence === 'yearly') n.setFullYear(n.getFullYear() + 1);
  else n.setMonth(n.getMonth() + 1);
  return n;
};

export function projectCash(start, bills = [], income = [], today = new Date(), days = 30) {
  const day0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const end = new Date(day0); end.setDate(end.getDate() + days);
  const delta = new Array(days + 1).fill(0);
  let events = 0;
  for (const [items, sign] of [[bills, -1], [income, 1]]) {
    for (const r of items) {
      let d = new Date(`${r.nextDate}T00:00:00`);
      if (Number.isNaN(d.getTime()) || !(r.amount > 0)) continue;
      while (d < day0) d = step(d, r.cadence);
      for (; d <= end; d = step(d, r.cadence)) {
        delta[Math.round((d - day0) / 86400000)] += sign * r.amount;
        events++;
      }
    }
  }
  let balance = start;
  const points = delta.map((x, day) => ({ day, balance: (balance += x) }));
  const low = points.reduce((a, b) => (b.balance < a.balance ? b : a));
  return { points, low, events };
}

// Money in minus money out for the newest statement month. Says "this month" only when it is this month,
// so a statement that lags a month reads "Left in September" instead of passing as current.
export function leftThisMonth(cashflow = [], now = new Date()) {
  const m = cashflow.at(-1);
  if (!m) return null;
  const current = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const title = m.month === current ? 'Left this month'
    : `Left in ${new Date(`${m.month}-01T12:00:00`).toLocaleDateString('en-US', { month: 'long' })}`;
  return { title, left: m.in - m.out, in: m.in, out: m.out };
}

// One month's spending as its top `n` categories plus Other, with shares, biggest first. Mirrors MoneyGlance.topSpending.
export const SPEND_COLORS = ['#0071e3', '#30D158', '#FF9F0A', '#FF453A', '#8E8E93'];
export function topSpending(categories = {}, n = 4) {
  const rows = Object.entries(categories).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const total = rows.reduce((s, [, v]) => s + v, 0);
  if (!total) return [];
  const top = rows.slice(0, n).map(([name, amount]) => ({ name, amount }));
  const rest = rows.slice(n).reduce((s, [, v]) => s + v, 0);
  if (rest > 0) top.push({ name: 'other', amount: rest });
  return top.map((r) => ({ ...r, share: r.amount / total }));
}

// Bill history grid: the last `n` statement months and, per bill, whether it was paid in each.
// The months end at the newest month any bill was paid, since statements lag the clock. Mirrors BillHistory.grid.
export function billHistory(recurring = [], n = 6) {
  const all = recurring.flatMap((r) => r.months || []);
  if (!all.length) return { months: [], rows: [] };
  const [y, m] = all.sort().at(-1).split('-').map(Number);
  const months = Array.from({ length: n }, (_, i) => {
    const d = new Date(y, m - 1 - (n - 1 - i), 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const rows = recurring.filter((r) => r.months?.length)
    .map((r) => ({ name: r.merchant || r.name, amount: r.amount, paid: months.map((mo) => r.months.includes(mo)) }));
  return { months, rows };
}
