import { describe, expect, it } from 'vitest';
import { km } from '../../src/components/LiveMapBackdrop';

describe('km', () => {
  it('measures city-scale distance close to the real one', () => {
    // Vancouver City Hall to Science World, about 1.6 km in a straight line.
    expect(km({ lat: 49.2609, lon: -123.1139 }, { lat: 49.2734, lon: -123.1037 })).toBeCloseTo(1.56, 1);
    expect(km({ lat: 49, lon: -123 }, { lat: 49, lon: -123 })).toBe(0);
  });
});
