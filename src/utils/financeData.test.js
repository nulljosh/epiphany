import { describe, expect, it } from 'vitest';
import { normalizeSpendingMonth, normalizeSpendingMonths } from './financeData';

describe('financeData spending normalization', () => {
  it('drops negative categories and repairs negative month totals', () => {
    const month = normalizeSpendingMonth({
      month: 'Jan 2026',
      sortKey: '2026-01',
      total: -1525.58,
      categories: {
        food: 206.83,
        fitness: 83.97,
        apps: 42.56,
        transfers: 28.57,
        transit: 25,
        alcohol: 20.02,
        shopping: 9.82,
        uncategorized: -1942.35,
      },
    });

    expect(month).toMatchObject({
      month: 'Jan 2026',
      sortKey: '2026-01',
      total: 416.77,
      categories: {
        food: 206.83,
        fitness: 83.97,
        apps: 42.56,
        transfers: 28.57,
        transit: 25,
        alcohol: 20.02,
        shopping: 9.82,
      },
    });
    expect(month.categories.uncategorized).toBeUndefined();
  });

  it('returns months in chronological order with non-negative totals', () => {
    const months = normalizeSpendingMonths([
      { month: 'Feb 2026', sortKey: '2026-02', total: 2876.37, categories: { shopping: 1148.68 } },
      { month: 'Jan 2026', sortKey: '2026-01', total: -20, categories: { food: 10 } },
    ]);

    expect(months.map((month) => month.month)).toEqual(['Jan 2026', 'Feb 2026']);
    expect(months[0].total).toBe(10);
    expect(months[1].total).toBe(2876.37);
  });
});
