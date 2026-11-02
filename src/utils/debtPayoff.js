// A debt row with owedToMe: true is money someone owes you, not money you owe.
// It counts as an asset in net worth and stays out of every payoff calculation.
export const isReceivable = (d) => d?.owedToMe === true;
export const owedDebts = (list) => (Array.isArray(list) ? list : []).filter((d) => !isReceivable(d));
export const sumDebt = (list) => owedDebts(list).reduce((s, d) => s + (d.balance || 0), 0);
export const sumReceivable = (list) => (Array.isArray(list) ? list : []).filter(isReceivable).reduce((s, d) => s + (d.balance || 0), 0);

// A debt with a monthly payment and a `since` month ("2026-08") pays itself down: one payment a month, interest
// first, then re-anchored to this month so a save-back never counts the same months twice. Phone financing and
// other fixed plans count down on their own. Mirrors DebtItem.paidDown in Shared/FinanceData.swift.
export function paidDown(d, now = new Date()) {
  const m = /^(\d{4})-(\d{2})$/.exec(d?.since || '');
  if (!m || !(d.minPayment > 0) || isReceivable(d)) return d;
  const months = (now.getFullYear() - +m[1]) * 12 + now.getMonth() + 1 - +m[2];
  if (months <= 0) return d;
  const r = (d.rate || 0) / 100 / 12;
  let balance = d.balance || 0;
  for (let i = 0; i < months && balance > 0; i++) balance = balance * (1 + r) - d.minPayment;
  return { ...d, balance: Math.max(0, Math.round(balance * 100) / 100), since: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}` };
}

export function debtMonthsToPayoff(balance, minPayment, rate) {
  if (balance <= 0) return 0;
  if (minPayment <= 0) return Infinity;
  if (balance <= minPayment) return 0;
  const monthlyRate = (rate || 0) / 100 / 12;
  if (monthlyRate <= 0) return balance / minPayment;
  const ratio = balance * monthlyRate / minPayment;
  if (ratio >= 1) return Infinity;
  return -Math.log(1 - ratio) / Math.log(1 + monthlyRate);
}

export function debtPayoffLabel(months) {
  if (!isFinite(months)) return 'n/a';
  if (months < 0.1) return 'now';
  const days = months * 30.44;
  if (days < 30) return `${Math.round(days)}d`;
  return `~${Math.round(months)}mo`;
}

// The month you'd be debt-free after `months`, as "May 2027". Mirrors DebtPayoff.plan's finish.
export function debtFreeBy(months, now = new Date()) {
  if (!isFinite(months)) return null;
  return new Date(now.getFullYear(), now.getMonth() + Math.ceil(months), 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}
