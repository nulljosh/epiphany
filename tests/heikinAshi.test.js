import { describe, it, expect } from 'vitest';

// Inline the function since it's defined inside StockDetail.jsx
function computeHeikinAshi(data) {
  const ha = [];
  for (let i = 0; i < data.length; i++) {
    const d = data[i];
    const haClose = (d.open + d.high + d.low + d.close) / 4;
    const haOpen = i === 0
      ? (d.open + d.close) / 2
      : (ha[i - 1].open + ha[i - 1].close) / 2;
    ha.push({
      time: d.time,
      open: haOpen,
      high: Math.max(d.high, haOpen, haClose),
      low: Math.min(d.low, haOpen, haClose),
      close: haClose,
    });
  }
  return ha;
}

describe('computeHeikinAshi', () => {
  it('returns empty array for empty input', () => {
    expect(computeHeikinAshi([])).toEqual([]);
  });

  it('computes first candle correctly', () => {
    const data = [{ time: 1000, open: 10, high: 15, low: 8, close: 12 }];
    const ha = computeHeikinAshi(data);
    expect(ha).toHaveLength(1);
    // HA_Close = (10+15+8+12)/4 = 11.25
    expect(ha[0].close).toBeCloseTo(11.25);
    // HA_Open = (10+12)/2 = 11
    expect(ha[0].open).toBeCloseTo(11);
    // HA_High = max(15, 11, 11.25) = 15
    expect(ha[0].high).toBe(15);
    // HA_Low = min(8, 11, 11.25) = 8
    expect(ha[0].low).toBe(8);
    expect(ha[0].time).toBe(1000);
  });

  it('chains HA_Open from previous candle', () => {
    const data = [
      { time: 1, open: 10, high: 15, low: 8, close: 12 },
      { time: 2, open: 13, high: 16, low: 11, close: 14 },
    ];
    const ha = computeHeikinAshi(data);
    expect(ha).toHaveLength(2);
    // Second HA_Open = (prev_HA_Open + prev_HA_Close) / 2 = (11 + 11.25) / 2 = 11.125
    expect(ha[1].open).toBeCloseTo(11.125);
    // Second HA_Close = (13+16+11+14)/4 = 13.5
    expect(ha[1].close).toBeCloseTo(13.5);
    // High = max(16, 11.125, 13.5) = 16
    expect(ha[1].high).toBe(16);
    // Low = min(11, 11.125, 13.5) = 11
    expect(ha[1].low).toBe(11);
  });

  it('preserves time values', () => {
    const data = [
      { time: 100, open: 5, high: 10, low: 3, close: 7 },
      { time: 200, open: 8, high: 12, low: 6, close: 9 },
      { time: 300, open: 10, high: 14, low: 8, close: 11 },
    ];
    const ha = computeHeikinAshi(data);
    expect(ha.map(c => c.time)).toEqual([100, 200, 300]);
  });

  it('HA high is always >= HA open and HA close', () => {
    const data = [
      { time: 1, open: 100, high: 110, low: 90, close: 105 },
      { time: 2, open: 106, high: 112, low: 95, close: 98 },
      { time: 3, open: 97, high: 103, low: 92, close: 100 },
      { time: 4, open: 101, high: 108, low: 96, close: 104 },
    ];
    const ha = computeHeikinAshi(data);
    for (const c of ha) {
      expect(c.high).toBeGreaterThanOrEqual(c.open);
      expect(c.high).toBeGreaterThanOrEqual(c.close);
      expect(c.low).toBeLessThanOrEqual(c.open);
      expect(c.low).toBeLessThanOrEqual(c.close);
    }
  });

  it('handles flat price (all same OHLC)', () => {
    const data = [
      { time: 1, open: 50, high: 50, low: 50, close: 50 },
      { time: 2, open: 50, high: 50, low: 50, close: 50 },
    ];
    const ha = computeHeikinAshi(data);
    expect(ha[0].open).toBe(50);
    expect(ha[0].close).toBe(50);
    expect(ha[1].open).toBe(50);
    expect(ha[1].close).toBe(50);
  });
});
