import { describe, it, expect } from 'vitest';
import { sumDebt, sumReceivable, owedDebts, debtFreeBy, paidDown } from './debtPayoff';

const rows = [
  { name: 'Visa', balance: 5000 },
  { name: 'Family', balance: 100, owedToMe: true },
];

describe('debt direction', () => {
  it('keeps receivables out of the debt total', () => expect(sumDebt(rows)).toBe(5000));
  it('sums receivables separately', () => expect(sumReceivable(rows)).toBe(100));
  it('filters payoff inputs to real debts', () => expect(owedDebts(rows).map(d => d.name)).toEqual(['Visa']));
  it('tolerates a missing list', () => expect(sumDebt(undefined)).toBe(0));
});

describe('debtFreeBy', () => {
  it('names the month after the payoff', () => {
    expect(debtFreeBy(15, new Date(2026, 9, 30))).toBe('January 2028');
    expect(debtFreeBy(Infinity)).toBeNull();
  });
});

describe('paidDown', () => {
  const now = new Date(2026, 10, 15); // November 2026
  it('takes one payment a month since the anchor and re-anchors to this month', () => {
    expect(paidDown({ name: 'Phone', balance: 1000, rate: 0, minPayment: 50, since: '2026-08' }, now)).toEqual({ name: 'Phone', balance: 850, rate: 0, minPayment: 50, since: '2026-11' });
  });
  it('charges interest before the payment and stops at zero', () => {
    expect(paidDown({ balance: 1000, rate: 12, minPayment: 100, since: '2026-10' }, now).balance).toBe(910);
    expect(paidDown({ balance: 80, minPayment: 50, since: '2026-01' }, now).balance).toBe(0);
  });
  it('leaves debts without a payment, an anchor or owed to you alone', () => {
    const d = { balance: 500, minPayment: 0, since: '2026-01' };
    expect(paidDown(d, now)).toBe(d);
    expect(paidDown({ balance: 500, minPayment: 50 }, now).balance).toBe(500);
    expect(paidDown({ balance: 500, minPayment: 50, since: '2026-01', owedToMe: true }, now).balance).toBe(500);
  });
});
