// Demo financial data extracted from finn/index.html
// Serves as placeholder until user uploads their own balance sheet

export const DEMO_HOLDINGS = [
  { symbol: 'AAPL', shares: 0.0115, costBasis: 259.13, currency: 'USD' },
  { symbol: 'HOOD', shares: 0.0384, costBasis: 78.13, currency: 'USD' },
  { symbol: 'IBM', shares: 0.006, costBasis: 291.67, currency: 'USD' },
  { symbol: 'NVDA', shares: 0.0084, costBasis: 194.05, currency: 'USD' },
  { symbol: 'ORCL', shares: 0.0126, costBasis: 153.97, currency: 'USD' },
  { symbol: 'SLV', shares: 0.045, costBasis: 66.67, currency: 'USD' },
  { symbol: 'SNDK', shares: 0.0065, costBasis: 606.15, currency: 'USD' },
];

export const DEMO_ACCOUNTS = [
  { name: 'Vacation', type: 'chequing', balance: 342.58, currency: 'CAD' },
  { name: 'TFSA', type: 'investment', balance: 536.02, currency: 'CAD' },
  { name: 'Starbucks Card', type: 'gift', balance: 9.74, currency: 'CAD' },
];

export const DEMO_BUDGET = {
  income: [
    { name: 'PWD Benefits', amount: 1050, frequency: 'monthly', note: 'PWD: $1,500 pending approval' },
  ],
  expenses: [
    { name: 'Food', amount: 374, frequency: 'monthly', note: '4-month avg' },
    { name: 'Phone + Watch', amount: 165, frequency: 'monthly', note: 'Telus 5G+ $115 + device $50.38' },
    { name: 'Gym', amount: 30, frequency: 'monthly' },
    { name: 'Claude Pro', amount: 35, frequency: 'monthly', note: '$288 USD/year billed annually' },
    { name: 'ChatGPT Plus', amount: 20, frequency: 'monthly', note: '$20 USD (considering $100/mo AI tools budget)' },
  ],
};

export const DEMO_DEBT = [
  { name: 'Mom', balance: 140, rate: 0, minPayment: 0, note: 'Movies + YouTube Premium + misc' },
  { name: 'RBC VISA', balance: 5500, rate: 0, minPayment: 0, note: 'Collections' },
  { name: 'Bell', balance: 906.22, rate: 0, minPayment: 0, note: 'Suspended if unpaid' },
  { name: 'Telus', balance: 788.08, rate: 0, minPayment: 50.38, note: 'Easy Payment: $50.38/mo x 20mo' },
];

export const DEMO_GOALS = [
  { name: 'Pay off debt', target: 7334.30, saved: 0, priority: 'high', deadline: '2027-07' },
  { name: 'MacBook Pro', target: 3500, saved: 0, priority: 'medium', note: 'After debt' },
  { name: 'Apple Watch Ultra', target: 1200, saved: 0, priority: 'medium', note: '$50/mo financing' },
  { name: 'GBA SP + Pokemon Sapphire', target: 320, saved: 0, priority: 'low' },
  { name: 'Gold Chain', target: 2500, saved: 0, priority: 'low' },
  { name: 'Dog', target: 5000, saved: 0, priority: 'low', note: 'After stable income' },
];

export const DEMO_SPENDING = [
  { month: 'Oct 2025', total: 2203, categories: { food: 847, transfers: 155, phone: 156, claude: 31, subscriptions: 14, uncategorized: 1000 } },
  { month: 'Nov 2025', total: 1905, categories: { food: 420, shopping: 120, phone: 32, claude: 31, subscriptions: 22, uncategorized: 1280 } },
  { month: 'Dec 2025', total: 1055, categories: { food: 156, shopping: 80, vape: 75, claude: 31, subscriptions: 19, uncategorized: 694 } },
  { month: 'Jan 2026', total: 594, categories: { food: 75, shopping: 20, health: 25, claude: 43, uncategorized: 431 } },
];

export const DEMO_GIVING = [
  { name: 'Rainbow Railroad', amount: 5, frequency: 'monthly', active: false, note: 'After debt cleared' },
  { name: 'Egale Canada', amount: 5, frequency: 'monthly', active: false, note: 'After debt cleared' },
  { name: 'QMUNITY', amount: 5, frequency: 'monthly', active: false, note: 'After debt cleared' },
  { name: 'Trevor Project', amount: 5, frequency: 'monthly', active: false, note: 'After debt cleared' },
];

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
