import { describe, it, expect } from 'vitest';
import {
  OBJECT_TYPES, RELATIONSHIP_TYPES, generateId, createObject, createRelationship,
  validateObject, validateRelationship, deterministicId,
  stockToAsset, earthquakeToEvent, newsToEvent, accountToOntology, personToOntology,
  crimeToEvent, placeFromCoords,
} from './ontology';

describe('ontology', () => {
  describe('generateId', () => {
    it('returns unique IDs', () => {
      const ids = new Set(Array.from({ length: 100 }, () => generateId()));
      expect(ids.size).toBe(100);
    });

    it('returns string IDs', () => {
      expect(typeof generateId()).toBe('string');
    });
  });

  describe('createObject', () => {
    it('creates valid object with all fields', () => {
      const obj = createObject('asset', 'AAPL', { symbol: 'AAPL' });
      expect(obj.type).toBe('asset');
      expect(obj.name).toBe('AAPL');
      expect(obj.properties.symbol).toBe('AAPL');
      expect(obj.source).toBe('manual');
      expect(obj.id).toBeTruthy();
      expect(obj.createdAt).toBeTruthy();
      expect(obj.updatedAt).toBeTruthy();
    });

    it('accepts custom source', () => {
      const obj = createObject('event', 'Test', {}, 'usgs');
      expect(obj.source).toBe('usgs');
    });

    it('throws on invalid type', () => {
      expect(() => createObject('invalid', 'Test')).toThrow('Invalid object type');
    });

    it('works for all valid types', () => {
      for (const type of OBJECT_TYPES) {
        const obj = createObject(type, `Test ${type}`);
        expect(obj.type).toBe(type);
      }
    });
  });

  describe('createRelationship', () => {
    it('creates valid relationship', () => {
      const rel = createRelationship('owns', 'a', 'b');
      expect(rel.type).toBe('owns');
      expect(rel.sourceId).toBe('a');
      expect(rel.targetId).toBe('b');
      expect(rel.createdAt).toBeTruthy();
    });

    it('throws on invalid type', () => {
      expect(() => createRelationship('invalid', 'a', 'b')).toThrow('Invalid relationship type');
    });

    it('works for all valid types', () => {
      for (const type of RELATIONSHIP_TYPES) {
        const rel = createRelationship(type, 'a', 'b');
        expect(rel.type).toBe(type);
      }
    });
  });

  describe('validateObject', () => {
    it('accepts valid object', () => {
      const obj = createObject('asset', 'AAPL');
      expect(validateObject(obj).valid).toBe(true);
    });

    it('rejects null', () => {
      expect(validateObject(null).valid).toBe(false);
    });

    it('rejects missing id', () => {
      expect(validateObject({ type: 'asset', name: 'Test' }).valid).toBe(false);
    });

    it('rejects invalid type', () => {
      expect(validateObject({ id: '1', type: 'bogus', name: 'Test' }).valid).toBe(false);
    });

    it('rejects missing name', () => {
      expect(validateObject({ id: '1', type: 'asset' }).valid).toBe(false);
    });
  });

  describe('validateRelationship', () => {
    it('accepts valid relationship', () => {
      expect(validateRelationship({ type: 'owns', sourceId: 'a', targetId: 'b' }).valid).toBe(true);
    });

    it('rejects missing sourceId', () => {
      expect(validateRelationship({ type: 'owns', targetId: 'b' }).valid).toBe(false);
    });

    it('rejects invalid type', () => {
      expect(validateRelationship({ type: 'bogus', sourceId: 'a', targetId: 'b' }).valid).toBe(false);
    });
  });

  describe('deterministicId', () => {
    it('produces same ID for same input', () => {
      expect(deterministicId('asset', 'AAPL')).toBe(deterministicId('asset', 'AAPL'));
    });

    it('produces different IDs for different inputs', () => {
      expect(deterministicId('asset', 'AAPL')).not.toBe(deterministicId('asset', 'GOOGL'));
    });

    it('includes type in ID', () => {
      expect(deterministicId('asset', 'X')).toContain('asset');
    });
  });

  describe('converters', () => {
    it('stockToAsset converts stock data', () => {
      const asset = stockToAsset('NVDA', { name: 'NVIDIA', price: 130, changePercent: 2.5 });
      expect(asset.id).toBe('asset:NVDA');
      expect(asset.type).toBe('asset');
      expect(asset.name).toBe('NVIDIA');
      expect(asset.properties.symbol).toBe('NVDA');
      expect(asset.properties.price).toBe(130);
      expect(asset.source).toBe('stocks');
    });

    it('stockToAsset uses symbol as fallback name', () => {
      const asset = stockToAsset('XYZ', null);
      expect(asset.name).toBe('XYZ');
    });

    it('earthquakeToEvent converts quake data', () => {
      const event = earthquakeToEvent({ id: 'eq1', magnitude: 5.5, depth: 10, lat: 49, lon: -123, place: 'BC Coast' });
      expect(event.type).toBe('event');
      expect(event.name).toContain('M5.5');
      expect(event.properties.eventType).toBe('earthquake');
      expect(event.properties.severity).toBe('critical');
    });

    it('earthquakeToEvent sets correct severity levels', () => {
      expect(earthquakeToEvent({ magnitude: 6 }).properties.severity).toBe('critical');
      expect(earthquakeToEvent({ magnitude: 4 }).properties.severity).toBe('elevated');
      expect(earthquakeToEvent({ magnitude: 2 }).properties.severity).toBe('monitor');
    });

    it('newsToEvent converts article', () => {
      const event = newsToEvent({ title: 'Test Article', url: 'https://example.com', source: 'Test' });
      expect(event.type).toBe('event');
      expect(event.name).toBe('Test Article');
      expect(event.properties.eventType).toBe('news');
    });

    it('accountToOntology converts account', () => {
      const obj = accountToOntology({ name: 'TFSA', type: 'tfsa', balance: 101, institution: 'Wealthsimple' });
      expect(obj.id).toBe('account:tfsa');
      expect(obj.type).toBe('account');
      expect(obj.properties.balance).toBe(101);
    });

    it('personToOntology converts person', () => {
      const obj = personToOntology({ name: 'John Doe', id: 'jd' });
      expect(obj.type).toBe('person');
      expect(obj.name).toBe('John Doe');
    });

    it('crimeToEvent converts crime data', () => {
      const event = crimeToEvent({ id: 'c1', type: 'Theft', lat: 49, lon: -123 });
      expect(event.type).toBe('event');
      expect(event.properties.eventType).toBe('crime');
    });

    it('placeFromCoords creates place', () => {
      const place = placeFromCoords(49.2827, -123.1207, 'Vancouver');
      expect(place.type).toBe('place');
      expect(place.name).toBe('Vancouver');
      expect(place.properties.lat).toBe(49.2827);
    });

    it('placeFromCoords generates name from coords when none given', () => {
      const place = placeFromCoords(49.2827, -123.1207);
      expect(place.name).toContain('49.2827');
    });
  });

  describe('constants', () => {
    it('has all expected object types', () => {
      expect(OBJECT_TYPES).toContain('asset');
      expect(OBJECT_TYPES).toContain('person');
      expect(OBJECT_TYPES).toContain('event');
      expect(OBJECT_TYPES).toContain('decision');
      expect(OBJECT_TYPES.length).toBe(9);
    });

    it('has all expected relationship types', () => {
      expect(RELATIONSHIP_TYPES).toContain('owns');
      expect(RELATIONSHIP_TYPES).toContain('mentions');
      expect(RELATIONSHIP_TYPES.length).toBe(6);
    });
  });
});
