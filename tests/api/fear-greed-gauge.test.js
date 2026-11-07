import { describe, it, expect } from 'vitest';
import { moodScore, ratingFor } from '../../server/api/fear-greed.js';

const flat = (n, v) => Array(n).fill(v);

describe('own fear & greed gauge', () => {
  it('is neutral when nothing moves', () => {
    expect(moodScore(flat(200, 100), flat(60, 20))).toBe(50);
  });
  it('reads greed on a rally with falling VIX', () => {
    const s = moodScore([...flat(199, 100), 106], [...flat(59, 20), 16]);
    expect(s).toBeGreaterThan(75);
    expect(ratingFor(s)).toBe('extreme greed');
  });
  it('reads fear on a selloff with VIX spiking', () => {
    const s = moodScore([...flat(199, 100), 93], [...flat(59, 20), 28]);
    expect(s).toBeLessThan(25);
    expect(ratingFor(s)).toBe('extreme fear');
  });
  it('needs enough history', () => {
    expect(moodScore(flat(10, 1), flat(60, 1))).toBeNull();
  });
});
