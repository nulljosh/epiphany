import { describe, it, expect } from 'vitest';
import { budgetCategories, budgetActual, perDayLeft } from './budgetActual';

describe('budgetActual', () => {
  const aug = { month: 'Aug 2026', categories: { food: 180, coffee: 60, cannabis: 90, vape: 40 } };

  it('links lines by keyword or explicit category', () => {
    expect(budgetCategories({ name: 'Food' })).toEqual(['food', 'groceries', 'coffee', 'starbucks']);
    expect(budgetCategories({ name: 'Cell (Telus)' })).toEqual([]);
    expect(budgetCategories({ name: 'Gym', category: 'subscriptions' })).toEqual(['subscriptions']);
  });

  it('sums the linked categories and grades them', () => {
    expect(budgetActual({ name: 'Food', amount: 300 }, aug)).toMatchObject({ spent: 240, status: 'ok' });
    expect(budgetActual({ name: 'Weed', amount: 75 }, aug)).toMatchObject({ spent: 90, status: 'over' });
    expect(budgetActual({ name: 'Vape', amount: 40 }, aug).status).toBe('close');
    expect(budgetActual({ name: 'Cell (Bell)', amount: 167 }, aug)).toBeNull();
  });
});

describe('perDayLeft', () => {
  const line = { name: 'Food', amount: 700 };
  const now = new Date(2026, 9, 19); // Oct 19: 13 days left counting today
  it('spreads what is left over the rest of this month', () => {
    expect(perDayLeft(line, { sortKey: '2026-10', categories: { food: 76 } }, now)).toEqual({ perDay: 48, days: 13 });
  });
  it('says nothing for an older statement or a spent budget', () => {
    expect(perDayLeft(line, { sortKey: '2026-09', categories: { food: 76 } }, now)).toBeNull();
    expect(perDayLeft(line, { sortKey: '2026-10', categories: { food: 800 } }, now)).toBeNull();
  });
});
