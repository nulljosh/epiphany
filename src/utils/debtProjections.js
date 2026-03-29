// Pure simulation functions for debt projections, spending scenarios, and net worth forecasting.
// All inputs come from portfolio data (debt[], budget, incomePhases[]).

/**
 * Simulate debt payoff with different spending cut scenarios.
 * Returns arrays of remaining debt per month for each scenario.
 * @param {number} totalDebt - starting total debt
 * @param {object} options - { months, basePayment, phases }
 *   phases: array of { startMonth, payment } indicating when surplus changes
 * @param {number[]} extraCuts - array of additional monthly amounts freed per scenario
 * @returns {{ labels: string[], datasets: { label: string, data: number[] }[] }}
 */
export function simulateDebtCuts(totalDebt, { months = 30, phases = [] } = {}, scenarios = []) {
  const labels = Array.from({ length: months }, (_, i) => `Mo ${i}`);

  function paymentAtMonth(i) {
    for (let p = phases.length - 1; p >= 0; p--) {
      if (i >= phases[p].startMonth) return phases[p].payment;
    }
    return phases.length > 0 ? phases[0].payment : 100;
  }

  function simulate(extraPerMonth) {
    let debt = totalDebt;
    const arr = [];
    for (let i = 0; i < months; i++) {
      arr.push(Math.max(0, Math.round(debt)));
      debt -= paymentAtMonth(i) + extraPerMonth;
    }
    return arr;
  }

  return {
    labels,
    datasets: scenarios.map(s => ({
      label: s.label,
      data: simulate(s.extra),
      color: s.color,
    })),
  };
}

/**
 * Simulate avalanche, snowball, and do-nothing debt payoff strategies.
 * @param {Array} debts - [{ name, balance, rate, minPayment }]
 * @param {number} monthlyPayment - total monthly payment towards debt
 * @param {number} months - projection length
 * @returns {{ labels: string[], datasets: { label: string, data: number[], color: string }[] }}
 */
export function simulateStrategies(debts, monthlyPayment = 500, months = 36) {
  const labels = Array.from({ length: months }, (_, i) => `Mo ${i}`);

  function simulate(order) {
    const balances = debts.map(d => ({ ...d, bal: d.balance }));
    const arr = [];
    for (let i = 0; i < months; i++) {
      const total = balances.reduce((s, d) => s + Math.max(0, d.bal), 0);
      arr.push(Math.max(0, Math.round(total)));
      // accrue interest
      for (const d of balances) {
        if (d.bal > 0 && d.rate > 0) d.bal += d.bal * (d.rate / 100 / 12);
      }
      // pay in order
      let remaining = monthlyPayment;
      const sorted = [...balances].sort(order);
      for (const d of sorted) {
        if (remaining <= 0 || d.bal <= 0) continue;
        const pay = Math.min(remaining, d.bal);
        d.bal -= pay;
        remaining -= pay;
      }
    }
    return arr;
  }

  function doNothing() {
    const balances = debts.map(d => ({ ...d, bal: d.balance }));
    const arr = [];
    for (let i = 0; i < months; i++) {
      const total = balances.reduce((s, d) => s + Math.max(0, d.bal), 0);
      arr.push(Math.max(0, Math.round(total)));
      for (const d of balances) {
        if (d.bal > 0 && d.rate > 0) d.bal += d.bal * (d.rate / 100 / 12);
        d.bal = Math.max(0, d.bal - (d.minPayment || 0));
      }
    }
    return arr;
  }

  return {
    labels,
    datasets: [
      { label: 'Doing Nothing', data: doNothing(), color: '#ff453a' },
      { label: 'Snowball', data: simulate((a, b) => a.bal - b.bal), color: '#ffd60a' },
      { label: 'Avalanche (best)', data: simulate((a, b) => b.rate - a.rate), color: '#30d158' },
    ],
  };
}

/**
 * Project net worth over time given debt and phased income.
 * @param {number} totalDebt - starting debt
 * @param {Array} phases - [{ startMonth, payment }]
 * @param {number} months - projection length
 * @returns {{ labels: string[], data: number[] }}
 */
export function projectNetWorth(totalDebt, phases = [], months = 42) {
  const labels = Array.from({ length: months }, (_, i) => `Mo ${i}`);
  let debt = totalDebt;
  let savings = 0;
  const data = [];

  function paymentAtMonth(i) {
    for (let p = phases.length - 1; p >= 0; p--) {
      if (i >= phases[p].startMonth) return phases[p].payment;
    }
    return phases.length > 0 ? phases[0].payment : 100;
  }

  for (let i = 0; i < months; i++) {
    data.push(Math.round(savings - debt));
    const payment = paymentAtMonth(i);
    if (debt > 0) {
      debt = Math.max(0, debt - payment);
    } else {
      savings += payment;
    }
  }

  return { labels, data };
}

/**
 * Live projection of debt and savings given slider-based spending.
 * @param {number} totalDebt
 * @param {number} surplus - monthly surplus at Phase 2 income
 * @param {number} months - projection length
 * @returns {{ labels: string[], debt: number[], savings: number[] }}
 */
export function projectLive(totalDebt, surplus, months = 42) {
  const labels = Array.from({ length: months }, (_, i) => `Mo ${i}`);
  let debt = totalDebt;
  let savings = 0;
  const debtArr = [];
  const savingsArr = [];

  for (let i = 0; i < months; i++) {
    debtArr.push(Math.max(0, Math.round(debt)));
    savingsArr.push(Math.round(savings));
    // Phase 1: mo 0-2 ($100), Phase 2: mo 3-9 (surplus), Phase 3: mo 10+ (surplus+200), mo 20+: +155 Telus freed
    let payment = i < 3 ? 100 : i < 10 ? Math.max(0, surplus) : i < 20 ? Math.max(0, surplus + 200) : Math.max(0, surplus + 355);
    if (debt > 0) {
      debt -= payment;
    } else {
      savings += payment;
    }
  }

  return { labels, debt: debtArr, savings: savingsArr };
}

/**
 * Compute surplus and debt-free ETA from sliders.
 * @param {number} income - Phase 2 income
 * @param {number} fixedExpenses - cell + claude etc
 * @param {object} sliders - { food, vape, weed, other }
 * @param {number} totalDebt
 * @returns {{ surplus: number, monthsToPayoff: number, savingsAfter2yr: number }}
 */
export function computeSimulator(income, fixedExpenses, sliders, totalDebt) {
  const variable = (sliders.food || 0) + (sliders.vape || 0) + (sliders.weed || 0) + (sliders.other || 0);
  const surplus = income - fixedExpenses - variable;
  const monthsToPayoff = surplus > 0 ? Math.ceil(totalDebt / surplus) : Infinity;
  const postDebtMonths = Math.max(0, 24 - monthsToPayoff);
  const savingsAfter2yr = Math.max(0, postDebtMonths * surplus);

  return { surplus, monthsToPayoff, savingsAfter2yr };
}
