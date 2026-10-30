import { describe, it, expect } from 'vitest';
import { parseStorms } from '../server/api/storms.js';

describe('parseStorms', () => {
  it('reads position, kind and strength, skipping storms without a position', () => {
    const out = parseStorms({ activeStorms: [
      { id: 'al142026', binNumber: 'AT1', name: 'Nadine', classification: 'HU', intensity: '85', pressure: '975', latitudeNumeric: 24.5, longitudeNumeric: -71.2, movementDir: 315, movementSpeed: 12, lastUpdate: '2026-10-30T15:00:00.000Z' },
      { id: 'ep202026', name: 'Ghost', classification: 'TD' },
    ] });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ name: 'Nadine', kind: 'Hurricane', windKt: 85, lat: 24.5, lon: -71.2, movement: '315° at 12 mph', bin: 'AT1' });
  });
});
