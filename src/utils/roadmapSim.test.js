import { describe, it, expect } from 'vitest';
import { simulate } from './roadmapSim';

const baseParams = {
  monthlyExpenses: 650,
  annualReturn: 0.10,
  sweStartSalary: 75000,
  sweStartYear: 2030,
  startDebt: 10000,
  horizonYears: 17,
};

describe('roadmapSim', () => {
  it('produces 17 years of monthly rows', () => {
    const { rows } = simulate(baseParams);
    expect(rows).toHaveLength(17 * 12);
  });

  it('rows start in Jan 2026 and march monotonically', () => {
    const { rows } = simulate(baseParams);
    expect(rows[0].year).toBe(2026);
    expect(rows[0].month).toBe(0);
    expect(rows[12].year).toBe(2027);
    expect(rows[12].month).toBe(0);
  });

  it('clears debt within horizon', () => {
    const { milestones } = simulate(baseParams);
    expect(milestones.debtFree).toBeTruthy();
    expect(milestones.debtFree.debt).toBe(0);
  });

  it('reaches $1M net worth within horizon under base assumptions', () => {
    const { milestones } = simulate(baseParams);
    expect(milestones.hit1m).toBeTruthy();
    expect(milestones.hit1m.netWorth).toBeGreaterThanOrEqual(1_000_000);
  });

  it('zero starting debt yields immediate debt-free milestone', () => {
    const { milestones } = simulate({ ...baseParams, startDebt: 0 });
    expect(milestones.debtFree).toBeTruthy();
    expect(milestones.debtFree.year).toBe(2026);
  });

  it('higher return hits $1M sooner than lower return', () => {
    const fast = simulate({ ...baseParams, annualReturn: 0.13 });
    const slow = simulate({ ...baseParams, annualReturn: 0.05 });
    expect(fast.milestones.hit1m).toBeTruthy();
    if (slow.milestones.hit1m) {
      const fastIdx = fast.rows.indexOf(fast.milestones.hit1m);
      const slowIdx = slow.rows.indexOf(slow.milestones.hit1m);
      expect(fastIdx).toBeLessThan(slowIdx);
    }
  });

  it('debtNeg is the negative of debt', () => {
    const { rows } = simulate(baseParams);
    rows.forEach((r) => expect(r.debtNeg).toBe(-r.debt));
  });
});
