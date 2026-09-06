import { describe, it, expect } from 'vitest';
import { sumDebt, sumReceivable, owedDebts } from './debtPayoff';

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
