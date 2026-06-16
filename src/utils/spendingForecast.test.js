import { describe, expect, it } from 'vitest';
import { buildSpendingForecast } from './spendingForecast';

describe('buildSpendingForecast', () => {
  const months = [
    { month: 'Oct 2025', sortKey: '2025-10', total: 1426.98 },
    { month: 'Nov 2025', sortKey: '2025-11', total: 1598.48 },
    { month: 'Dec 2025', sortKey: '2025-12', total: 924.05 },
    { month: 'Jan 2026', sortKey: '2026-01', total: 594.42 },
    { month: 'Feb 2026', sortKey: '2026-02', total: 2876.37 },
  ];

  it('returns deterministic projections for the same history', () => {
    const first = buildSpendingForecast(months);
    const second = buildSpendingForecast(months);
    expect(first).toEqual(second);
  });

  it('uses the real month count as the forecast horizon', () => {
    const forecast = buildSpendingForecast(months);
    expect(forecast.horizon).toBe(months.length);
    expect(forecast.points).toHaveLength(months.length);
  });

  it('never projects negative totals and keeps percentile ordering valid', () => {
    const forecast = buildSpendingForecast(months);
    for (const point of forecast.points) {
      expect(point.low).toBeGreaterThanOrEqual(0);
      expect(point.low).toBeLessThanOrEqual(point.median);
      expect(point.median).toBeLessThanOrEqual(point.high);
    }
  });

  it('returns no forecast when there are fewer than three usable months', () => {
    expect(buildSpendingForecast(months.slice(0, 2))).toBeNull();
  });
});
