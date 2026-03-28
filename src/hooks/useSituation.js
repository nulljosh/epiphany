import { useState, useEffect, useCallback } from 'react';
import { fetchWithTimeout, fetchJsonGraceful } from '../utils/helpers';

export const WORLD_CITIES = [
  { id: 'nyc',    label: 'NYC',    lat: 40.7128,  lon: -74.0060,  name: 'New York' },
  { id: 'london', label: 'London', lat: 51.5074,  lon: -0.1278,   name: 'London'   },
  { id: 'tokyo',  label: 'Tokyo',  lat: 35.6762,  lon: 139.6503,  name: 'Tokyo'    },
  { id: 'paris',  label: 'Paris',  lat: 48.8566,  lon: 2.3522,    name: 'Paris'    },
  { id: 'dubai',  label: 'Dubai',  lat: 25.2048,  lon: 55.2708,   name: 'Dubai'    },
  { id: 'sydney', label: 'Sydney', lat: -33.8688, lon: 151.2093,  name: 'Sydney'   },
];

const FLIGHT_REFRESH    = 120_000;  // was 15s -- burned ~5.7K invocations/user/day
const TRAFFIC_REFRESH   = 60_000;
const SITUATION_REFRESH = 5 * 60_000;
const LAST_GEO_KEY = 'monica_last_geo';
const FRESH_GEO_MS = 30 * 60 * 1000;
const FRESH_IP_MS = 5 * 60 * 1000;
const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

function apiPath(path) {
  return `${API_BASE}${path}`;
}

function getStoredGeo() {
  try {
    const raw = localStorage.getItem(LAST_GEO_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.lat !== 'number' || typeof parsed?.lon !== 'number') return null;
    const age = typeof parsed?.ts === 'number' ? Date.now() - parsed.ts : Number.POSITIVE_INFINITY;
    const isIpGuess = /\bip\b/i.test(parsed?.label || '');
    const maxAge = isIpGuess ? FRESH_IP_MS : FRESH_GEO_MS;
    if (age > maxAge) return null;
    return { lat: parsed.lat, lon: parsed.lon, city: parsed.label || 'Last known location' };
  } catch {
    return null;
  }
}

function bboxFromCenter(lat, lon, deg = 2) {
  return { lamin: lat - deg, lomin: lon - deg, lamax: lat + deg, lomax: lon + deg };
}


