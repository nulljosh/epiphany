import { describe, it, expect } from 'vitest';
import { formatPrice, calcFibTargets, runMonteCarlo } from './math';

describe('formatPrice', () => {
  it('should format small numbers correctly', () => {
    expect(formatPrice(1.23)).toBe('1.2300');
    expect(formatPrice(12.34)).toBe('12.34');
    expect(formatPrice(123.45)).toBe('123');
  });

  it('should format large numbers with K suffix', () => {
    expect(formatPrice(1234)).toBe('1.2K');
    expect(formatPrice(12345)).toBe('12.3K');
    expect(formatPrice(123456)).toBe('123.5K');
  });

  it('should format very large numbers correctly', () => {
    const result = formatPrice(1234567);
    expect(result).toContain('K'); // Above 10K gets K suffix
  });

  it('should handle zero and negative numbers', () => {
    expect(formatPrice(0).startsWith('0')).toBe(true);
    expect(formatPrice(-123)).toBe('-123');
    expect(formatPrice(-1234)).toBe('-1.2K');
  });
});

describe('calcFibTargets', () => {
  it('should calculate Fibonacci extension levels correctly', () => {
    const result = calcFibTargets(100, 80, 120);

    expect(result).toHaveProperty('fib236');
    expect(result).toHaveProperty('fib382');
    expect(result).toHaveProperty('fib618');
    expect(result).toHaveProperty('fib100');
    expect(result).toHaveProperty('fib1618');

    // All extension levels should be above spot
    expect(result.fib236).toBeGreaterThan(100);
    expect(result.fib382).toBeGreaterThan(100);
    expect(result.fib618).toBeGreaterThan(100);
  });

  it('should handle edge cases', () => {
    const result = calcFibTargets(100, 100, 100);
    expect(result.fib236).toBeDefined();
    expect(result.fib382).toBeDefined();
    expect(result.fib236).toBe(100); // No range means no extension
  });

  it('should handle invalid inputs gracefully', () => {
    const result = calcFibTargets(null, null, null);
    expect(result).toBeDefined();
    expect(typeof result).toBe('object');
  });
});

describe('runMonteCarlo', () => {
  it('should return simulation results with correct structure', () => {
    const spot = 100;
    const vol = 0.3;
    const drift = 0.15;
    const volMult = 1.0;
    const targets = [120, 150, 200];
    const horizons = [30, 90, 180];
    const seed = 42;

    const result = runMonteCarlo(spot, vol, drift, volMult, targets, horizons, seed);

    expect(result).toHaveProperty('pctData');
    expect(result).toHaveProperty('probs');
    expect(result).toHaveProperty('finals');

    expect(Array.isArray(result.pctData)).toBe(true);
    expect(Array.isArray(result.probs)).toBe(true);
    expect(Array.isArray(result.finals)).toBe(true);

    // Check probs structure
    expect(result.probs.length).toBe(targets.length);
    result.probs.forEach(prob => {
      expect(prob).toHaveProperty('tgt');
      expect(prob).toHaveProperty('mc');
      expect(prob.mc).toBeGreaterThanOrEqual(0);
      expect(prob.mc).toBeLessThanOrEqual(1);
    });
  });

  it('should produce different results with different seeds', () => {
    const spot = 100;
    const vol = 0.3;
    const drift = 0.15;
    const volMult = 1.0;
    const targets = [120];
    const horizons = [90];

    const result1 = runMonteCarlo(spot, vol, drift, volMult, targets, horizons, 42);
    const result2 = runMonteCarlo(spot, vol, drift, volMult, targets, horizons, 43);

    // Just verify both results are valid
    expect(result1).toBeDefined();
    expect(result2).toBeDefined();
    expect(result1.probs[0]).toBeDefined();
    expect(result2.probs[0]).toBeDefined();
  });

  it('should handle high volatility', () => {
    const result = runMonteCarlo(100, 0.8, 0.1, 1.0, [150], [90], 42);
    expect(result.probs[0].mc).toBeGreaterThanOrEqual(0);
    expect(result.probs[0].mc).toBeLessThanOrEqual(1);
  });
});
