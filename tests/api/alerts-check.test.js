import { describe, expect, it, vi, beforeEach } from 'vitest';

const spark = vi.fn();
const mail = vi.fn();
vi.mock('../../server/api/spark.js', () => ({ sparkRequest: (...a) => spark(...a), sparkConfigured: () => true }));
vi.mock('../../server/api/_email.js', () => ({ sendEmail: (...a) => mail(...a) }));
vi.mock('../../server/api/stocks-free.js', () => ({
  fetchYahooBatch: async () => [{ symbol: 'AAPL', price: 300 }, { symbol: 'TSLA', price: 200 }],
}));

const { default: handler, pickFired, alertEmail } = await import('../../server/api/alerts-check.js');

const a = (id, symbol, direction, target_price, user_email = 'me@x.com') => ({ id, symbol, direction, target_price, user_email });
const res = () => { const r = { code: 0, body: null }; r.status = (c) => { r.code = c; return r; }; r.json = (b) => { r.body = b; return r; }; return r; };

describe('pickFired', () => {
  it('fires above and below at or past the target, skips unknown symbols', () => {
    const out = pickFired([a('1', 'AAPL', 'above', 300), a('2', 'AAPL', 'below', 250), a('3', 'TSLA', 'below', 200), a('4', 'NOPE', 'above', 1)],
      [{ symbol: 'AAPL', price: 300 }, { symbol: 'TSLA', price: 200 }]);
    expect(out.map((x) => x.id)).toEqual(['1', '3']);
    expect(out[0].price).toBe(300);
  });
});

describe('alertEmail', () => {
  it('names one alert in the subject, counts several', () => {
    expect(alertEmail([{ ...a('1', 'AAPL', 'above', 300), price: 301 }]).subject).toBe('AAPL is above $300');
    expect(alertEmail([{ ...a('1', 'AAPL', 'above', 300), price: 301 }, { ...a('2', 'TSLA', 'below', 200), price: 199 }]).subject).toBe('2 price alerts hit');
  });
});

describe('handler', () => {
  beforeEach(() => { spark.mockReset(); mail.mockReset(); process.env.CRON_SECRET = 's'; });
  const req = { headers: { authorization: 'Bearer s' } };

  it('rejects a missing secret', async () => {
    const r = res(); await handler({ headers: {} }, r);
    expect(r.code).toBe(401);
  });

  it('claims before mailing, and mails only rows it claimed, one email per person', async () => {
    const order = [];
    spark.mockImplementation(async (path, opts) => {
      if (!opts) return [a('1', 'AAPL', 'above', 290), a('2', 'TSLA', 'below', 250), a('3', 'AAPL', 'above', 280, 'you@x.com')];
      order.push('patch');
      expect(path).toBe('alerts?id=in.(1,2,3)&triggered=eq.false');
      return [{ id: '1' }, { id: '2' }]; // 3 was claimed by another run
    });
    mail.mockImplementation(async () => { order.push('mail'); });
    const r = res(); await handler(req, r);
    expect(order).toEqual(['patch', 'mail']);
    expect(mail).toHaveBeenCalledTimes(1);
    expect(mail.mock.calls[0][0].to).toBe('me@x.com');
    expect(r.body).toEqual({ checked: 3, fired: 2, emails: 1 });
  });

  it('sends nothing when no alert crossed', async () => {
    spark.mockResolvedValueOnce([a('1', 'AAPL', 'above', 999)]);
    const r = res(); await handler(req, r);
    expect(spark).toHaveBeenCalledTimes(1);
    expect(mail).not.toHaveBeenCalled();
  });
});
