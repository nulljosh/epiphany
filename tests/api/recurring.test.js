import { describe, it, expect } from 'vitest';
import { detectRecurring } from '../../server/api/recurring.js';

const txn = (date, description, amount) => ({ date, description, amount });

describe('detectRecurring', () => {
  const today = new Date('2026-10-20T00:00:00Z');

  it('finds a monthly charge and its price change', () => {
    const out = detectRecurring([
      txn('2026-07-03', 'SPOTIFY #123 STOCKHOLM SE', -11.99),
      txn('2026-08-03', 'SPOTIFY #456 STOCKHOLM SE', -11.99),
      txn('2026-09-03', 'SPOTIFY #789 STOCKHOLM SE', -12.99),
      txn('2026-09-10', 'TIM HORTONS', -4.5),
      txn('2026-09-14', 'PAYROLL', 2000),
    ], today);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ merchant: 'spotify stockholm', cadence: 'monthly', amount: 12.99, priceDelta: 1, nextDate: '2026-10-03', months: ['2026-07', '2026-08', '2026-09'] });
  });

  it('skips one-offs, uneven amounts and charges that stopped', () => {
    expect(detectRecurring([
      txn('2026-07-01', 'AMAZON', -20), txn('2026-08-01', 'AMAZON', -90),
      txn('2026-03-01', 'GYM', -40), txn('2026-04-01', 'GYM', -40),
    ], today)).toEqual([]);
  });

  it('returns the stopped ones when asked', () => {
    const out = detectRecurring([
      txn('2026-07-01', 'AMAZON', -20), txn('2026-08-01', 'AMAZON', -90),
      txn('2026-03-01', 'GYM', -40), txn('2026-04-01', 'GYM', -40),
    ], today, { stopped: true });
    expect(out.map((r) => [r.merchant, r.lastDate])).toEqual([['gym', '2026-04-01']]);
  });

  it('finds paydays when asked for income, and leaves them out of bills', () => {
    const pay = [txn('2026-09-04', 'PAYROLL DEPOSIT ACME', 1500), txn('2026-09-18', 'PAYROLL DEPOSIT ACME', 1500),
      txn('2026-10-02', 'PAYROLL DEPOSIT ACME', 1500), txn('2026-09-20', 'SPOTIFY', -12)];
    expect(detectRecurring(pay, today, { income: true })[0]).toMatchObject({ cadence: 'biweekly', amount: 1500, nextDate: '2026-10-16' });
    expect(detectRecurring(pay, today)).toEqual([]);
  });
});
