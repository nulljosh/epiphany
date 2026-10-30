import { describe, expect, it } from 'vitest';
import { parseEarningsHistory } from '../../server/api/earnings-history.js';

describe('parseEarningsHistory', () => {
  it('keeps quarters with both numbers, labels them, and turns surprise into percent', () => {
    const q = (iso, a, e, s) => ({ quarter: { raw: Date.parse(iso) / 1000 }, epsActual: { raw: a }, epsEstimate: { raw: e }, surprisePercent: { raw: s } });
    const json = { quoteSummary: { result: [{ earningsHistory: { history: [
      q('2025-09-30', 1.5, 1.4, 0.0714), q('2025-12-31', 2.1, 2.2, -0.045), { quarter: { raw: 1 } }, q('2026-03-31', 1.6, 1.6, 0), q('2026-06-30', 1.7, 1.5, 0.133),
    ] } }] } };
    const out = parseEarningsHistory(json);
    expect(out.map((r) => r.quarter)).toEqual(['Q3 2025', 'Q4 2025', 'Q1 2026', 'Q2 2026']);
    expect(out[0]).toMatchObject({ actual: 1.5, estimate: 1.4 });
    expect(out[0].surprise).toBeCloseTo(7.14);
    expect(parseEarningsHistory({})).toEqual([]);
  });
});
