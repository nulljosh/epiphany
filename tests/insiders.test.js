import { describe, it, expect } from 'vitest';
import { parseInsiders } from '../server/api/earnings-history.js';

const NOW = Date.UTC(2026, 9, 30);
const day = (d) => ({ raw: Date.UTC(2026, 9, d) / 1000, fmt: `2026-10-${d}` });
const tx = (text, name, value, d) => ({ transactionText: text, filerName: name, filerRelation: 'Officer', value: { raw: value }, shares: { raw: 10 }, startDate: day(d) });

describe('parseInsiders', () => {
  it('counts open-market buys and sells in 90 days and skips awards', () => {
    const out = parseInsiders({ quoteSummary: { result: [{ insiderTransactions: { transactions: [
      tx('Sale at price 339.62 per share.', 'DOE JANE A', 800000, 20),
      tx('Purchase at price 12.00 per share.', 'ROE RICHARD', 50000, 18),
      tx('Stock Award(Grant) at price 0.00 per share.', 'DOE JANE A', 0, 15),
    ] } }] } }, NOW);
    expect(out).toMatchObject({ buys: 1, sells: 1, bought: 50000, sold: 800000 });
    expect(out.recent[0]).toMatchObject({ name: 'Jane A Doe', side: 'sell', date: '2026-10-20' });
    expect(parseInsiders({}, NOW)).toBeNull();
  });
});
