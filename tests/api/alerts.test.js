import { describe, expect, it, vi } from 'vitest';

vi.mock('../../server/api/spark.js', () => ({ sparkRequest: vi.fn(), sparkConfigured: () => true }));
const { alertTarget } = await import('../../server/api/alerts.js');

describe('alertTarget', () => {
  const q = { fiftyTwoWeekHigh: 400, fiftyTwoWeekLow: 100, nextEarnings: 1 };
  it('pins 52 week alerts to the current high or low', () => {
    expect(alertTarget('high52', q)).toEqual({ target_price: 400, direction: 'above' });
    expect(alertTarget('low52', q)).toEqual({ target_price: 100, direction: 'below' });
  });
  it('refuses a kind the quote has no data for', () => {
    expect(alertTarget('earnings', { fiftyTwoWeekHigh: 1 })).toBeNull();
    expect(alertTarget('high52', null)).toBeNull();
  });
  it('keeps price alerts as given', () => {
    expect(alertTarget('price', null, { target_price: '12', direction: 'below' })).toEqual({ target_price: 12, direction: 'below' });
  });
});
