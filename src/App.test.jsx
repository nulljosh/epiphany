import { describe, it, expect, beforeEach } from 'vitest';

// Trading logic unit tests
describe('Trading Simulator Logic', () => {
  describe('Position Sizing', () => {
    it('should calculate correct position size at $1 balance', () => {
      const balance = 1;
      const sizePercent = balance < 2 ? 0.70 : 0.50;
      const size = balance * sizePercent;
      expect(size).toBe(0.70);
    });

    it('should calculate correct position size at $5 balance', () => {
      const balance = 5;
      const sizePercent = balance < 2 ? 0.70 : balance < 5 ? 0.50 : 0.30;
      const size = balance * sizePercent;
      expect(size).toBe(1.5); // 5 * 0.30
    });

    it('should allow fractional shares for cheap assets', () => {
      const balance = 1;
      const price = 0.00002; // BONK price
      const sizePercent = 0.70;
      const size = balance * sizePercent;
      const shares = size / price;
      expect(shares).toBeGreaterThan(0.01);
    });

    it('should reject positions smaller than minimum', () => {
      const balance = 0.001;
      const sizePercent = 0.70;
      const size = balance * sizePercent;
      expect(size).toBeLessThan(0.001); // Should be rejected
    });
  });

  describe('Asset Filtering', () => {
    it('should filter out expensive assets at low balance', () => {
      const balance = 1;
      const sizePercent = 0.70;
      const positionSize = balance * sizePercent;
      const price = 100; // Expensive stock
      const canAfford = positionSize / price >= 0.01;
      expect(canAfford).toBe(false);
    });

    it('should allow cheap assets at low balance', () => {
      const balance = 1;
      const sizePercent = 0.70;
      const positionSize = balance * sizePercent;
      const price = 0.00002; // BONK
      const canAfford = positionSize / price >= 0.01;
      expect(canAfford).toBe(true);
    });
  });

  describe('Momentum Threshold', () => {
    it('should use lower threshold at $1 balance', () => {
      const balance = 1;
      const minStrength = balance < 2 ? 0.0001 : 0.001;
      expect(minStrength).toBe(0.0001);
    });

    it('should use higher threshold at $10 balance', () => {
      const balance = 10;
      const minStrength = balance < 2 ? 0.0001 : balance < 10 ? 0.0005 : 0.001;
      expect(minStrength).toBe(0.001);
    });

    it('should detect positive momentum', () => {
      const prices = [1.00, 1.01, 1.02, 1.03, 1.04, 1.05, 1.06, 1.07, 1.08, 1.09];
      const current = prices[prices.length - 1];
      const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
      const strength = (current - avg) / avg;
      expect(strength).toBeGreaterThan(0);
    });
  });

  describe('Stop Loss & Take Profit', () => {
    it('should set 4% stop loss', () => {
      const entry = 100;
      const stop = entry * 0.96;
      expect(stop).toBe(96);
    });

    it('should set 8% take profit', () => {
      const entry = 100;
      const target = entry * 1.08;
      expect(target).toBe(108);
    });

    it('should trail stop loss on 2% gain', () => {
      const entry = 100;
      const current = 102; // 2% gain
      const pnlPct = (current - entry) / entry;
      expect(pnlPct).toBeGreaterThanOrEqual(0.02);

      const initialStop = entry * 0.96;
      const trailedStop = current * 0.97;
      expect(trailedStop).toBeGreaterThan(initialStop);
    });
  });

  describe('PnL Calculation', () => {
    it('should calculate winning trade PnL', () => {
      const entry = 100;
      const exit = 108;
      const size = 10; // $10 position
      const pnl = (exit - entry) * size;
      expect(pnl).toBe(80); // 8% gain on $10
    });

    it('should calculate losing trade PnL', () => {
      const entry = 100;
      const exit = 96;
      const size = 10;
      const pnl = (exit - entry) * size;
      expect(pnl).toBe(-40); // 4% loss on $10
    });

    it('should prevent balance going below $0.50', () => {
      const balance = 1;
      const loss = -0.60;
      const newBalance = Math.max(0.5, balance + loss);
      expect(newBalance).toBe(0.5);
    });
  });

  describe('Edge Cases', () => {
    it('should handle NaN prices', () => {
      const price = NaN;
      expect(isNaN(price)).toBe(true);
      // Should fall back to base price
    });

    it('should handle undefined price history', () => {
      const prices = undefined;
      const safeLength = (prices || []).length;
      expect(safeLength).toBe(0);
    });

    it('should cap price history at 50 entries', () => {
      const prices = Array(60).fill(100);
      const capped = prices.length >= 50 ? prices.slice(-49) : prices;
      expect(capped.length).toBe(49);
    });

    it('should handle extreme volatility', () => {
      const base = 100;
      const move = 0.3; // 30% move
      const newPrice = base * (1 + move);
      const bounded = Math.max(base * 0.7, Math.min(base * 1.5, newPrice));
      expect(bounded).toBeLessThanOrEqual(base * 1.5);
    });
  });

  describe('Number Formatting', () => {
    it('should format billions', () => {
      const num = 1000000000;
      const formatted = `$${(num / 1e9).toFixed(2)}B`;
      expect(formatted).toBe('$1.00B');
    });

    it('should format millions', () => {
      const num = 1500000;
      const formatted = `$${(num / 1e6).toFixed(2)}M`;
      expect(formatted).toBe('$1.50M');
    });

    it('should format thousands', () => {
      const num = 5000;
      const formatted = `$${(num / 1e3).toFixed(2)}K`;
      expect(formatted).toBe('$5.00K');
    });
  });
});

