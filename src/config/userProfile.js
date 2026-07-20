// User-specific financial data. Swap this file per-user or pull from KV.
// Eventually this will be loaded from the backend per authenticated user.

// Sold all stock positions -- cash only. Stocks (if any) come from
// brokerage sync (SnapTrade) once connected in Settings.
export const USER_HOLDINGS = [];

// Accounts come exclusively from brokerage sync (SnapTrade) -- no manual
// seed rows. Synced accounts carry source: 'broker'.
export const USER_ACCOUNTS = [];

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
    { name: 'Claude', amount: 30, frequency: 'monthly' },
    { name: 'Other', amount: 140, frequency: 'monthly' },
  ],
};

export const USER_DEBT = [
  { name: 'Phone (device)', balance: 780, rate: 0, minPayment: 0 },
  { name: 'Telus (current month)', balance: 300, rate: 0, minPayment: 0, note: 'Paid $310 on 2026-05-26, ~$300 remaining' },
  { name: 'Mom/Dad', balance: 450, rate: 0, minPayment: 0, note: '$275 + $175 passport' },
  { name: 'Bell', balance: 1000, rate: 0, minPayment: 0 },
  { name: 'Visa', balance: 5000, rate: 0, minPayment: 0, note: 'In collections, lump-sum payoff in a year+' },
];

// One-off received credits (not recurring income).
export const USER_CREDITS = [
  { name: 'GST/HST credit', amount: 100, received: true, date: '2026-06' },
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
    { month: '2026-05', total: 672.90, paid: false, note: '$335.88 new + $337.02 past due, due 2026-05-26' },
  ],
};

export const USER_BILLS = [
  { name: 'Telus', provider: 'TELUS Mobility', amount: 208.47, dueDay: 15, category: 'phone', account: '44699967' },
  { name: 'Bell', provider: 'Bell Mobility', amount: 167, dueDay: 23, category: 'phone' },
  { name: 'Compass', provider: 'TransLink', amount: 10, dueDay: 27, category: 'transit' },
];

export const USER_GOALS = [
  { name: 'Apple Developer Account', target: 100, saved: 0, deadline: '', priority: 'high', note: 'Enables App Store revenue' },
  { name: 'French Bulldog', target: 5000, saved: 0, deadline: '', priority: 'low', note: '+$100/mo recurring' },
  { name: 'Car', target: 5000, saved: 0, deadline: '', priority: 'medium', note: 'Buy used, cash' },
  { name: 'MacBook', target: 4000, saved: 0, deadline: '', priority: 'medium', note: 'Dev tools investment' },
  { name: 'Chain', target: 2000, saved: 0, deadline: '', priority: 'low' },
];

export const USER_SUBSCRIPTIONS = [
  { name: 'Claude Pro', provider: 'Anthropic', amount: 30, currency: 'CAD', renewDay: 5, frequency: 'monthly', active: true },
  { name: 'YouTube Premium', provider: 'Google', amount: null, currency: 'CAD', renewDay: null, frequency: 'monthly', active: false, note: 'Cancelled' },
  { name: 'iCloud+', provider: 'Apple', amount: 1.29, currency: 'CAD', renewDay: 15, frequency: 'monthly', active: true },
  { name: 'Super Duolingo', provider: 'Duolingo', amount: null, currency: 'CAD', renewDay: null, frequency: 'annual', active: false, note: 'Expiring June 1' },
  { name: 'X Premium', provider: 'X', amount: null, currency: 'CAD', renewDay: null, frequency: 'monthly', active: false, note: 'Expired Jan 9' },
  { name: 'Apple One Family', provider: 'Apple', amount: null, currency: 'CAD', renewDay: null, frequency: 'monthly', active: false, note: 'Expired March 12' },
  { name: 'ChatGPT Plus', provider: 'OpenAI', amount: null, currency: 'CAD', renewDay: null, frequency: 'monthly', active: false, note: 'Cancelled Feb 17' },
  { name: 'TradingView Essential', provider: 'TradingView', amount: null, currency: 'CAD', renewDay: null, frequency: 'monthly', active: false, note: 'Expired Jan 11' },
];

export const USER_INCOME_PHASES = [
  { label: 'Base welfare', monthly: 1000, status: 'current', date: 'March 2026' },
  { label: 'Welfare bump', monthly: 1500, status: 'soon', date: '~Mid 2026' },
  { label: 'PWD + DTC', monthly: 1700, status: 'pending', date: '~Mid-Late 2026' },
];
