const categoryIcons = {
  grocery: 'GROC',
  dining: 'DINE',
  transport: 'TRNS',
  entertainment: 'ENTR',
  utilities: 'UTIL',
  income: 'INC',
  transfer: 'XFER'
};

const categories = [
  { key: 'grocery', merchants: ['Whole Foods', 'Trader Joe\'s', 'Safeway'], min: 25, max: 140, type: 'debit' },
  { key: 'dining', merchants: ['Blue Bottle', 'Chipotle', 'Sushi House'], min: 12, max: 80, type: 'debit' },
  { key: 'transport', merchants: ['Metro Transit', 'Uber', 'Lyft'], min: 4, max: 45, type: 'debit' },
  { key: 'entertainment', merchants: ['Netflix', 'Spotify', 'AMC Theatres'], min: 9, max: 60, type: 'debit' },
  { key: 'utilities', merchants: ['Hydro One', 'Water Works', 'Internet Co'], min: 35, max: 180, type: 'debit' },
  { key: 'income', merchants: ['Payroll Deposit'], min: 1800, max: 3200, type: 'credit' },
  { key: 'transfer', merchants: ['Internal Transfer'], min: 150, max: 1200, type: 'debit' }
];

const randomBetween = (min, max) => Math.random() * (max - min) + min;

const buildTransaction = (index) => {
  const category = categories[index % categories.length];
  const merchant = category.merchants[index % category.merchants.length];
  const amount = Number(randomBetween(category.min, category.max).toFixed(2));
  const daysAgo = index % 30;
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() - daysAgo);

  return {
    id: `txn-${index + 1}`,
    merchant,
    description: category.type === 'credit' ? 'Direct deposit' : `${category.key} expense`,
    amount,
    type: category.type,
    category: category.key,
    date: date.toISOString()
  };
};

export const accounts = [
  {
    id: 'acc-chequing',
    type: 'Chequing',
    number: '****4521',
    balance: 3847.52,
    primary: true
  },
  {
    id: 'acc-savings',
    type: 'Savings',
    number: '****8903',
    balance: 12340.0,
    primary: false
  }
];

export const transactions = Array.from({ length: 50 }, (_, index) => buildTransaction(index)).sort(
  (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
);

export { categoryIcons };