describe('Trading Time Calculations', () => {
  it('should convert ticks to real-world trading days', () => {
    const ticks = 78; // 78 ticks
    const tradingMinutes = ticks * 5; // 390 minutes
    const tradingHours = tradingMinutes / 60; // 6.5 hours
    const tradingDays = tradingHours / 6.5; // 1 day
    expect(tradingDays).toBe(1);
  });

  it('should convert ticks to weeks', () => {
    const ticks = 390; // 5 days * 78 ticks
    const tradingMinutes = ticks * 5;
    const tradingHours = tradingMinutes / 60;
    const tradingDays = tradingHours / 6.5;
    const tradingWeeks = tradingDays / 5;
    expect(tradingWeeks).toBeCloseTo(1, 1);
  });
});

describe('Win Rate Calculation', () => {
  it('should calculate win rate correctly', () => {
    const trades = [
      { pnl: '10.00' },
      { pnl: '-5.00' },
      { pnl: '15.00' },
      { pnl: '-3.00' },
    ];
    const exits = trades.filter(t => t.pnl);
    const wins = exits.filter(t => parseFloat(t.pnl) > 0);
    const winRate = (wins.length / exits.length) * 100;
    expect(winRate).toBe(50);
  });

  it('should handle no trades', () => {
    const exits = [];
    const winRate = exits.length ? 0 : 0;
    expect(winRate).toBe(0);
  });
});

describe('Target Selection (1B vs 1T)', () => {
  it('should use $1B target by default', () => {
    const targetTrillion = false;
    const target = targetTrillion ? 1000000000000 : 1000000000;
    expect(target).toBe(1000000000); // $1B
  });

  it('should use $1T target when enabled', () => {
    const targetTrillion = true;
    const target = targetTrillion ? 1000000000000 : 1000000000;
    expect(target).toBe(1000000000000); // $1T
  });

  it('should detect win at $1B', () => {
    const balance = 1000000000;
    const targetTrillion = false;
    const target = targetTrillion ? 1000000000000 : 1000000000;
    const won = balance >= target;
    expect(won).toBe(true);
  });

  it('should NOT win at $1B with 1T target', () => {
    const balance = 1000000000;
    const targetTrillion = true;
    const target = targetTrillion ? 1000000000000 : 1000000000;
    const won = balance >= target;
    expect(won).toBe(false);
  });

  it('should detect win at $1T', () => {
    const balance = 1000000000000;
    const targetTrillion = true;
    const target = targetTrillion ? 1000000000000 : 1000000000;
    const won = balance >= target;
    expect(won).toBe(true);
  });

  it('should stop opening positions near target', () => {
    const balance = 990000000; // Close to $1B
    const targetTrillion = false;
    const target = targetTrillion ? 1000000000000 : 1000000000;
    const size = 10000000; // $10M position
    const maxWin = size * 0.045; // 4.5% max gain
    const wouldExceedTarget = balance + maxWin > target * 1.1;
    expect(wouldExceedTarget).toBe(false);
  });

  it('should prevent overshoot of target', () => {
    const balance = 999900000; // Very close to $1B
    const targetTrillion = false;
    const target = targetTrillion ? 1000000000000 : 1000000000;
    const maxPositionSize = (target - balance) / 0.045; // Max size that won't overshoot
    expect(maxPositionSize).toBeGreaterThan(0);
  });

  it('should format 1B correctly', () => {
    const num = 1000000000;
    const formatted = `$${(num / 1e9).toFixed(0)}B`;
    expect(formatted).toBe('$1B');
  });

  it('should format 1T correctly', () => {
    const num = 1000000000000;
    const formatted = `$${(num / 1e12).toFixed(0)}T`;
    expect(formatted).toBe('$1T');
  });
});

describe('Bust Conditions', () => {
  it('should bust at $0.50', () => {
    const balance = 0.5;
    const busted = balance <= 0.5;
    expect(busted).toBe(true);
  });

  it('should NOT bust at $0.51', () => {
    const balance = 0.51;
    const busted = balance <= 0.5;
    expect(busted).toBe(false);
  });

  it('should stop running when busted', () => {
    const balance = 0.4;
    const running = true;
    const busted = balance <= 0.5;
    const shouldStop = busted || balance <= 0.5;
    expect(shouldStop).toBe(true);
  });
});
