import { describe, expect, it } from 'vitest';
import { projectCash, topSpending, billHistory, restOfMonth, billsByMonth, compactSigned } from './moneyGlance';

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

describe('topSpending', () => {
  it('keeps the top four and folds the rest into other', () => {
    const rows = topSpending({ food: 300, rent: 500, fun: 100, gas: 50, gym: 30, tea: 20, zero: 0 });
    expect(rows.map((r) => r.name)).toEqual(['rent', 'food', 'fun', 'gas', 'other']);
    expect(rows[0].share).toBe(0.5);
    expect(rows[4].amount).toBe(50);
    expect(topSpending({})).toEqual([]);
  });
});

describe('billHistory', () => {
  it('ends at the newest paid month and marks each bill per month', () => {
    const g = billHistory([
      { name: 'Rent', amount: 1500, months: ['2026-05', '2026-06', '2026-07', '2026-08'] },
      { name: 'Gym', amount: 40, months: ['2026-01', '2026-06', '2026-08'] },
      { name: 'Odd', amount: 9 },
    ], 4);
    expect(g.months).toEqual(['2026-05', '2026-06', '2026-07', '2026-08']);
    expect(g.rows).toEqual([
      { name: 'Rent', amount: 1500, paid: [true, true, true, true] },
      { name: 'Gym', amount: 40, paid: [false, true, false, true] },
    ]);
    expect(billHistory([]).rows).toEqual([]);
  });
});

describe('restOfMonth', () => {
  it('adds paydays and takes off bills from tomorrow to month end, skipping today', () => {
    const today = new Date(2026, 9, 20, 12);
    const r = restOfMonth(
      [{ amount: 100, cadence: 'monthly', nextDate: '2026-10-25' }, { amount: 50, cadence: 'monthly', nextDate: '2026-10-20' }, { amount: 9, cadence: 'monthly', nextDate: '2026-11-02' }],
      [{ amount: 1000, cadence: 'biweekly', nextDate: '2026-10-16' }],
      today);
    expect(r).toMatchObject({ in: 1000, out: 100, left: 900 });
  });
});

describe('billsByMonth', () => {
  it('rolls lagging dates forward and groups the next 60 days by month', () => {
    const g = billsByMonth([
      { merchant: 'rent', amount: 1500, cadence: 'monthly', nextDate: '2026-08-01' },
      { merchant: 'gym', amount: 40, cadence: 'monthly', nextDate: '2026-10-25' },
    ], new Date(2026, 9, 20, 12));
    expect(g.map((m) => [m.month, m.total, m.items.map((b) => b.merchant)])).toEqual([
      ['2026-10', 40, ['gym']], ['2026-11', 1540, ['rent', 'gym']], ['2026-12', 1500, ['rent']],
    ]);
  });
});

describe('compactSigned', () => {
  it('signs and shortens', () => {
    expect([compactSigned(953.75), compactSigned(-1234), compactSigned(0)]).toEqual(['+$954', '-$1.2K', '+$0']);
  });
});
