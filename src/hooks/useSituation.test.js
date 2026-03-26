import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSituation, WORLD_CITIES } from './useSituation';

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

const mockFlightsResponse = {
  source: 'opensky',
  count: 2,
  states: [
    { icao24: 'abc123', callsign: 'AC123', lat: 49.2, lon: -123.1, altitude: 35000, heading: 180 },
    { icao24: 'def456', callsign: 'WS456', lat: 49.0, lon: -122.9, altitude: 38000, heading: 90 },
  ],
};

const mockTrafficResponse = {
  flow: { source: 'tomtom', congestion: 'moderate', currentSpeed: 60, freeFlowSpeed: 90 },
  incidents: [{ type: 'ACCIDENT', description: 'Minor collision', severity: 'MINOR' }],
  center: { lat: 49.28, lon: -123.12 },
};

const mockGeoResponse = {
  status: 'success',
  lat: 49.28,
  lon: -123.12,
  city: 'Vancouver',
};

function mockFetch() {
  global.fetch = vi.fn(url => {
    if (url.includes('ipapi.co')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(mockGeoResponse) });
    }
    if (url.includes('/api/flights')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(mockFlightsResponse) });
    }
    if (url.includes('/api/traffic')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(mockTrafficResponse) });
    }
    return Promise.reject(new Error(`Unexpected URL: ${url}`));
  });
}

describe('WORLD_CITIES', () => {
  it('contains 6 cities', () => {
    expect(WORLD_CITIES).toHaveLength(6);
  });

  it('all cities have required fields', () => {
    for (const city of WORLD_CITIES) {
      expect(city).toHaveProperty('id');
      expect(city).toHaveProperty('lat');
      expect(city).toHaveProperty('lon');
      expect(city).toHaveProperty('label');
      expect(typeof city.lat).toBe('number');
      expect(typeof city.lon).toBe('number');
    }
  });

  it('includes NYC, London, Tokyo, Paris, Dubai, Sydney', () => {
    const ids = WORLD_CITIES.map(c => c.id);
    expect(ids).toContain('nyc');
    expect(ids).toContain('london');
    expect(ids).toContain('tokyo');
    expect(ids).toContain('paris');
    expect(ids).toContain('dubai');
    expect(ids).toContain('sydney');
  });
});

