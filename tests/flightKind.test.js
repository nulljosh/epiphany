import { describe, it, expect } from 'vitest';
import { flightKind } from '../server/api/flights.js';

describe('flightKind', () => {
  it('sorts callsigns into the map filter kinds', () => {
    expect(flightKind('ACA123 ')).toBe('passenger');
    expect(flightKind('FDX1402')).toBe('cargo');
    expect(flightKind('CJT501')).toBe('cargo');
    expect(flightKind('RCH871')).toBe('military');
    expect(flightKind('WJA9', 1)).toBe('military');
    expect(flightKind('CGABC')).toBe('private');
    expect(flightKind('')).toBe('private');
  });
});
