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
