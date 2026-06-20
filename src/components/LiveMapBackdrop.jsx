import { memo, useCallback, useEffect, useRef, useState } from 'react';

// Brookswood/Langley, BC -- home base. Used while geolocation resolves and
// as the fallback if IP geolocation fails or returns junk.
const DEFAULT_CENTER = { lat: 49.05, lon: -122.66 };
// ipapi.co's generic/default response for unresolved IPs lands on NYC --
// treat coords near there as invalid rather than persisting/centering on them.
const IP_GEO_JUNK = { lat: 40.7128, lon: -74.0060 };
// v2: only real GPS fixes are persisted. v1 entries could hold IP-geolocation
// guesses (e.g. ISP resolving to Aldergrove) that the locate button then
// treated as "current location" — bumping the key evicts those caches.
const LAST_GEO_KEY = 'epiphany_last_geo_v2';
const FRESH_GEO_MS = 30 * 60 * 1000;
const GEO_DETAIL_ZOOM = 13.6;
const CACHE_DETAIL_ZOOM = 13.2;
const IP_FALLBACK_ZOOM = 11.5;
const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

const apiPath = (path) => `${API_BASE}${path}`;

function loadStoredGeo() {
  try {
    const raw = localStorage.getItem(LAST_GEO_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.lat !== 'number' || typeof parsed?.lon !== 'number') return null;
    if (parsed?.source !== 'gps') return null;
    const age = typeof parsed?.ts === 'number' ? Date.now() - parsed.ts : Number.POSITIVE_INFINITY;
    if (age > FRESH_GEO_MS) return null;
    return { lat: parsed.lat, lon: parsed.lon, label: parsed.label || 'Last known location' };
  } catch {
    return null;
  }
}

const GEO_KEYWORDS = [
  { re: /\bnew york|nyc|knicks|nets|yankees|mets|giants|jets|rangers\b/i, lat: 40.7128, lon: -74.0060, label: 'New York' },
  { re: /\blos angeles|lakers|clippers|dodgers|rams|chargers\b/i, lat: 34.0522, lon: -118.2437, label: 'Los Angeles' },
  { re: /\bchicago|bulls|bears|cubs|white sox\b/i, lat: 41.8781, lon: -87.6298, label: 'Chicago' },
  { re: /\bboston|celtics|red sox|patriots|bruins\b/i, lat: 42.3601, lon: -71.0589, label: 'Boston' },
  { re: /\bmiami|heat|dolphins|marlins\b/i, lat: 25.7617, lon: -80.1918, label: 'Miami' },
  { re: /\bdallas|mavericks|cowboys|rangers\b/i, lat: 32.7767, lon: -96.7970, label: 'Dallas' },
  { re: /\bsan francisco|warriors|49ers|giants\b/i, lat: 37.7749, lon: -122.4194, label: 'San Francisco' },
  { re: /\bwashington|white house|senate|congress|supreme court|president\b/i, lat: 38.9072, lon: -77.0369, label: 'Washington, DC' },
  { re: /\blondon\b/i, lat: 51.5074, lon: -0.1278, label: 'London' },
  { re: /\bparis\b/i, lat: 48.8566, lon: 2.3522, label: 'Paris' },
  { re: /\btokyo\b/i, lat: 35.6762, lon: 139.6503, label: 'Tokyo' },
  { re: /\bvancouver\b/i, lat: 49.2827, lon: -123.1207, label: 'Vancouver' },
  { re: /\btoronto\b/i, lat: 43.6532, lon: -79.3832, label: 'Toronto' },
  { re: /\bhouston|texans|rockets|astros\b/i, lat: 29.7604, lon: -95.3698, label: 'Houston' },
  { re: /\bphiladelphia|eagles|76ers|sixers|phillies\b/i, lat: 39.9526, lon: -75.1652, label: 'Philadelphia' },
  { re: /\bphoenix|suns|cardinals\b/i, lat: 33.4484, lon: -112.0740, label: 'Phoenix' },
  { re: /\bseattle|seahawks|mariners|kraken\b/i, lat: 47.6062, lon: -122.3321, label: 'Seattle' },
  { re: /\bdenver|nuggets|broncos|avalanche\b/i, lat: 39.7392, lon: -104.9903, label: 'Denver' },
  { re: /\batlanta|hawks|falcons|braves\b/i, lat: 33.7490, lon: -84.3880, label: 'Atlanta' },
  { re: /\bdetroit|lions|tigers|pistons|red wings\b/i, lat: 42.3314, lon: -83.0458, label: 'Detroit' },
  { re: /\bminneapolis|minnesota|timberwolves|vikings|twins\b/i, lat: 44.9778, lon: -93.2650, label: 'Minneapolis' },
  { re: /\bmontreal|canadiens|habs\b/i, lat: 45.5017, lon: -73.5673, label: 'Montreal' },
  { re: /\bberlin\b/i, lat: 52.5200, lon: 13.4050, label: 'Berlin' },
  { re: /\bmoscow|kremlin|russia\b/i, lat: 55.7558, lon: 37.6176, label: 'Moscow' },
  { re: /\bbeijing|china\b/i, lat: 39.9042, lon: 116.4074, label: 'Beijing' },
  { re: /\bmumbai|bombay|india\b/i, lat: 19.0760, lon: 72.8777, label: 'Mumbai' },
  { re: /\bdubai|uae|emirates\b/i, lat: 25.2048, lon: 55.2708, label: 'Dubai' },
  { re: /\bsydney|australia\b/i, lat: -33.8688, lon: 151.2093, label: 'Sydney' },
  { re: /\bseoul|south korea\b/i, lat: 37.5665, lon: 126.9780, label: 'Seoul' },
  { re: /\bsingapore\b/i, lat: 1.3521, lon: 103.8198, label: 'Singapore' },
  { re: /\bistanbul|turkey\b/i, lat: 41.0082, lon: 28.9784, label: 'Istanbul' },
  { re: /\bcairo|egypt\b/i, lat: 30.0444, lon: 31.2357, label: 'Cairo' },
  { re: /\blagos|nigeria\b/i, lat: 6.5244, lon: 3.3792, label: 'Lagos' },
];

const CITY_HUBS = [
  { label: 'Vancouver', lat: 49.2827, lon: -123.1207 },
  { label: 'Toronto', lat: 43.6532, lon: -79.3832 },
  { label: 'New York', lat: 40.7128, lon: -74.0060 },
  { label: 'Chicago', lat: 41.8781, lon: -87.6298 },
  { label: 'Los Angeles', lat: 34.0522, lon: -118.2437 },
  { label: 'London', lat: 51.5074, lon: -0.1278 },
  { label: 'Paris', lat: 48.8566, lon: 2.3522 },
  { label: 'Tokyo', lat: 35.6762, lon: 139.6503 },
  { label: 'Sydney', lat: -33.8688, lon: 151.2093 },
];

function geoKeywordMatch(text) {
  for (const k of GEO_KEYWORDS) {
    if (k.re.test(text || '')) return { lat: k.lat, lon: k.lon, label: k.label };
  }
  return null;
}

function emptyPayload() {
  return {
    incidents: [], trafficIncidents: [], earthquakes: [], events: [],
    markets: [], flights: [],
  };
}

