import { describe, expect, it } from 'vitest';
import { projectCash } from './moneyGlance';

describe('projectCash', () => {
  const today = new Date(2026, 9, 29);
  it('takes bills off and adds paydays on their days, rolling stale dates forward', () => {
    const { points, low, events } = projectCash(1000,
      [{ nextDate: '2026-09-05', amount: 900, cadence: 'monthly' }],
      [{ nextDate: '2026-10-30', amount: 500, cadence: 'biweekly' }], today);
    expect(points).toHaveLength(31);
    expect(points[1].balance).toBe(1500);          // payday Oct 30
    expect(points[7].balance).toBe(600);           // rent rolled from Sep 5 to Nov 5
    expect(points[15].balance).toBe(1100);         // payday Nov 13
    expect(points[30].balance).toBe(1600);         // payday Nov 27
    expect(low).toEqual({ day: 7, balance: 600 });
    expect(events).toBe(4);
  });
  it('is flat with nothing scheduled', () => {
    const { points, events } = projectCash(50, [], [], today);
    expect(points.every((p) => p.balance === 50)).toBe(true);
    expect(events).toBe(0);
  });
});