describe('useSituation', () => {
  beforeEach(() => {
    mockFetch();
    localStorage.clear();
  });

  it('defaults to first world city center before geo resolves', () => {
    const { result } = renderHook(() => useSituation());
    const { activeCenter } = result.current;
    expect(activeCenter.lat).toBe(WORLD_CITIES[0].lat);
    expect(activeCenter.lon).toBe(WORLD_CITIES[0].lon);
  });

  it('uses a fresh stored location before falling back to IP lookup', () => {
    localStorage.setItem('monica_last_geo', JSON.stringify({
      lat: 49.2827,
      lon: -123.1207,
      label: 'Current location',
      ts: Date.now(),
    }));

    const { result } = renderHook(() => useSituation());

    expect(result.current.activeCenter.lat).toBe(49.2827);
    expect(result.current.activeCenter.lon).toBe(-123.1207);
  });

  it('loads flights on mount', async () => {
    const { result } = renderHook(() => useSituation());
    await act(async () => { await new Promise(r => setTimeout(r, 0)); });
    expect(result.current.flights.length).toBeGreaterThan(0);
    expect(result.current.flights[0].callsign).toBe('AC123');
  });

  it('loads traffic on mount', async () => {
    const { result } = renderHook(() => useSituation());
    await act(async () => { await new Promise(r => setTimeout(r, 0)); });
    expect(result.current.traffic).not.toBeNull();
    expect(result.current.traffic.flow.congestion).toBe('moderate');
  });

  it('setSelectedCity updates activeCenter', async () => {
    const { result } = renderHook(() => useSituation());
    const london = WORLD_CITIES.find(c => c.id === 'london');
    act(() => {
      result.current.setSelectedCity(london);
    });
    expect(result.current.activeCenter.lat).toBe(london.lat);
    expect(result.current.activeCenter.lon).toBe(london.lon);
    expect(result.current.activeCenter.label).toBe('London');
  });

  it('handles flight API failure gracefully', async () => {
    global.fetch = vi.fn(url => {
      if (url.includes('/api/flights')) return Promise.reject(new Error('Network error'));
      if (url.includes('ipapi.co')) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockGeoResponse) });
      if (url.includes('/api/traffic')) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockTrafficResponse) });
      return Promise.reject(new Error('Unknown'));
    });

    const { result } = renderHook(() => useSituation());
    await act(async () => { await new Promise(r => setTimeout(r, 0)); });
    expect(result.current.flightsError).toBeTruthy();
    expect(result.current.flights).toHaveLength(0);
  });

  it('handles traffic API failure gracefully', async () => {
    global.fetch = vi.fn(url => {
      if (url.includes('/api/traffic')) return Promise.reject(new Error('TomTom down'));
      if (url.includes('ipapi.co')) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockGeoResponse) });
      if (url.includes('/api/flights')) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockFlightsResponse) });
      return Promise.reject(new Error('Unknown'));
    });

    const { result } = renderHook(() => useSituation());
    await act(async () => { await new Promise(r => setTimeout(r, 0)); });
    expect(result.current.trafficError).toBeTruthy();
    expect(result.current.traffic).toBeNull();
  });

  it('handles degraded flights response (non-200 with valid JSON)', async () => {
    global.fetch = vi.fn(url => {
      if (url.includes('/api/flights')) {
        return Promise.resolve({
          ok: false, status: 502,
          json: () => Promise.resolve({ states: [], meta: { degraded: true } }),
        });
      }
      if (url.includes('/api/traffic')) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockTrafficResponse) });
      if (url.includes('ipapi.co')) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockGeoResponse) });
      return Promise.reject(new Error('Unknown'));
    });

    const { result } = renderHook(() => useSituation());
    await act(async () => { await new Promise(r => setTimeout(r, 0)); });
    expect(result.current.flights).toEqual([]);
    expect(result.current.flightsError).toBe('Flights temporarily unavailable');
  });

  it('handles non-JSON flights error body (HTML 502)', async () => {
    global.fetch = vi.fn(url => {
      if (url.includes('/api/flights')) {
        return Promise.resolve({
          ok: false, status: 502,
          json: () => Promise.reject(new Error('Unexpected token <')),
        });
      }
      if (url.includes('/api/traffic')) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockTrafficResponse) });
      if (url.includes('ipapi.co')) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockGeoResponse) });
      return Promise.reject(new Error('Unknown'));
    });

    const { result } = renderHook(() => useSituation());
    await act(async () => { await new Promise(r => setTimeout(r, 0)); });
    expect(result.current.flights).toEqual([]);
    expect(result.current.flightsError).toBe('Flights temporarily unavailable');
  });

  it('handles degraded traffic response (non-200 with valid JSON)', async () => {
    global.fetch = vi.fn(url => {
      if (url.includes('/api/traffic')) {
        return Promise.resolve({
          ok: false, status: 502,
          json: () => Promise.resolve({ meta: { degraded: true } }),
        });
      }
      if (url.includes('/api/flights')) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockFlightsResponse) });
      if (url.includes('ipapi.co')) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockGeoResponse) });
      return Promise.reject(new Error('Unknown'));
    });

    const { result } = renderHook(() => useSituation());
    await act(async () => { await new Promise(r => setTimeout(r, 0)); });
    expect(result.current.trafficError).toBe('Traffic data temporarily unavailable');
  });

  it('handles non-JSON traffic error body (HTML 502)', async () => {
    global.fetch = vi.fn(url => {
      if (url.includes('/api/traffic')) {
        return Promise.resolve({
          ok: false, status: 502,
          json: () => Promise.reject(new Error('Unexpected token <')),
        });
      }
      if (url.includes('/api/flights')) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockFlightsResponse) });
      if (url.includes('ipapi.co')) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockGeoResponse) });
      return Promise.reject(new Error('Unknown'));
    });

    const { result } = renderHook(() => useSituation());
    await act(async () => { await new Promise(r => setTimeout(r, 0)); });
    expect(result.current.traffic).toBeNull();
    expect(result.current.trafficError).toBe('Traffic data temporarily unavailable');
  });

  it('handles geo API failure by using world city fallback', async () => {
    global.fetch = vi.fn(url => {
      if (url.includes('ipapi.co')) return Promise.reject(new Error('Geo error'));
      if (url.includes('/api/flights')) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockFlightsResponse) });
      if (url.includes('/api/traffic')) return Promise.resolve({ ok: true, json: () => Promise.resolve(mockTrafficResponse) });
      return Promise.reject(new Error('Unknown'));
    });

    const { result } = renderHook(() => useSituation());
    await act(async () => { await new Promise(r => setTimeout(r, 0)); });
    expect(result.current.flights.length).toBeGreaterThan(0);
    expect(result.current.activeCenter.lat).toBeTypeOf('number');
    expect(result.current.activeCenter.lon).toBeTypeOf('number');
  });
});
