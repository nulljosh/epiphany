import { describe, expect, it } from 'vitest';
import { cronPaths } from '../worker/schedule.js';

describe('cronPaths', () => {
  it('keeps the old fixed-time jobs on their minutes (UTC)', () => {
    expect(cronPaths(Date.UTC(2026, 9, 29, 8, 0))).toEqual(['cron', 'alerts-check']);           // Thursday
    expect(cronPaths(Date.UTC(2026, 9, 29, 14, 30))).toEqual(['broker/morning-run', 'alerts-check']);
    expect(cronPaths(Date.UTC(2026, 9, 29, 12, 0))).toEqual(['broker/crypto-paper', 'alerts-check']);
  });
  it('sends the earnings digest Sunday at 15:00 UTC only', () => {
    expect(cronPaths(Date.UTC(2026, 10, 1, 15, 0))).toEqual(['earnings-digest', 'alerts-check']);   // Sunday
    expect(cronPaths(Date.UTC(2026, 10, 2, 15, 0))).toEqual(['alerts-check']);                      // Monday
  });

  it('skips the weekday jobs on weekends but not crypto', () => {
    expect(cronPaths(Date.UTC(2026, 9, 31, 8, 0))).toEqual(['alerts-check']);                  // Saturday
    expect(cronPaths(Date.UTC(2026, 9, 31, 12, 0))).toEqual(['broker/crypto-paper', 'alerts-check']);
  });
  it('snapshots portfolio values daily at 21:30 UTC, weekends too', () => {
    expect(cronPaths(Date.UTC(2026, 9, 29, 21, 30))).toEqual(['portfolio-snapshot', 'alerts-check']);
    expect(cronPaths(Date.UTC(2026, 9, 31, 21, 30))).toEqual(['portfolio-snapshot', 'alerts-check']);
  });
  it('runs only the alert check on other ticks', () => {
    expect(cronPaths(Date.UTC(2026, 9, 29, 8, 15))).toEqual(['alerts-check']);
  });
});
