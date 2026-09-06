// A debt row with owedToMe: true is money someone owes you, not money you owe.
// It counts as an asset in net worth and stays out of every payoff calculation.
export const isReceivable = (d) => d?.owedToMe === true;
export const owedDebts = (list) => (Array.isArray(list) ? list : []).filter((d) => !isReceivable(d));
export const sumDebt = (list) => owedDebts(list).reduce((s, d) => s + (d.balance || 0), 0);
export const sumReceivable = (list) => (Array.isArray(list) ? list : []).filter(isReceivable).reduce((s, d) => s + (d.balance || 0), 0);

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
