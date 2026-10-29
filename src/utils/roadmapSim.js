const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function simulate({
  monthlyExpenses,
  annualReturn,
  sweStartSalary,
  sweStartYear,
  startDebt,
  horizonYears,
  monthlyIncome = 2000,
}) {
  const monthlyReturn = Math.pow(1 + annualReturn, 1 / 12) - 1;
  let debt = startDebt;
  let rdsp = 0;
  let tfsa = 0;
  const rows = [];
  const startYear = 2026;
  const startMonth = 0;

  for (let i = 0; i < horizonYears * 12; i++) {
    const year = startYear + Math.floor((startMonth + i) / 12);
    const month = (startMonth + i) % 12;
    const dateLabel = `${MONTHS[month]} ${String(year).slice(2)}`;

    const income = year >= sweStartYear ? sweStartSalary / 12 : monthlyIncome;

    let surplus = income - monthlyExpenses;

    if (debt > 0 && surplus > 0) {
      const payment = Math.min(debt, surplus);
      debt -= payment;
      surplus -= payment;
    }

    if (debt <= 0 && surplus > 0) {
      // CDSG: $1,500 a year of contributions earns the full $3,500 grant.
      const targetPersonal = 1500;
      const targetGrant = 3500;
      const monthlyPersonal = targetPersonal / 12;
      const monthlyGrant = targetGrant / 12;
      const rdspContrib = Math.min(surplus, monthlyPersonal);
      rdsp += rdspContrib;
      const grantRatio = monthlyPersonal > 0 ? rdspContrib / monthlyPersonal : 0;
      rdsp += monthlyGrant * grantRatio;
      surplus -= rdspContrib;
    }

    if (surplus > 0) {
      tfsa += surplus;
      surplus = 0;
    }

    rdsp *= 1 + monthlyReturn;
    tfsa *= 1 + monthlyReturn;

    const netWorth = rdsp + tfsa - debt;
    rows.push({
      date: dateLabel,
      year,
      month,
      debt: Math.round(debt),
      debtNeg: -Math.round(debt),
      rdsp: Math.round(rdsp),
      tfsa: Math.round(tfsa),
      netWorth: Math.round(netWorth),
    });
  }

  const debtFree = rows.find((r) => r.debt === 0);
  const hit100k = rows.find((r) => r.netWorth >= 100000);
  const hit500k = rows.find((r) => r.netWorth >= 500000);
  const hit1m = rows.find((r) => r.netWorth >= 1000000);

  return { rows, milestones: { debtFree, hit100k, hit500k, hit1m } };
}