export function useSituation() {
  const [userLocation, setUserLocation] = useState(() => getStoredGeo());
  const [locationError, setLocationError] = useState(null);
  const [selectedCity, setSelectedCity] = useState(null);

  const [flights, setFlights] = useState([]);
  const [flightsLoading, setFlightsLoading] = useState(false);
  const [flightsError, setFlightsError] = useState(null);

  const [traffic, setTraffic] = useState(null);
  const [trafficLoading, setTrafficLoading] = useState(false);
  const [trafficError, setTrafficError] = useState(null);

  const [incidents, setIncidents] = useState([]);
  const [earthquakes, setEarthquakes] = useState([]);
  const [events, setEvents] = useState([]);
  const [weatherAlerts, setWeatherAlerts] = useState([]);
  const [crimeIncidents, setCrimeIncidents] = useState([]);
  const [localEvents, setLocalEvents] = useState([]);

  const activeCenter = selectedCity
    ? { lat: selectedCity.lat, lon: selectedCity.lon, label: selectedCity.label }
    : userLocation
      ? { lat: userLocation.lat, lon: userLocation.lon, label: userLocation.city }
      : { lat: WORLD_CITIES[0].lat, lon: WORLD_CITIES[0].lon, label: WORLD_CITIES[0].label };

  useEffect(() => {
    if (process.env.NODE_ENV === 'test') return;
    const storedGeo = getStoredGeo();
    if (storedGeo) {
      setUserLocation(storedGeo);
      return;
    }
    fetchWithTimeout('https://ipapi.co/json/')
      .then(data => {
        if (typeof data.latitude === 'number' && typeof data.longitude === 'number') {
          setUserLocation({ lat: data.latitude, lon: data.longitude, city: data.city || 'IP fallback' });
        }
        else setLocationError('Geolocation unavailable');
      })
      .catch(err => setLocationError(err.message));
  }, []);

  const fetchFlights = useCallback(async () => {
    setFlightsLoading(true);
    setFlightsError(null);
    const bbox = bboxFromCenter(activeCenter.lat, activeCenter.lon);
    try {
      const data = await fetchJsonGraceful(
        apiPath(`/api/flights?lamin=${bbox.lamin}&lomin=${bbox.lomin}&lamax=${bbox.lamax}&lomax=${bbox.lomax}`)
      );
      setFlights(data?.states ?? []);
      if (!data || data.meta?.degraded) {
        setFlightsError('Flights temporarily unavailable');
      }
    } catch {
      setFlightsError('Flights unavailable');
    } finally {
      setFlightsLoading(false);
    }
  }, [activeCenter.lat, activeCenter.lon]);

  const fetchTraffic = useCallback(async () => {
    setTrafficLoading(true);
    setTrafficError(null);
    const bbox = bboxFromCenter(activeCenter.lat, activeCenter.lon, 1);
    try {
      const data = await fetchJsonGraceful(
        apiPath(`/api/traffic?lat=${activeCenter.lat}&lon=${activeCenter.lon}&lamin=${bbox.lamin}&lomin=${bbox.lomin}&lamax=${bbox.lamax}&lomax=${bbox.lomax}`)
      );
      setTraffic(data);
      if (!data || data.meta?.degraded) {
        setTrafficError('Traffic data temporarily unavailable');
      }
    } catch {
      setTrafficError('Traffic unavailable');
    } finally {
      setTrafficLoading(false);
    }
  }, [activeCenter.lat, activeCenter.lon]);

  const fetchIncidents = useCallback(async () => {
    const bbox = bboxFromCenter(activeCenter.lat, activeCenter.lon, 1);
    try {
      const data = await fetchWithTimeout(apiPath(`/api/incidents?lat=${activeCenter.lat}&lon=${activeCenter.lon}&lamin=${bbox.lamin}&lomin=${bbox.lomin}&lamax=${bbox.lamax}&lomax=${bbox.lomax}`));
      setIncidents(data.incidents ?? []);
    } catch { /* non-critical */ }
  }, [activeCenter.lat, activeCenter.lon]);

  const fetchEarthquakes = useCallback(async () => {
    try {
      const data = await fetchWithTimeout(apiPath('/api/earthquakes'));
      setEarthquakes(data.earthquakes ?? []);
    } catch { /* non-critical */ }
  }, []);

  const fetchEvents = useCallback(async () => {
    try {
      const data = await fetchWithTimeout(apiPath(`/api/events?lat=${activeCenter.lat}&lon=${activeCenter.lon}`));
      setEvents(data.events ?? []);
    } catch { /* non-critical */ }
  }, [activeCenter.lat, activeCenter.lon]);

  const fetchWeatherAlerts = useCallback(async () => {
    try {
      const data = await fetchWithTimeout(apiPath(`/api/weather-alerts?lat=${activeCenter.lat}&lon=${activeCenter.lon}`));
      setWeatherAlerts(data.alerts ?? []);
    } catch { /* non-critical */ }
  }, [activeCenter.lat, activeCenter.lon]);

  const fetchCrime = useCallback(async () => {
    try {
      const data = await fetchWithTimeout(apiPath(`/api/crime?lat=${activeCenter.lat}&lon=${activeCenter.lon}`));
      setCrimeIncidents(data.incidents ?? []);
    } catch { /* non-critical */ }
  }, [activeCenter.lat, activeCenter.lon]);

  const fetchLocalEvents = useCallback(async () => {
    try {
      const data = await fetchWithTimeout(apiPath(`/api/local-events?lat=${activeCenter.lat}&lon=${activeCenter.lon}`));
      setLocalEvents(data.events ?? []);
    } catch { /* non-critical */ }
  }, [activeCenter.lat, activeCenter.lon]);

  useEffect(() => {
    fetchFlights();
    fetchTraffic();
    const fi = setInterval(fetchFlights, FLIGHT_REFRESH);
    const ti = setInterval(fetchTraffic, TRAFFIC_REFRESH);
    return () => { clearInterval(fi); clearInterval(ti); };
  }, [fetchFlights, fetchTraffic]);

  useEffect(() => {
    if (process.env.NODE_ENV === 'test') return;
    fetchIncidents();
    fetchEarthquakes();
    fetchEvents();
    fetchWeatherAlerts();
    fetchCrime();
    fetchLocalEvents();
    const si = setInterval(() => {
      fetchIncidents();
      fetchEarthquakes();
      fetchEvents();
      fetchWeatherAlerts();
      fetchCrime();
      fetchLocalEvents();
    }, SITUATION_REFRESH);
    return () => clearInterval(si);
  }, [fetchIncidents, fetchEarthquakes, fetchEvents, fetchWeatherAlerts, fetchCrime, fetchLocalEvents]);

  return {
    userLocation, locationError,
    selectedCity, setSelectedCity,
    activeCenter,
    worldCities: WORLD_CITIES,
    flights, flightsLoading, flightsError,
    traffic, trafficLoading, trafficError,
    incidents, earthquakes, events, weatherAlerts, crimeIncidents, localEvents,
    refetchFlights: fetchFlights,
    refetchTraffic: fetchTraffic,
  };
}
