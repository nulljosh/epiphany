import { describe, it, expect } from 'vitest';
import { budgetCategories, budgetActual, perDayLeft, coverPlan, moveBudget, budgetLeft, monthPace } from './budgetActual';

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

describe('coverPlan', () => {
  const month = { month: 'Oct', categories: { food: 500, shopping: 50, cannabis: 120 } };
  const expenses = [{ name: 'Food', amount: 400 }, { name: 'Shopping', amount: 200 }, { name: 'Weed', amount: 150 }, { name: 'Phone', amount: 80 }];
  it('covers the overspend from the line with the most left, skipping unlinked lines', () => {
    expect(coverPlan(expenses, month, 0)).toEqual({ from: 1, amount: 100 });
    expect(coverPlan(expenses, month, 1)).toBeNull();
    expect(coverPlan(expenses, month, 3)).toBeNull();
  });
  it('gives only what the donor has left', () => {
    const tight = [{ name: 'Food', amount: 400 }, { name: 'Shopping', amount: 80 }];
    expect(coverPlan(tight, month, 0)).toEqual({ from: 1, amount: 30 });
  });
  it('moves money without changing the total', () => {
    const moved = moveBudget(expenses, 1, 0, 100);
    expect(moved.map((e) => e.amount)).toEqual([500, 100, 150, 80]);
    expect(moved.reduce((s, e) => s + e.amount, 0)).toBe(830);
  });
});

describe('budgetLeft', () => {
  it('sets the whole budget against the month spend', () => {
    expect(budgetLeft([{ amount: 2000 }, { amount: 1500 }], { month: 'Aug 2026', total: 1433 }))
      .toEqual({ budget: 3500, spent: 1433, left: 2067, ratio: 1433 / 3500, month: 'Aug 2026' });
    expect(budgetLeft([], { total: 1 })).toBeNull();
  });
});

describe('monthPace', () => {
  it('is the share of this month gone, and nothing for an older statement', () => {
    const now = new Date(2026, 9, 15);
    expect(monthPace({ sortKey: '2026-10' }, now)).toBeCloseTo(15 / 31);
    expect(monthPace({ sortKey: '2026-08' }, now)).toBeNull();
  });
});
