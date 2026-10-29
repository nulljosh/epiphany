import { describe, expect, it } from 'vitest';
import { cronPaths } from '../worker/schedule.js';

describe('cronPaths', () => {
  it('keeps the old fixed-time jobs on their minutes (UTC)', () => {
    expect(cronPaths(Date.UTC(2026, 9, 29, 8, 0))).toEqual(['cron', 'alerts-check']);           // Thursday
    expect(cronPaths(Date.UTC(2026, 9, 29, 14, 30))).toEqual(['broker/morning-run', 'alerts-check']);
    expect(cronPaths(Date.UTC(2026, 9, 29, 12, 0))).toEqual(['broker/crypto-paper', 'alerts-check']);
  });
  it('skips the weekday jobs on weekends but not crypto', () => {
    expect(cronPaths(Date.UTC(2026, 9, 31, 8, 0))).toEqual(['alerts-check']);                  // Saturday
    expect(cronPaths(Date.UTC(2026, 9, 31, 12, 0))).toEqual(['broker/crypto-paper', 'alerts-check']);
  });
  it('runs only the alert check on other ticks', () => {
    expect(cronPaths(Date.UTC(2026, 9, 29, 8, 15))).toEqual(['alerts-check']);
  });
});
