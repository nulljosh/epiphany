import { describe, expect, it, vi, beforeEach } from 'vitest';

const spark = vi.fn();
const mail = vi.fn();
const now = Date.UTC(2026, 10, 1, 15);
vi.mock('../../server/api/spark.js', () => ({ sparkRequest: (...a) => spark(...a), sparkConfigured: () => true }));
vi.mock('../../server/api/_email.js', () => ({ sendEmail: (...a) => mail(...a) }));
vi.mock('../../server/api/stocks-free.js', () => ({
  fetchYahooBatch: async () => [
    { symbol: 'AAPL', nextEarnings: Date.UTC(2026, 10, 4, 21) / 1000 },
    { symbol: 'MSFT', nextEarnings: Date.UTC(2026, 11, 1) / 1000 },
    { symbol: 'TSLA' },
  ],
}));

const { default: handler, reportingThisWeek, digestEmail } = await import('../../server/api/earnings-digest.js');
const res = () => { const r = {}; r.status = (c) => { r.code = c; return r; }; r.json = (b) => { r.body = b; return r; }; return r; };

describe('earnings digest', () => {
  beforeEach(() => { spark.mockReset(); mail.mockReset(); process.env.CRON_SECRET = 's'; vi.setSystemTime(now); });

  it('keeps only what reports in the next seven days', () => {
    const q = [{ symbol: 'A', nextEarnings: now / 1000 + 86400 }, { symbol: 'B', nextEarnings: now / 1000 + 9 * 86400 }, { symbol: 'C' }];
    expect(reportingThisWeek(q, now).map((x) => x.symbol)).toEqual(['A']);
  });

  it('names the day in the subject for one stock', () => {
    expect(digestEmail([{ symbol: 'AAPL', nextEarnings: Date.UTC(2026, 10, 4, 21) / 1000 }]).subject).toBe('AAPL reports Wednesday, Nov 4');
  });

  it('mails each subscriber once, skips one with nothing reporting', async () => {
    spark.mockImplementation(async (path) => {
      if (path.startsWith('alerts')) return [{ user_email: 'a@x.com' }, { user_email: 'a@x.com' }, { user_email: 'b@x.com' }];
      return path.includes('a%40x.com') ? [{ symbol: 'AAPL' }, { symbol: 'MSFT' }] : [];
    });
    const r = res();
    await handler({ headers: { authorization: 'Bearer s' } }, r);
    expect(r.body).toEqual({ subscribers: 2, emails: 1 });
    expect(mail.mock.calls[0][0].to).toBe('a@x.com');
  });
});
