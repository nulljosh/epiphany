// User-specific financial data. Swap this file per-user or pull from KV.
// Eventually this will be loaded from the backend per authenticated user.

export const USER_HOLDINGS = [
  { symbol: 'GOOGL', shares: 0.0387, costBasis: 10.97, value: 11.51, account: 'TFSA' },
  { symbol: 'PLTR', shares: 0.0738, costBasis: 10.98, value: 10.81, account: 'TFSA' },
];

export const USER_ACCOUNTS = [
  { name: 'Vacation', type: 'chequing', balance: 107.41, institution: 'Wealthsimple' },
  { name: 'TFSA', type: 'tfsa', balance: 36.99, institution: 'Wealthsimple' },
];

export const USER_BUDGET = {
  income: [
    { name: 'Welfare', amount: 1000, frequency: 'monthly' },
  ],
  expenses: [
    { name: 'Food', amount: 300, frequency: 'monthly' },
    { name: 'Cell (Telus)', amount: 208, frequency: 'monthly' },
    { name: 'Cell (Bell)', amount: 167, frequency: 'monthly' },
    { name: 'Vape', amount: 150, frequency: 'monthly' },
    { name: 'Weed', amount: 75, frequency: 'monthly' },
    { name: 'Claude', amount: 80, frequency: 'monthly' },
    { name: 'Other', amount: 140, frequency: 'monthly' },
  ],
};

export const USER_DEBT = [
  { name: 'Visa', balance: 5000, rate: 19.99, minPayment: 500 },
  { name: 'Telus', balance: 800, rate: 0, minPayment: 208 },
  { name: 'Bell', balance: 942, rate: 0, minPayment: 167 },
];

export const USER_TELECOM = {
  account: '44699967',
  lines: [
    { number: '778-201-4533', label: 'Phone', plan: '5G 60GB Nationwide', planCost: 85, easyPayment: 50.38, totalWithTax: 145.58, deviceBalance: 1057.86, deviceEnd: '2027-10-21' },
    { number: '604-619-2834', label: 'Watch', plan: 'OneNumber 1GB Smartwatch', planCost: 15, easyPayment: 46.09, totalWithTax: 62.89, deviceBalance: 1013.82, deviceEnd: '2027-11-19' },
  ],
  billingHistory: [
    { month: '2025-10', total: 215.88, paid: true, note: 'Paid at Telus Willowbrook' },
    { month: '2025-11', total: 333.36, paid: false, note: 'Includes past due' },
    { month: '2025-12', total: 458.74, paid: false, note: '$243.19 past due + $215.55 new + $7.08 late fee' },
  ],
};

export const USER_BILLS = [
  { name: 'Telus', provider: 'TELUS Mobility', amount: 208.47, dueDay: 15, category: 'phone', account: '44699967' },
  { name: 'Bell', provider: 'Bell Mobility', amount: 167, dueDay: 23, category: 'phone' },
  { name: 'Claude', provider: 'Anthropic', amount: 31.36, dueDay: 25, category: 'subscription' },
  { name: 'Compass', provider: 'TransLink', amount: 10, dueDay: 27, category: 'transit' },
];

export const USER_GOALS = [
  { name: 'Apple Developer Account', target: 100, saved: 0, deadline: '', priority: 'high', note: 'Enables App Store revenue' },
  { name: 'French Bulldog', target: 5000, saved: 0, deadline: '', priority: 'low', note: '+$100/mo recurring' },
  { name: 'Car', target: 5000, saved: 0, deadline: '', priority: 'medium', note: 'Buy used, cash' },
  { name: 'MacBook', target: 4000, saved: 0, deadline: '', priority: 'medium', note: 'Dev tools investment' },
  { name: 'Chain', target: 2000, saved: 0, deadline: '', priority: 'low' },
];

export const USER_INCOME_PHASES = [
  { label: 'Base welfare', monthly: 1000, status: 'current', date: 'March 2026' },
  { label: 'Welfare bump', monthly: 1500, status: 'soon', date: '~Mid 2026' },
  { label: 'PWD + DTC', monthly: 1700, status: 'pending', date: '~Mid-Late 2026' },
];
