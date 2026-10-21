import { describe, it, expect } from 'vitest';
import { budgetCategories, budgetActual } from './budgetActual';

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
