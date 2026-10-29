import { describe, expect, it } from 'vitest';
import { inWindow } from '../src/utils/mapWindow';

describe('inWindow', () => {
  const now = Date.parse('2026-10-29T12:00:00Z');
  it('keeps everything at any time', () => expect(inWindow('2020-01-01T00:00:00Z', 0, now)).toBe(true));
  it('keeps recent ISO and epoch stamps', () => {
    expect(inWindow('2026-10-29T11:30:00Z', 1, now)).toBe(true);
    expect(inWindow(now - 5 * 3600000, 6, now)).toBe(true);
  });
  it('drops older ones', () => expect(inWindow('2026-10-29T05:00:00Z', 6, now)).toBe(false));
  it('keeps items with no or unreadable time', () => {
    expect(inWindow(undefined, 1, now)).toBe(true);
    expect(inWindow('yesterday-ish', 1, now)).toBe(true);
  });
});
