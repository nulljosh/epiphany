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

// Bills in the next `days`, rolled forward by cadence like projectCash, grouped by month with a total each.
// Mirrors CashProjection.billsByMonth.
export function billsByMonth(bills = [], today = new Date(), days = 60) {
  const day0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const end = new Date(day0); end.setDate(end.getDate() + days);
  const groups = {};
  for (const r of bills) {
    let d = new Date(`${r.nextDate}T00:00:00`);
    if (Number.isNaN(d.getTime()) || !(r.amount > 0)) continue;
    while (d < day0) d = step(d, r.cadence);
    for (; d <= end; d = step(d, r.cadence)) {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      (groups[key] ||= []).push({ merchant: r.merchant, amount: r.amount, date: d });
    }
  }
  return Object.keys(groups).sort().map((month) => ({
    month,
    total: groups[month].reduce((s, b) => s + b.amount, 0),
    items: groups[month].sort((a, b) => a.date - b.date),
  }));
}

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

// What is still to come between tomorrow and the end of this month: paydays in, bills out, and what that leaves.
// Reuses projectCash's cadence roll-forward. Mirrors CashProjection.restOfMonth.
export function restOfMonth(bills = [], income = [], today = new Date()) {
  const days = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate() - today.getDate();
  // Tomorrow to month end; anything due today counts as already gone.
  const sum = (b, i) => { const { points } = projectCash(0, b, i, today, days); return points[days].balance - points[0].balance; };
  const inn = days > 0 ? sum([], income) : 0;
  const out = days > 0 ? -sum(bills, []) : 0;
  return { in: inn, out, left: inn - out, month: today.toLocaleDateString(undefined, { month: 'long' }) };
}

// "+$954", "-$1.2K": short enough to sit under a bar. Mirrors MoneyGlance.compactSigned.
export const compactSigned = (n) => `${n < 0 ? '-' : '+'}${Math.abs(n) >= 1000 ? `$${(Math.abs(n) / 1000).toFixed(1)}K` : `$${Math.round(Math.abs(n))}`}`;

// This year's spending per category across statement months, biggest first, leaving out uncategorized.
// Mirrors TopSpending.yearToDate.
export function yearToDate(months = [], year = new Date().getFullYear(), n = 3) {
  const sums = {};
  let count = 0;
  for (const m of months) {
    if (!String(m.sortKey || '').startsWith(`${year}-`)) continue;
    count++;
    for (const [name, v] of Object.entries(m.categories || {})) {
      if (v > 0 && name !== 'uncategorized') sums[name] = (sums[name] || 0) + v;
    }
  }
  const rows = Object.entries(sums).sort((a, b) => b[1] - a[1]).slice(0, n).map(([name, amount]) => ({ name, amount }));
  return { months: count, rows };
}

// The newest `n` transactions across statements, newest first. Mirrors RecentActivity.latest.
export function recentActivity(statements = [], n = 5) {
  return statements.flatMap((s) => s.transactions || [])
    .filter((t) => typeof t?.amount === 'number' && t.date)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .slice(0, n);
}

// Dividends and interest paid to you this year, read from statement descriptions. Mirrors RecentActivity.earned.
// ponytail: matches "dividend"/"div" and "interest" in the description; a bank that words it otherwise reads as zero.
export function earnedThisYear(statements = [], year = new Date().getFullYear()) {
  const out = { dividends: 0, interest: 0 };
  for (const t of statements.flatMap((s) => s.transactions || [])) {
    if (!(t?.amount > 0) || !String(t.date || '').startsWith(`${year}-`)) continue;
    if (/\bdiv(idend)?s?\b/i.test(t.description || '')) out.dividends += t.amount;
    else if (/\binterest\b/i.test(t.description || '')) out.interest += t.amount;
  }
  return out;
}

// "Good morning" by the hour, and what net worth did since the last visit ("Up CA$12.40 since yesterday").
// Mirrors Greeting in Shared/Greeting.swift.
export const greeting = (hour) => (hour < 5 ? 'Good evening' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening');
export function sinceLastVisit(prev, value, now = new Date()) {
  if (!prev || typeof prev.value !== 'number' || !(prev.at > 0) || typeof value !== 'number') return null;
  const diff = value - prev.value;
  if (Math.abs(diff) < 0.01) return null;
  const hours = (now.getTime() - prev.at) / 3600000;
  if (hours < 1) return null;
  const when = hours < 24 ? 'earlier today' : hours < 48 ? 'yesterday' : `${Math.floor(hours / 24)} days ago`;
  return { diff, when };
}

// "Due today", "Due tomorrow", "Due in 3 days". Mirrors CashProjection.dueLabel.
export function dueLabel(date, today = new Date()) {
  const day0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const n = Math.round((d - day0) / 86400000);
  return n <= 0 ? 'Due today' : n === 1 ? 'Due tomorrow' : `Due in ${n} days`;
}

// The newest statement month's spending added up day by day, beside the month before. Mirrors SpendRace.build.
// Counts debits with a category, the same rule as Money in vs spending (summarizeCashflow), so the totals agree.
export function spendRace(statements = []) {
  const byMonth = {};
  for (const t of statements.flatMap((s) => s.transactions || [])) {
    if (!(t?.amount < 0) || !t.category || !/^\d{4}-\d{2}-\d{2}$/.test(t.date || '')) continue;
    const m = t.date.slice(0, 7);
    const day = Number(t.date.slice(8, 10));
    (byMonth[m] ||= new Array(32).fill(0))[day] += -t.amount;
  }
  const months = Object.keys(byMonth).sort();
  if (months.length < 2) return null;
  const [prev, cur] = months.slice(-2);
  const run = (arr) => arr.slice(1).reduce((acc, v) => [...acc, (acc.at(-1) || 0) + v], []);
  const curRun = run(byMonth[cur]);
  const prevRun = run(byMonth[prev]);
  const lastDay = Math.max(...Object.keys(byMonth[cur]).filter((d) => byMonth[cur][d] > 0).map(Number));
  return { month: cur, prev, cur: curRun.slice(0, lastDay), before: prevRun, total: curRun[lastDay - 1], beforeAtDay: prevRun[lastDay - 1] };
}

// The merchant key detectRecurring groups by (server/api/recurring.js), so a transaction can be matched to its bill.
export function recurringKey(description = '') {
  const tokens = String(description).toUpperCase()
    .replace(/\d{1,4}[/.-]\d{1,2}(?:[/.-]\d{1,4})?/g, ' ').replace(/#/g, ' ').replace(/[^A-Z&' ]+/g, ' ')
    .split(/\s+/).filter(Boolean);
  while (tokens.length > 1 && /^[A-Z]{2}$/.test(tokens[tokens.length - 1])) tokens.pop();
  return tokens.join(' ').toLowerCase()
    .replace(/^(pre ?authorized debit( to)?|pad( to)?|pos purchase|purchase)\s+/, '')
    .split(' ').slice(0, 2).join(' ');
}

// The newest statement month's biggest single expense (debits with a category). Mirrors RecentActivity.biggest.
export function biggestExpense(statements = []) {
  const debits = statements.flatMap((s) => s.transactions || []).filter((t) => t?.amount < 0 && t.category && /^\d{4}-\d{2}/.test(t.date || ''));
  if (!debits.length) return null;
  const month = debits.map((t) => t.date.slice(0, 7)).sort().at(-1);
  return debits.filter((t) => t.date.startsWith(month)).reduce((a, b) => (b.amount < a.amount ? b : a));
}