function trafficColor(incident) {
  const text = `${incident?.type || ''} ${incident?.description || ''}`.toLowerCase();
  if (text.includes('heavy') || text.includes('accident') || text.includes('closure')) return '#ef4444';
  if (text.includes('moderate') || text.includes('slow') || text.includes('delay')) return '#f59e0b';
  return '#22c55e';
}

function mapsLink(lat, lon, zoom = 15) {
  return `https://www.google.com/maps/@${lat},${lon},${zoom}z`;
}

function markerCss({ size = 10, color, pulse, shape = 'circle', extra = '' }) {
  const radius = shape === 'circle' ? '50%' : shape === 'bar' ? '999px' : '2px';
  const shadow = pulse ? `animation:${pulse};` : '';
  return `width:${size}px;height:${size}px;border-radius:${radius};background:${color};${shadow}${extra}`;
}

function extractCoords(item) {
  const lat = item.lat ?? item.latitude ?? null;
  const lon = item.lng ?? item.lon ?? item.longitude ?? null;
  return (lat != null && lon != null) ? { lat, lon } : null;
}

function buildPopupHTML(data) {
  const esc = (s) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,system-ui,sans-serif">
    ${data.image ? `<img src="${esc(data.image)}" alt="" style="width:100%;height:120px;object-fit:cover;border-radius:8px;margin-bottom:8px" />` : ''}
    <div style="font-weight:700;font-size:12px">${esc(data.title)}</div>
    <div style="margin-top:4px;color:#cbd5e1;font-size:11px;line-height:1.45">${esc(data.detail)}</div>
    <div style="margin-top:6px;font-size:10px;color:#67e8f9;text-transform:uppercase;letter-spacing:0.06em">${esc(data.level)}</div>
    <div style="margin-top:6px;font-size:10px;color:#93c5fd">Source: ${esc(data.source || 'Unknown')}</div>
    ${data.link ? `<a href="${esc(data.link)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin-top:8px;color:#60a5fa;font-size:11px;text-decoration:underline">${esc(data.linkLabel || 'Open source')} &#8594;</a>` : ''}
  </div>`;
}

function createMarker(maplibregl, map, markersArray, css, title, data, lon, lat, layerType, activePopupRef, content = '') {
  if (lon == null || lat == null || isNaN(lon) || isNaN(lat)) return;
  const el = document.createElement('div');
  el.style.cssText = css;
  if (content) el.textContent = content;
  if (title) el.title = title;
  if (layerType) el._layerType = layerType;
  const showPopup = () => {
    if (activePopupRef?.current) activePopupRef.current.remove();
    const popup = new maplibregl.Popup({ offset: 14, closeButton: true, maxWidth: '320px', className: 'epiphany-map-popup' })
      .setLngLat([lon, lat])
      .setHTML(buildPopupHTML(data))
      .addTo(map);
    activePopupRef.current = popup;
  };
  el.addEventListener('click', (e) => { e.stopPropagation(); showPopup(); });
  markersArray.push(
    new maplibregl.Marker({ element: el }).setLngLat([lon, lat]).addTo(map)
  );
}

function LiveMapBackdrop({ dark, mapLayers, onMapReady }) {
  const storedGeoRef = useRef(loadStoredGeo());
  const storedGeo = storedGeoRef.current;
  const initPos = useRef(storedGeo || DEFAULT_CENTER).current;
  const initZoom = useRef(storedGeo ? CACHE_DETAIL_ZOOM : 10.6).current;

  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const centerRef = useRef(initPos);
  const sawGeoGrantedRef = useRef(false);
  const pendingFlyRef = useRef(null);
  const darkRef = useRef(dark);
  const activePopupRef = useRef(null);
  const fetchCountRef = useRef(0);

  const [center, setCenter] = useState(initPos);
  const [userPosition, setUserPosition] = useState(storedGeo ? { lat: storedGeo.lat, lon: storedGeo.lon } : null);
  const [locLabel, setLocLabel] = useState('Locating\u2026');
  const [geoState, setGeoState] = useState('checking');
  const [isLocating, setIsLocating] = useState(false);
  const isLocatingRef = useRef(false);
  const [payload, setPayload] = useState({ incidents: [], trafficIncidents: [], earthquakes: [], events: [], markets: [], newsArticles: [], crimeIncidents: [], localEvents: [], weatherAlerts: [], wildfires: [], flights: [], aqiReadings: [], emergencyIncidents: [], noFlights: false });
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const autoRetriedRef = useRef(false);
  const visibilityHandlerRef = useRef(null);
  // Grayscale basemap is the permanent Gotham look — colored data markers ride
  // on top. No user toggle; the monochrome map is the brand identity.

  useEffect(() => { centerRef.current = center; }, [center]);

  useEffect(() => {
    try { sawGeoGrantedRef.current = localStorage.getItem('epiphany_geo_granted') === '1'; } catch { sawGeoGrantedRef.current = false; }
  }, []);

  // Only GPS fixes get persisted — IP-derived guesses are session-only.
  const persistGeo = useCallback((next, label) => {
    try { localStorage.setItem(LAST_GEO_KEY, JSON.stringify({ ...next, label, source: 'gps', ts: Date.now() })); } catch {}
  }, []);

  const doFlyTo = useCallback((params) => {
    if (mapInstanceRef.current) mapInstanceRef.current.flyTo(params);
    else pendingFlyRef.current = params;
  }, []);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoState('unsupported');
      setLocLabel('Geolocation unsupported');
      return undefined;
    }
    // Guard against overlapping requests (e.g. rapid clicks on the locate button).
    if (isLocatingRef.current) return undefined;
    isLocatingRef.current = true;
    setIsLocating(true);

    let resolved = false;
    const finish = () => {
      resolved = true;
      isLocatingRef.current = false;
      setIsLocating(false);
    };
    // Safety net: some browsers (notably WKWebView with enableHighAccuracy)
    // occasionally never invoke either getCurrentPosition callback, which
    // would otherwise leave the locate button permanently stuck/disabled.
    const watchdog = setTimeout(() => {
      if (resolved) return;
      finish();
      setLocLabel((l) => (l === 'Locating…' ? 'Location unavailable' : l));
    }, 10000);

    const bridgeTimer = storedGeo
      ? setTimeout(() => {
          if (resolved) return;
          const next = { lat: storedGeo.lat, lon: storedGeo.lon };
          setCenter(next);
          setUserPosition(next);
          setLocLabel(storedGeo.label || 'Recent location');
          setGeoState('cached');
          // Skip flyTo if map already initialized at storedGeo (no visible jump)
          const cur = centerRef.current;
          if (Math.abs(cur.lat - next.lat) > 0.001 || Math.abs(cur.lon - next.lon) > 0.001) {
            doFlyTo({ center: [next.lon, next.lat], zoom: CACHE_DETAIL_ZOOM, offset: [0, 120], duration: 700 });
          }
        }, 1500)
      : null;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(watchdog);
        if (bridgeTimer) clearTimeout(bridgeTimer);
        const next = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        setCenter(next);
        setUserPosition(next);
        // Skip flyTo if map already centered near this position (avoids jump on iOS)
        const cur = centerRef.current;
        if (Math.abs(cur.lat - next.lat) > 0.005 || Math.abs(cur.lon - next.lon) > 0.005) {
          doFlyTo({ center: [next.lon, next.lat], zoom: GEO_DETAIL_ZOOM, offset: [0, 120], duration: 850 });
        }
        setLocLabel('Current location');
        setGeoState('granted');
        persistGeo(next, 'Current location');
        try { localStorage.setItem('epiphany_geo_granted', '1'); sawGeoGrantedRef.current = true; } catch {}
        finish();
      },
      async (geoErr) => {
        clearTimeout(watchdog);
        if (bridgeTimer) clearTimeout(bridgeTimer);
        setGeoState(geoErr?.code === 1 ? 'denied' : 'unavailable');
        if (storedGeo) {
          setCenter({ lat: storedGeo.lat, lon: storedGeo.lon });
          setUserPosition({ lat: storedGeo.lat, lon: storedGeo.lon });
          setLocLabel(storedGeo.label || 'Last known location');
          doFlyTo({ center: [storedGeo.lon, storedGeo.lat], zoom: CACHE_DETAIL_ZOOM, offset: [0, 120], duration: 700 });
          finish();
          return;
        }
        try {
          const json = await fetch('https://ipapi.co/json/').then(r => r.json());
          const isJunk = (lat, lon) => Math.abs(lat - IP_GEO_JUNK.lat) < 0.01 && Math.abs(lon - IP_GEO_JUNK.lon) < 0.01;
          if (typeof json?.latitude === 'number' && typeof json?.longitude === 'number' && !isJunk(json.latitude, json.longitude)) {
            // IP geolocation is ISP-level (can be a town over). Center the map
            // and label it, but never treat it as the user's position and
            // never persist it — the locate button must not fly here.
            const next = { lat: json.latitude, lon: json.longitude };
            setCenter(next);
            doFlyTo({ center: [next.lon, next.lat], zoom: IP_FALLBACK_ZOOM, offset: [0, 120], duration: 850 });
            setLocLabel(json.city ? `${json.city} (IP approx)` : 'IP approx');
          } else {
            setCenter(DEFAULT_CENTER);
            setLocLabel('Location unavailable');
          }
        } catch {
          setCenter(DEFAULT_CENTER);
          setLocLabel('Location unavailable');
        } finally {
          finish();
        }
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
    return () => {
      clearTimeout(watchdog);
      if (bridgeTimer) clearTimeout(bridgeTimer);
      isLocatingRef.current = false;
    };
  }, [doFlyTo, persistGeo, storedGeo]);

  useEffect(() => requestLocation(), [requestLocation]);

  useEffect(() => {
    if (!navigator.permissions?.query) return;
    let statusRef = null;
    const onChange = () => {
      if (statusRef?.state !== 'granted') return;
      setGeoState('granted');
      requestLocation();
      if (!sawGeoGrantedRef.current) {
        try { localStorage.setItem('epiphany_geo_granted', '1'); } catch {}
        sawGeoGrantedRef.current = true;
      }
    };
    navigator.permissions.query({ name: 'geolocation' }).then((status) => {
      statusRef = status;
      setGeoState(status.state);
      if (typeof status.addEventListener === 'function') status.addEventListener('change', onChange);
      else status.onchange = onChange;
    }).catch(() => {});
    return () => {
      if (!statusRef) return;
      if (typeof statusRef.removeEventListener === 'function') statusRef.removeEventListener('change', onChange);
      else if (statusRef.onchange === onChange) statusRef.onchange = null;
    };
  }, [requestLocation]);

  useEffect(() => {
    setMapError(false);
    let map;
    (async () => {
      try {
        const maplibregl = (await import('maplibre-gl')).default;
        await import('maplibre-gl/dist/maplibre-gl.css');
        if (!mapRef.current || mapInstanceRef.current) return;
        maplibreRef.current = maplibregl;
        const initCenter = centerRef.current;
        map = new maplibregl.Map({
          container: mapRef.current,
          style: darkRef.current
            ? 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
            : 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
          center: [initCenter.lon, initCenter.lat],
          zoom: initZoom,
          interactive: true,
          attributionControl: false,
          pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
        });
        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-left');
        map.on('moveend', () => {
          const c = map.getCenter();
          setCenter((prev) => {
            if (Math.abs(prev.lat - c.lat) < 0.08 && Math.abs(prev.lon - c.lng) < 0.08) return prev;
            return { lat: c.lat, lon: c.lng };
          });
        });
        mapInstanceRef.current = map;
        setMapLoaded(true);
        if (onMapReady) onMapReady(map);
        map.on('load', () => {
          if (pendingFlyRef.current) {
            map.flyTo(pendingFlyRef.current);
            pendingFlyRef.current = null;
          }
        });
        // Mobile Safari/Chrome drop the WebGL context under memory pressure,
        // leaving a black canvas while the rest of the shell renders fine.
        const canvas = map.getCanvas();
        canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); });
        canvas.addEventListener('webglcontextrestored', () => { map.triggerRepaint(); });
        const onVisible = () => {
          if (document.visibilityState === 'visible' && mapInstanceRef.current) {
            mapInstanceRef.current.resize();
            mapInstanceRef.current.triggerRepaint();
          }
        };
        document.addEventListener('visibilitychange', onVisible);
        visibilityHandlerRef.current = onVisible;
        map.on('error', () => {
          // One automatic re-init before surfacing the retry overlay
          if (!autoRetriedRef.current) {
            autoRetriedRef.current = true;
            setRetryKey(k => k + 1);
          } else {
            setMapError(true);
          }
        });
      } catch (err) {
        console.warn('Backdrop map failed:', err.message);
        setMapError(true);
      }
    })();
    return () => {
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];
      if (visibilityHandlerRef.current) {
        document.removeEventListener('visibilitychange', visibilityHandlerRef.current);
        visibilityHandlerRef.current = null;
      }
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        setMapLoaded(false);
      }
    };
  }, [retryKey]);

  // Swap basemap style on theme change without destroying the map
  useEffect(() => {
    darkRef.current = dark;
    const map = mapInstanceRef.current;
    if (!map) return;
    const style = dark
      ? 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
      : 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';
    map.setStyle(style);
    // Re-add heatmap source/layer after style swap
    map.once('style.load', () => {
      fetchCountRef.current += 1;
      setMapLoaded((v) => !v);
      setMapLoaded(true);
    });
  }, [dark]);

  useEffect(() => {
    if (!containerRef.current || !mapInstanceRef.current) return;
    const observer = new ResizeObserver(() => {
      mapInstanceRef.current?.resize();
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [mapLoaded]);

  useEffect(() => {
    let cancelled = false;
    const fetchSituation = async () => {
      try {
        const bbox = { lamin: center.lat - 1, lomin: center.lon - 1, lamax: center.lat + 1, lomax: center.lon + 1 };
        const bboxQ = `lamin=${bbox.lamin}&lomin=${bbox.lomin}&lamax=${bbox.lamax}&lomax=${bbox.lomax}`;
        // Vercel functions cold-start; first hit can hang past short timeouts.
        // Retry once with a longer timeout, then return FAILED (null) so the
        // merge below keeps last-known-good data instead of blanking the layer.
        // A successful-but-empty response is distinct from FAILED and DOES clear.
        const FAILED = null;
        const safeFetch = async (url) => {
          for (let attempt = 0; attempt < 2; attempt++) {
            const ctrl = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), attempt === 0 ? 6000 : 12000);
            try {
              const r = await fetch(url, { signal: ctrl.signal });
              clearTimeout(timer);
              if (!r.ok) { console.warn(`[map] ${url} returned ${r.status}`); return FAILED; }
              return await r.json();
            } catch (err) {
              clearTimeout(timer);
              if (attempt === 1) {
                console.warn(`[map] ${url} failed after retry:`, err.message);
                return FAILED;
              }
              // backoff before retry
              await new Promise(res => setTimeout(res, 600));
            }
          }
          return FAILED;
        };
        const [inc, traffic, eq, ev, mk, news, crime, localEv, weather, fires, fl, aqi, emerg] = await Promise.all([
          safeFetch(apiPath(`/api/incidents?lat=${center.lat}&lon=${center.lon}&${bboxQ}`)),
          safeFetch(apiPath(`/api/traffic?lat=${center.lat}&lon=${center.lon}&${bboxQ}`)),
          safeFetch(apiPath(`/api/earthquakes?lat=${center.lat}&lon=${center.lon}&radius=500`)),
          safeFetch(apiPath(`/api/events?lat=${center.lat}&lon=${center.lon}`)),
          safeFetch(apiPath('/api/markets')),
          safeFetch(apiPath(`/api/news?lat=${center.lat}&lon=${center.lon}`)),
          safeFetch(apiPath(`/api/crime?lat=${center.lat}&lon=${center.lon}`)),
          safeFetch(apiPath(`/api/local-events?lat=${center.lat}&lon=${center.lon}`)),
          safeFetch(apiPath(`/api/weather-alerts?lat=${center.lat}&lon=${center.lon}`)),
          safeFetch(apiPath(`/api/wildfires?lat=${center.lat}&lon=${center.lon}`)),
          safeFetch(apiPath(`/api/flights?${bboxQ}`)),
          safeFetch(apiPath(`/api/aqi?lat=${center.lat}&lon=${center.lon}`)),
          safeFetch(apiPath(`/api/emergency?lat=${center.lat}&lon=${center.lon}&${bboxQ}`)),
        ]);
        if (!cancelled) {
          fetchCountRef.current += 1;
          // Merge: a failed endpoint (null) keeps the prior layer so markers
          // never blink out mid-poll. Only a real response replaces the layer.
          setPayload((prev) => {
            const merge = (resp, key, prevArr) => (resp == null ? prevArr : (resp[key] || []));
            return {
              incidents: merge(inc, 'incidents', prev.incidents),
              trafficIncidents: merge(traffic, 'incidents', prev.trafficIncidents),
              earthquakes: merge(eq, 'earthquakes', prev.earthquakes),
              events: merge(ev, 'events', prev.events),
              markets: mk == null ? prev.markets : (Array.isArray(mk) ? mk.slice(0, 60) : []),
              newsArticles: news == null ? prev.newsArticles : (Array.isArray(news?.articles) ? news.articles : []),
              crimeIncidents: merge(crime, 'incidents', prev.crimeIncidents),
              localEvents: merge(localEv, 'events', prev.localEvents),
              weatherAlerts: merge(weather, 'alerts', prev.weatherAlerts),
              wildfires: merge(fires, 'fires', prev.wildfires),
              flights: merge(fl, 'states', prev.flights),
              noFlights: fl == null ? prev.noFlights : (fl.noFlights === true),
              aqiReadings: merge(aqi, 'readings', prev.aqiReadings),
              emergencyIncidents: merge(emerg, 'incidents', prev.emergencyIncidents),
            };
          });
        }
      } catch {
        if (!cancelled) setPayload(emptyPayload());
      }
    };
    fetchSituation();
    const id = setInterval(fetchSituation, 120000);
    return () => { cancelled = true; clearInterval(id); };
  }, [center.lat, center.lon]);

  // User pin + local pulse -- render immediately on map load, no API dependency
  const userMarkersRef = useRef([]);
  const prevPayloadRef = useRef('');
  const maplibreRef = useRef(null);
  // Each entry: { marker, el, lat, lon, velocity (knots), heading (deg), anchorTs }
  const flightMarkersRef = useRef([]);

  // maplibreRef is set during map init effect above

  useEffect(() => {
    if (!mapInstanceRef.current || !maplibreRef.current) return;

    userMarkersRef.current.forEach(m => m.remove());
    userMarkersRef.current = [];

    const maplibregl = maplibreRef.current;
    const addUserMarker = (css, title, data, lon, lat) =>
      createMarker(maplibregl, mapInstanceRef.current, userMarkersRef.current, css, title, data, lon, lat, null, activePopupRef);

    if (userPosition) {
      addUserMarker(
        'width:10px;height:14px;background-image:url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 28 42\'><defs><radialGradient id=\'rg\' cx=\'40%25\' cy=\'35%25\' r=\'60%25\'><stop offset=\'0\' stop-color=\'%23ff6961\'/><stop offset=\'1\' stop-color=\'%23cc0000\'/></radialGradient><filter id=\'ds\'><feDropShadow dx=\'0\' dy=\'0.8\' stdDeviation=\'1\' flood-opacity=\'0.35\'/></filter></defs><ellipse cx=\'14\' cy=\'40\' rx=\'5\' ry=\'1.8\' fill=\'%23000\' opacity=\'.2\'/><line x1=\'14\' y1=\'22\' x2=\'14\' y2=\'39\' stroke=\'%23888\' stroke-width=\'2\' stroke-linecap=\'round\'/><circle cx=\'14\' cy=\'13\' r=\'12\' fill=\'url(%23rg)\' filter=\'url(%23ds)\'/><circle cx=\'11\' cy=\'10\' r=\'3.5\' fill=\'white\' opacity=\'.45\'/></svg>");background-size:contain;background-repeat:no-repeat;cursor:pointer;',
        'you',
        { type: 'location', title: 'You', detail: locLabel, level: 'local', source: geoState === 'granted' ? 'Browser Geolocation' : 'IP Geolocation', link: `https://www.google.com/maps/@${userPosition.lat},${userPosition.lon},15z` },
        userPosition.lon, userPosition.lat
      );

    }

    return () => { userMarkersRef.current.forEach(m => m.remove()); userMarkersRef.current = []; };
  }, [userPosition, locLabel, geoState, mapLoaded]);

  // Smart zoom-based decimation helper
  const decimateByZoom = useCallback((array, maxCount, zoom) => {
    if (!array || array.length === 0) return array;
    if (zoom >= 12) return array.slice(0, maxCount); // Full detail at high zoom
    if (zoom >= 10) return array.slice(0, Math.ceil(maxCount * 0.5)); // 50% at medium zoom
    return array.slice(0, Math.ceil(maxCount * 0.25)); // 25% at low zoom
  }, []);

  // API-dependent markers
  useEffect(() => {
    if (!mapInstanceRef.current || !maplibreRef.current) return;

    const currentZoom = mapInstanceRef.current?.getZoom?.() || 11;
    const payloadKey = JSON.stringify({
      i: payload.incidents.length,
      t: payload.trafficIncidents.length,
      e: payload.earthquakes.length,
      ev: payload.events.length,
      m: payload.markets.length,
      n: payload.newsArticles.length,
      cr: payload.crimeIncidents.length,
      le: payload.localEvents.length,
      wa: payload.weatherAlerts.length,
      wf: payload.wildfires.length,
      fl: payload.flights.length,
      em: payload.emergencyIncidents.length,
      c: `${center.lat.toFixed(3)},${center.lon.toFixed(3)}`,
      ml: Object.keys(mapLayers).filter(k => mapLayers[k] !== false).join(','),
    });

    if (prevPayloadRef.current === payloadKey) return;
    prevPayloadRef.current = payloadKey;

    const maplibregl = maplibreRef.current;
    // Add-then-remove: build the new marker set first, drop the old set only
    // after the new one is on the map, so there is never an empty frame.
    const staleMarkers = markersRef.current;
    const staleFlights = flightMarkersRef.current;
    markersRef.current = [];
    flightMarkersRef.current = [];

    const addMarker = (css, title, data, lon, lat, layerType, content = '') =>
      createMarker(maplibregl, mapInstanceRef.current, markersRef.current, css, title, data, lon, lat, layerType, activePopupRef, content);

    if (mapLayers.incidents !== false)
    decimateByZoom(payload.incidents, 80, currentZoom).forEach((inc) => {
      if (inc.lon == null || inc.lat == null) return;
      const t = inc.type || 'incident';
      const cat = inc.category || 'infrastructure';
      const isConstruction = cat === 'construction';
      const isPolice = t === 'police';
      const isHospital = t === 'hospital';
      const isFire = t === 'fire_station' || t === 'ambulance_station' || t === 'ses_station';
      const isBarrier = t === 'toll_booth' || t === 'border_control';
      const isAirport = t === 'airport' || cat === 'airport';
      const isTransit = t === 'train_station' || t === 'bus_station' || cat === 'transit';
      const isMuseum = t === 'museum' || cat === 'cultural';
      const isInfra = !isConstruction;
      const css = isConstruction
        ? 'width:44px;height:6px;border-radius:999px;background:repeating-linear-gradient(90deg,#f59e0b 0 7px,#fbbf24 7px 14px);border:1px solid rgba(0,0,0,0.22);transform:rotate(-22deg);animation:pulse-amber 1.8s infinite;'
        : isPolice
        ? `width:${isInfra ? 8 : 12}px;height:${isInfra ? 8 : 12}px;border-radius:50%;background:#3b82f6;border:2px solid rgba(255,255,255,${isInfra ? 0.3 : 0.6});opacity:${isInfra ? 0.6 : 1};`
        : isHospital
        ? `width:${isInfra ? 10 : 14}px;height:${isInfra ? 10 : 14}px;border-radius:3px;background:#ef4444;border:2px solid rgba(255,255,255,${isInfra ? 0.3 : 0.6});opacity:${isInfra ? 0.6 : 1};`
        : isFire
        ? `width:${isInfra ? 8 : 12}px;height:${isInfra ? 8 : 12}px;border-radius:50%;background:#f97316;border:2px solid rgba(255,255,255,${isInfra ? 0.3 : 0.6});opacity:${isInfra ? 0.6 : 1};`
        : isBarrier
        ? 'width:10px;height:10px;border-radius:2px;background:#6b7280;border:2px solid rgba(255,255,255,0.5);'
        : isAirport
        ? 'width:22px;height:22px;background:transparent;font-size:16px;line-height:22px;text-align:center;display:flex;align-items:center;justify-content:center;'
        : isTransit
        ? 'width:10px;height:10px;border-radius:2px;background:#818cf8;border:2px solid rgba(255,255,255,0.5);'
        : isMuseum
        ? 'width:10px;height:10px;border-radius:50%;background:#a78bfa;border:2px solid rgba(255,255,255,0.5);'
        : 'width:10px;height:10px;border-radius:50%;background:#f59e0b;border:2px solid rgba(255,255,255,0.5);animation:pulse-amber 1.8s infinite;';
      const label = inc.title || (isPolice ? 'POLICE' : isHospital ? 'HOSPITAL' : isFire ? 'FIRE/EMS' : isBarrier ? 'CHECKPOINT' : isAirport ? 'AIRPORT' : isTransit ? 'TRANSIT' : t.toUpperCase());
      addMarker(
        css,
        inc.description || inc.title || t,
        { type: t, title: label, detail: inc.description || label, level: cat === 'construction' ? 'active' : 'infrastructure', source: 'OpenStreetMap / Overpass', link: mapsLink(inc.lat, inc.lon), linkLabel: 'Get Directions' },
        inc.lon, inc.lat, 'incidents',
        isAirport ? '✈' : ''
      );
    });

    if (mapLayers.traffic !== false)
    decimateByZoom(payload.trafficIncidents, 60, currentZoom).forEach((inc) => {
      const p = inc.position;
      if (!p || p.lon == null || p.lat == null) return;
      addMarker(
        `width:48px;height:6px;border-radius:999px;background:${trafficColor(inc)};border:1px solid rgba(0,0,0,0.2);transform:rotate(18deg);animation:pulse-amber 1.6s infinite;`,
        inc.description || inc.type || 'traffic incident',
        { type: 'traffic', title: (inc.type || 'traffic').toUpperCase(), detail: inc.description || 'Traffic incident', level: 'local', source: 'Traffic feed / fallback model', link: mapsLink(p.lat, p.lon), linkLabel: 'Get Directions' },
        p.lon, p.lat, 'traffic'
      );
    });

    if (mapLayers.earthquakes !== false)
    decimateByZoom(payload.earthquakes, 120, currentZoom).forEach((eq) => {
      if (eq.lon == null || eq.lat == null) return;
      const size = Math.max(10, Math.min(18, (eq.mag || 0) * 2.4));
      addMarker(
        `width:${size}px;height:${size}px;border-radius:50%;background:rgba(239,68,68,0.78);animation:pulse-red 1.9s infinite;`,
        `M${eq.mag} ${eq.place || ''}`,
        { type: 'seismic', title: `M${eq.mag?.toFixed?.(1) ?? eq.mag}`, detail: eq.place || 'Earthquake', level: (eq.mag || 0) >= 6 ? 'high' : (eq.mag || 0) >= 4 ? 'elevated' : 'monitor', source: 'USGS Earthquake Catalog', link: eq.url || 'https://earthquake.usgs.gov/earthquakes/map/' },
        eq.lon, eq.lat, 'earthquakes'
      );
    });

    if (mapLayers.news !== false)
    decimateByZoom(payload.events, 120, currentZoom).forEach((ev) => {
      // Use server-provided country centroid first, fall back to title keyword match
      let coords = (typeof ev.lat === 'number' && typeof ev.lon === 'number')
        ? { lat: ev.lat, lon: ev.lon, label: ev.country || 'Global' }
        : geoKeywordMatch(ev.title);
      if (!coords) return;
      addMarker(
        'width:14px;height:14px;border-radius:50%;background:#22D3EE;animation:pulse-cyan 2.2s infinite;',
        `${coords.label}: ${ev.title}`,
        { type: 'event', title: ev.country ? `[${ev.country}] ${coords.label}` : coords.label, detail: ev.title, level: 'global', source: 'GDELT / News feed', link: ev.url || 'https://www.gdeltproject.org/' },
        coords.lon, coords.lat, 'news'
      );
    });

    if (mapLayers.news !== false)
    decimateByZoom(payload.newsArticles, 120, currentZoom).forEach((article) => {
      let target = geoKeywordMatch(article.title);
      if (!target && typeof article.lat === 'number' && typeof article.lon === 'number') {
        const dist = Math.abs(article.lat - center.lat) + Math.abs(article.lon - center.lon);
        if (dist < 3) target = { lat: article.lat, lon: article.lon, label: article.source || 'News' };
      }
      if (!target) return; // Only show news with real coordinates
      const pubTime = article.publishedAt ? new Date(article.publishedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
      const detail = [article.source, pubTime].filter(Boolean).join(' · ');
      addMarker(
        'width:14px;height:14px;border-radius:50%;background:#60A5FA;animation:pulse-blue 2.1s infinite;',
        article.title,
        { type: 'news', title: article.title || 'News', detail: detail || 'News article', level: 'global', source: 'GDELT News', link: article.url || 'https://www.gdeltproject.org/' },
        target.lon, target.lat, 'news'
      );
    });

    // Crime incidents
    if (mapLayers.crime !== false)
    decimateByZoom(payload.crimeIncidents, 80, currentZoom).forEach((crime, i) => {
      const c = extractCoords(crime);
      if (!c) return;
      const { lat, lon } = c;
      addMarker(
        'width:10px;height:10px;border-radius:50%;background:#ef4444;animation:pulse-red 2s infinite;',
        crime.title || 'Crime',
        { type: 'crime', title: crime.title || 'Crime incident', detail: `${crime.category || 'Unknown'} -- ${crime.source || 'News'}${crime.timestamp ? ` -- ${new Date(crime.timestamp).toLocaleDateString()}` : ''}`, level: crime.severity || 'low', source: crime.source || 'Crime data', link: mapsLink(lat, lon), linkLabel: 'Get Directions' },
        lon, lat, 'crime'
      );
    });

    // Local events
    if (mapLayers.localEvents !== false)
    decimateByZoom(payload.localEvents, 80, currentZoom).forEach((ev, i) => {
      const c = extractCoords(ev);
      if (!c) return;
      const { lat, lon } = c;
      addMarker(
        'width:14px;height:14px;border-radius:50%;background:#a855f7;animation:pulse-cyan 2.2s infinite;',
        ev.title || (ev.kind === 'place' ? 'Place' : 'Event'),
        { type: 'local-event', title: ev.title || (ev.kind === 'place' ? 'Place' : 'Event'), detail: ev.description || ev.venue || ev.source || (ev.kind === 'place' ? 'Nearby place' : 'Nearby event'), level: ev.kind === 'place' ? 'place' : 'event', source: ev.source || 'Map data', link: ev.url || mapsLink(lat, lon), linkLabel: ev.url ? 'Open source' : 'Get Directions', image: ev.image || null },
        lon, lat, 'localEvents'
      );
    });

    // Emergency services (fire stations, hospitals, ambulances) — data from incidents.js Overpass
    if (mapLayers.incidents !== false)
    decimateByZoom(payload.emergencyIncidents, 120, currentZoom).forEach((inc) => {
      const lat = inc.lat ?? inc.position?.lat;
      const lon = inc.lon ?? inc.position?.lon;
      if (lat == null || lon == null) return;
      const icon = inc.type === 'hospital' ? '🏥' : inc.type === 'fire_station' || inc.type === 'ambulance_station' ? '🚒' : '🚨';
      const el = document.createElement('div');
      el.style.cssText = 'width:18px;height:18px;font-size:14px;line-height:18px;text-align:center;cursor:pointer;';
      el.textContent = icon;
      el.title = inc.name || inc.type || 'Emergency service';
      el._layerType = 'incidents';
      const popup = new maplibreRef.current.Popup({ offset: 10, closeButton: false, maxWidth: '200px', className: 'epiphany-map-popup' })
        .setHTML(`<b>${inc.name || inc.type}</b><br><span style="opacity:0.6;font-size:11px">${inc.address || ''}</span>`);
      new maplibreRef.current.Marker({ element: el }).setLngLat([lon, lat]).setPopup(popup).addTo(mapInstanceRef.current);
      markersRef.current.push({ remove: () => el.remove() });
    });

    // Weather alerts
    if (mapLayers.weather !== false)
    decimateByZoom(payload.weatherAlerts, 80, currentZoom).forEach((wa, i) => {
      const lat = wa.lat;
      const lon = wa.lon;
      if (lat == null || lon == null) return;
      addMarker(
        'width:12px;height:12px;border-radius:50%;background:#f59e0b;animation:pulse-amber 1.8s infinite;',
        wa.event || 'Weather Alert',
        { type: 'weather', title: wa.event || 'Weather Alert', detail: wa.headline || wa.event, level: wa.severity || 'Moderate', source: wa.source || 'Weather service', link: mapsLink(lat, lon), linkLabel: 'Get Directions' },
        lon, lat, 'weather'
      );
    });

    // Wildfires
    if (mapLayers.wildfires !== false)
    decimateByZoom(payload.wildfires, 80, currentZoom).forEach((fire, i) => {
      if (fire.lat == null || fire.lon == null) return;
      addMarker(
        'width:10px;height:10px;border-radius:50%;background:#f97316;animation:pulse-amber 1.6s infinite;',
        'Wildfire',
        { type: 'wildfire', title: 'Active Fire', detail: `Confidence: ${fire.confidence || 'Unknown'} -- ${fire.date || 'Recent'}`, level: 'elevated', source: 'NASA FIRMS', link: mapsLink(fire.lat, fire.lon), linkLabel: 'Get Directions' },
        fire.lon, fire.lat, 'wildfires'
      );
    });

    // Flights — markers stored in flightMarkersRef for dead-reckoning animation
    if (mapLayers.flights !== false && Array.isArray(payload.flights)) {
      payload.flights.slice(0, 120).forEach((fl) => {
        if (fl.lat == null || fl.lon == null) return;
        const cs = (fl.callsign || '').trim();
        const trackLink = cs ? `https://www.flightaware.com/live/flight/${cs}` : null;
        const el = document.createElement('div');
        el.style.cssText = `width:20px;height:20px;background:transparent;font-size:16px;line-height:20px;text-align:center;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:transform 0.05s linear;`;
        el.textContent = '✈';
        el._layerType = 'flights';
        if (fl.heading != null) el.style.transform = `rotate(${fl.heading}deg)`;
        const hoverTitle = `${cs || fl.icao24 || 'Aircraft'} | ${fl.altitude ? fl.altitude + 'ft' : '?ft'} | ${fl.velocity || '?'}kts | Hdg: ${fl.heading || '?'}°`;
        el.title = hoverTitle;
        const aircraftDetail = [fl.aircraftType, fl.registration].filter(Boolean).join(' · ');
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          if (activePopupRef?.current) activePopupRef.current.remove();
          const popup = new maplibreRef.current.Popup({ offset: 14, closeButton: true, maxWidth: '320px', className: 'epiphany-map-popup' })
            .setLngLat([fl.lon, fl.lat])
            .setHTML(buildPopupHTML({ type: 'flight', title: cs || fl.icao24 || 'Aircraft', detail: `${aircraftDetail ? aircraftDetail + ' | ' : ''}Alt: ${fl.altitude || '?'}ft | ${fl.velocity || '?'}kts | Hdg: ${fl.heading || '?'}°`, level: 'monitor', source: 'OpenSky Network', link: trackLink }))
            .addTo(mapInstanceRef.current);
          activePopupRef.current = popup;
        });
        const mapMarker = new maplibreRef.current.Marker({ element: el }).setLngLat([fl.lon, fl.lat]).addTo(mapInstanceRef.current);
        markersRef.current.push(mapMarker);
        flightMarkersRef.current.push({
          marker: mapMarker,
          el,
          lat: fl.lat,
          lon: fl.lon,
          velocity: fl.velocity || 0,   // knots
          heading: fl.heading || 0,      // degrees
          anchorTs: Date.now(),
        });
      });
    }

    // Emergency services (Waze + city CAD: police, fire, EMS, accidents)
    if (mapLayers.incidents !== false)
    decimateByZoom(payload.emergencyIncidents, 120, currentZoom).forEach((ev) => {
      if (ev.lat == null || ev.lng == null) return;
      const cat = ev.category || 'alert';
      const icon = cat === 'police' ? '🚔' : cat === 'fire' ? '🚒' : cat === 'ems' ? '🚑' : cat === 'accident' ? '💥' : cat === 'hazard' ? '⚠️' : cat === 'road_closed' ? '🚫' : '🚨';
      const color = cat === 'police' ? '#3b82f6' : cat === 'fire' ? '#ef4444' : cat === 'ems' ? '#f97316' : cat === 'accident' ? '#f59e0b' : '#94a3b8';
      addMarker(
        `width:20px;height:20px;background:transparent;font-size:14px;line-height:20px;text-align:center;display:flex;align-items:center;justify-content:center;filter:drop-shadow(0 0 3px ${color}88);`,
        ev.title,
        { type: 'emergency', title: ev.title, detail: `Source: ${ev.source || 'Live feed'} | ${ev.timestamp ? new Date(ev.timestamp).toLocaleTimeString() : ''}`, level: ev.severity || 'medium', source: ev.source || 'Emergency feed', link: null },
        ev.lng, ev.lat, 'incidents', icon
      );
    });

    // AQI readings
    if (mapLayers.aqi !== false)
    decimateByZoom(payload.aqiReadings, 40, currentZoom).forEach((reading) => {
      if (reading.lat == null || reading.lon == null) return;
      const aqi = reading.aqi || reading.value || 0;
      const aqiColor = aqi <= 50 ? '#22c55e' : aqi <= 100 ? '#eab308' : aqi <= 150 ? '#f97316' : '#ef4444';
      const aqiLevel = aqi <= 50 ? 'good' : aqi <= 100 ? 'moderate' : aqi <= 150 ? 'unhealthy (sensitive)' : 'unhealthy';
      const size = 28;
      addMarker(
        `width:${size}px;height:${size}px;border-radius:50%;background:${aqiColor}22;border:2px solid ${aqiColor};display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:${aqiColor};font-family:-apple-system,sans-serif;`,
        `AQI ${aqi} - ${reading.city || 'Station'}`,
        { type: 'aqi', title: `AQI ${aqi}`, detail: `${reading.parameter || 'PM2.5'}: ${reading.value || aqi} ${reading.unit || 'µg/m³'} — ${reading.city || 'Air Quality Station'}`, level: aqiLevel, source: 'OpenAQ', link: `https://openaq.org/#/location/${reading.id || ''}` },
        reading.lon, reading.lat, 'aqi', `${Math.round(aqi)}`
      );
    });

    if (mapLayers.predictions !== false)
    payload.markets.slice(0, 60).forEach((m) => {
      const p = geoKeywordMatch(m.question);
      if (!p) return; // Only show predictions with a real geographic match
      const isJunkGeo = (lat, lon) => Math.abs(lat - IP_GEO_JUNK.lat) < 0.01 && Math.abs(lon - IP_GEO_JUNK.lon) < 0.01;
      if (isJunkGeo(p.lat, p.lon)) return; // Skip NYC-ish placeholder locations
      // Filter: only show if matched city is within ~2 degrees of map center (viewport)
      const cityDist = Math.abs(p.lat - center.lat) + Math.abs(p.lon - center.lon);
      if (cityDist > 4) return;
      const prob = typeof m.probability === 'number' ? m.probability : 0.5;
      const conf = Math.max(prob, 1 - prob);
      const size = conf > 0.9 ? 12 : conf > 0.75 ? 10 : 8;
      addMarker(
        `width:${size}px;height:${size}px;border-radius:50%;background:${prob >= 0.5 ? '#22C55E' : '#F43F5E'};animation:pulse-cyan 2.4s infinite;`,
        `${Math.round(prob * 100)}% · ${m.question || 'market'}`,
        { type: 'prediction', title: `${Math.round(prob * 100)}% ${prob >= 0.5 ? 'YES' : 'NO'}`, detail: m.question || 'Prediction market', level: p.label, source: 'Polymarket', link: `https://polymarket.com/event/${m.eventSlug || m.slug}` },
        p.lon, p.lat, 'predictions'
      );
    });

    // New set is fully rendered — now retire the previous markers (no flash).
    staleMarkers.forEach(m => m.remove());
    staleFlights.forEach(m => m.marker.remove());
  }, [center.lat, center.lon, payload, mapLoaded, mapLayers]);

  // Dead-reckoning animation — moves flight markers between 60s polls
  // 1 knot ≈ 0.000008467 degrees lat/sec (= 1.852 km/hr / 111.32 km/deg / 3600 sec)
  // Lon correction: divide by cos(lat) to account for meridian convergence
  useEffect(() => {
    let rafId;
    let lastTs = performance.now();

    const tick = (now) => {
      const elapsed = (now - lastTs) / 1000; // seconds
      lastTs = now;

      for (const entry of flightMarkersRef.current) {
        if (entry.velocity <= 0) continue;
        const headingRad = (entry.heading * Math.PI) / 180;
        const knotsToDegreesPerSec = 0.000008467;
        const speedDegSec = entry.velocity * knotsToDegreesPerSec;
        const latCos = Math.cos((entry.lat * Math.PI) / 180);
        entry.lat += speedDegSec * Math.cos(headingRad) * elapsed;
        entry.lon += speedDegSec * Math.sin(headingRad) * elapsed / (latCos || 1);
        entry.marker.setLngLat([entry.lon, entry.lat]);
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  // Heatmap layer -- density visualization of all events/incidents
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapLoaded) return;

    const features = [];
    const addPoint = (lat, lon, weight = 1) => {
      if (lat == null || lon == null) return;
      features.push({ type: 'Feature', properties: { weight }, geometry: { type: 'Point', coordinates: [lon, lat] } });
    };

    payload.incidents.forEach(i => addPoint(i.lat, i.lon, 0.6));
    payload.trafficIncidents.forEach(i => addPoint(i.position?.lat, i.position?.lon, 0.5));
    payload.earthquakes.forEach(e => addPoint(e.lat, e.lon, Math.min((e.mag || 1) / 5, 1)));
    payload.events.forEach(ev => {
      const kw = geoKeywordMatch(ev.title);
      if (kw) addPoint(kw.lat, kw.lon, 0.4);
    });
    payload.newsArticles.forEach(a => {
      if (a.lat != null) addPoint(a.lat, a.lon, 0.3);
      else { const kw = geoKeywordMatch(a.title); if (kw) addPoint(kw.lat, kw.lon, 0.3); }
    });
    payload.crimeIncidents.forEach(c => { const p = extractCoords(c); if (p) addPoint(p.lat, p.lon, 0.7); });
    payload.localEvents.forEach(e => { const p = extractCoords(e); if (p) addPoint(p.lat, p.lon, 0.4); });
    payload.weatherAlerts.forEach(w => addPoint(w.lat, w.lon, 0.8));
    payload.wildfires.forEach(f => addPoint(f.lat, f.lon, 0.9));
    payload.flights.forEach(f => addPoint(f.lat, f.lon, 0.2));
    payload.emergencyIncidents.forEach(e => addPoint(e.lat, e.lng, 0.8));
    payload.aqiReadings.forEach(r => {
      const aqi = r.aqi || r.value || 0;
      addPoint(r.lat, r.lon, Math.min(aqi / 150, 1));
    });

    const geojson = { type: 'FeatureCollection', features };

    try {
      if (map.getSource('heatmap-source')) {
        map.getSource('heatmap-source').setData(geojson);
      } else {
        map.addSource('heatmap-source', { type: 'geojson', data: geojson });
        map.addLayer({
          id: 'heatmap-layer',
          type: 'heatmap',
          source: 'heatmap-source',
          paint: {
            'heatmap-weight': ['get', 'weight'],
            'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 1, 10, 2, 14, 4],
            'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 16, 8, 40, 12, 80, 15, 120],
            'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 10, 0.8, 15, 0.5],
            'heatmap-color': [
              'interpolate', ['linear'], ['heatmap-density'],
              0,    'rgba(0,0,0,0)',
              0.08, 'rgba(34,211,238,0.12)',
              0.2,  'rgba(34,211,238,0.28)',
              0.35, 'rgba(59,130,246,0.42)',
              0.5,  'rgba(99,102,241,0.55)',
              0.65, 'rgba(245,158,11,0.65)',
              0.8,  'rgba(239,68,68,0.75)',
              0.92, 'rgba(220,38,38,0.85)',
              1,    'rgba(185,28,28,0.95)',
            ],
          },
        });
      }
    } catch {}

    return undefined;
  }, [payload, mapLoaded]);

  // Toggle heatmap visibility
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    try {
      if (map.getLayer('heatmap-layer')) {
        map.setLayoutProperty('heatmap-layer', 'visibility', mapLayers?.heatmap ? 'visible' : 'none');
      }
    } catch {}
  }, [mapLayers?.heatmap]);

  // Toggle marker visibility when layers change (no teardown/recreate)
  useEffect(() => {
    for (const marker of markersRef.current) {
      const el = marker.getElement();
      const type = el?._layerType;
      if (!type) continue;
      el.style.display = mapLayers?.[type] === false ? 'none' : '';
    }
  }, [mapLayers]);

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', height: '100%' }}>
      <style>{`
        @keyframes pulse-blue { 0%{opacity:1} 50%{opacity:0.45} 100%{opacity:1} }
        @keyframes pulse-amber { 0%{opacity:1} 50%{opacity:0.45} 100%{opacity:1} }
        @keyframes pulse-red { 0%{opacity:1} 50%{opacity:0.45} 100%{opacity:1} }
        @keyframes pulse-cyan { 0%{opacity:1} 50%{opacity:0.45} 100%{opacity:1} }
        .epiphany-map-popup .maplibregl-popup-content { background:rgba(2,6,23,0.92); color:#fff; border:1px solid rgba(255,255,255,0.24); border-radius:12px; padding:10px 12px; }
        .epiphany-map-popup .maplibregl-popup-tip { border-top-color:rgba(2,6,23,0.92); }
        .epiphany-map-popup .maplibregl-popup-close-button { color:#94a3b8; font-size:16px; padding:2px 6px; }
      `}</style>
      <div
        ref={mapRef}
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'auto', filter: 'grayscale(1)' }}
      />
      <button
        onClick={() => {
          if (isLocating) return;
          // If we already have a fix, jump there immediately for instant
          // feedback, then kick off a fresh lookup in the background to
          // re-sync in case the user has moved.
          if (geoState === 'granted' && userPosition) {
            mapInstanceRef.current?.flyTo({ center: [userPosition.lon, userPosition.lat], zoom: GEO_DETAIL_ZOOM, offset: [0, 120], duration: 900 });
          } else {
            setLocLabel('Locating…');
          }
          requestLocation();
        }}
        disabled={isLocating}
        aria-label="Recenter to my location"
        title="Recenter to my location"
        style={{ position: 'absolute', right: 14, top: 14, zIndex: 2, width: 34, height: 34, border: '1px solid rgba(255,255,255,0.24)', borderRadius: 9999, background: 'rgba(2,6,23,0.82)', color: '#ff5a52', font: '700 15px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: isLocating ? 'wait' : 'pointer', opacity: isLocating ? 0.55 : 1, animation: isLocating ? 'pulse-red 0.9s ease-in-out infinite' : 'none' }}
      >
        ⌖
      </button>
      {mapLayers.flights !== false && payload.noFlights && (
        <div style={{ position: 'absolute', top: 60, left: '50%', transform: 'translateX(-50%)', zIndex: 3, pointerEvents: 'none' }}>
          <div style={{ background: 'rgba(2,6,23,0.72)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 8, padding: '5px 12px', color: '#94a3b8', fontSize: 11, fontFamily: '-apple-system,BlinkMacSystemFont,system-ui,sans-serif', whiteSpace: 'nowrap', letterSpacing: '0.04em' }}>
            No flights overhead
          </div>
        </div>
      )}

      {mapError && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(2,6,23,0.82)', backdropFilter: 'blur(8px)' }}>
          <div style={{ textAlign: 'center', color: '#fff', fontFamily: '-apple-system,BlinkMacSystemFont,system-ui,sans-serif' }}>
            <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 12 }}>Map failed to load</div>
            <button
              onClick={() => { setMapError(false); setRetryKey(k => k + 1); }}
              style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.08)', color: '#fff', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
            >Retry</button>
          </div>
        </div>
      )}

    </div>
  );
}

export default memo(LiveMapBackdrop);
