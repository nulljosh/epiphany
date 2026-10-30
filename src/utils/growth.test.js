import { describe, expect, it } from 'vitest';
import { growthCurve } from './growth';

describe('growthCurve', () => {
  it('matches the future value of a monthly annuity', () => {
    const end = growthCurve(500, 30, 7).at(-1);
    expect(end.contributed).toBe(180000);
    expect(end.value).toBeCloseTo(609985.5, 0);
  });
  it('is plain saving at zero percent', () => {
    expect(growthCurve(100, 2, 0)).toEqual([
      { year: 0, contributed: 0, value: 0 }, { year: 1, contributed: 1200, value: 1200 }, { year: 2, contributed: 2400, value: 2400 },
    ]);
  });
});
