import { useCallback, useEffect, useRef, useState } from 'react';

const DEFAULT_CENTER = { lat: 40.7128, lon: -74.0060 };
const LAST_GEO_KEY = 'opticon_last_geo';
const GEO_DETAIL_ZOOM = 13.6;
const CACHE_DETAIL_ZOOM = 13.2;
const IP_FALLBACK_ZOOM = 11.5;
const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? 'https://opticon-production.vercel.app' : '');

const apiPath = (path) => `${API_BASE}${path}`;

function loadStoredGeo() {
  try {
    const raw = localStorage.getItem(LAST_GEO_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.lat !== 'number' || typeof parsed?.lon !== 'number') return null;
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

function nearestHub(lat, lon) {
  return CITY_HUBS.reduce((best, hub) => {
    const d = (hub.lat - lat) ** 2 + (hub.lon - lon) ** 2;
    const bd = (best.lat - lat) ** 2 + (best.lon - lon) ** 2;
    return d < bd ? hub : best;
  }, CITY_HUBS[0]);
}

function geoKeywordMatch(text) {
  for (const k of GEO_KEYWORDS) {
    if (k.re.test(text || '')) return { lat: k.lat, lon: k.lon, label: k.label };
  }
  return null;
}

function fallbackPayload(baseCenter) {
  const hub = nearestHub(baseCenter.lat, baseCenter.lon);
  return {
    incidents: [{ type: 'estimated-construction', lat: hub.lat, lon: hub.lon, description: `Road works advisory near ${hub.label} (fallback)` }],
    trafficIncidents: [{ type: 'ESTIMATED', description: `Traffic slowdown estimate near ${hub.label}`, position: { lat: hub.lat + 0.01, lon: hub.lon - 0.01 } }],
    earthquakes: [],
    events: [
      { title: `Local event pulse near ${hub.label}`, country: 'LOCAL', url: null },
      { title: 'Transit disruption advisory', country: 'LOCAL', url: null },
    ],
    markets: [],
  };
}

function trafficColor(incident) {
  const text = `${incident?.type || ''} ${incident?.description || ''}`.toLowerCase();
  if (text.includes('heavy') || text.includes('accident') || text.includes('closure')) return '#ef4444';
  if (text.includes('moderate') || text.includes('slow') || text.includes('delay')) return '#f59e0b';
  return '#22c55e';
}

function mapsLink(lat, lon, zoom = 14) {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=${zoom}/${lat}/${lon}`;
}

function hasSource(data) {
  return Boolean(data?.source?.trim() && /^https?:\/\//.test(data?.link));
}

function createMarker(maplibregl, map, markersArray, css, title, data, lon, lat, onSelect) {
  if (!hasSource(data)) return;
  const el = document.createElement('div');
  el.style.cssText = css;
  if (title) el.title = title;
  el.addEventListener('mouseenter', () => onSelect(data));
  el.addEventListener('click', (e) => { e.stopPropagation(); onSelect(data); });
  markersArray.push(
    new maplibregl.Marker({ element: el }).setLngLat([lon, lat]).addTo(map)
  );
}

export default function LiveMapBackdrop({ dark, mapLayers, onMapReady, livePrices }) {
  const storedGeo = loadStoredGeo();
  const initPos = storedGeo ? { lat: storedGeo.lat, lon: storedGeo.lon } : DEFAULT_CENTER;

  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const centerRef = useRef(initPos);
  const sawGeoGrantedRef = useRef(false);
  const pendingFlyRef = useRef(null);

  const [center, setCenter] = useState(initPos);
  const [userPosition, setUserPosition] = useState(initPos);
  const [locLabel, setLocLabel] = useState(storedGeo?.label || 'Locating…');
  const [geoState, setGeoState] = useState(storedGeo ? 'cached' : 'checking');
  const [payload, setPayload] = useState({ incidents: [], trafficIncidents: [], earthquakes: [], events: [], markets: [], newsArticles: [] });
  const [selected, setSelected] = useState(null);

  useEffect(() => { centerRef.current = center; }, [center]);

  useEffect(() => {
    try { sawGeoGrantedRef.current = localStorage.getItem('opticon_geo_granted') === '1'; } catch { sawGeoGrantedRef.current = false; }
  }, []);

  const persistGeo = useCallback((next, label) => {
    try { localStorage.setItem(LAST_GEO_KEY, JSON.stringify({ ...next, label, ts: Date.now() })); } catch {}
  }, []);

  const doFlyTo = useCallback((params) => {
    if (mapInstanceRef.current) mapInstanceRef.current.flyTo(params);
    else pendingFlyRef.current = params;
  }, []);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoState('unsupported');
      setLocLabel('Geolocation unsupported');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        setCenter(next);
        setUserPosition(next);
        doFlyTo({ center: [next.lon, next.lat], zoom: GEO_DETAIL_ZOOM, offset: [0, 120], duration: 850 });
        setLocLabel('Current location');
        setGeoState('granted');
        persistGeo(next, 'Current location');
        try { localStorage.setItem('opticon_geo_granted', '1'); sawGeoGrantedRef.current = true; } catch {}
      },
      async (geoErr) => {
        setGeoState(geoErr?.code === 1 ? 'denied' : 'unavailable');
        try {
          const json = await fetch('https://ipapi.co/json/').then(r => r.json());
          if (typeof json?.latitude === 'number' && typeof json?.longitude === 'number') {
            const next = { lat: json.latitude, lon: json.longitude };
            setCenter(next);
            if (geoErr?.code !== 1) setUserPosition(next);
            doFlyTo({ center: [next.lon, next.lat], zoom: IP_FALLBACK_ZOOM, offset: [0, 120], duration: 850 });
            const label = json.city ? `${json.city} (IP)` : 'IP fallback';
            setLocLabel(label);
            persistGeo(next, label);
          } else {
            setLocLabel('Location unavailable');
          }
        } catch {
          setLocLabel('Location unavailable');
        }
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 }
    );
  }, [doFlyTo, persistGeo]);

  useEffect(() => { requestLocation(); }, [requestLocation]);

  useEffect(() => {
    if (!navigator.permissions?.query) return;
    let statusRef = null;
    const onChange = () => {
      if (statusRef?.state !== 'granted') return;
      setGeoState('granted');
      requestLocation();
      if (!sawGeoGrantedRef.current) {
        try { localStorage.setItem('opticon_geo_granted', '1'); } catch {}
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
    let map;
    (async () => {
      try {
        const maplibregl = (await import('maplibre-gl')).default;
        await import('maplibre-gl/dist/maplibre-gl.css');
        if (!mapRef.current || mapInstanceRef.current) return;
        const initCenter = centerRef.current;
        map = new maplibregl.Map({
          container: mapRef.current,
          style: dark
            ? 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
            : 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
          center: [initCenter.lon, initCenter.lat],
          zoom: storedGeo ? CACHE_DETAIL_ZOOM : 10.6,
          interactive: true,
          attributionControl: false,
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
        if (onMapReady) onMapReady(map);
        map.on('load', () => {
          if (pendingFlyRef.current) {
            map.flyTo(pendingFlyRef.current);
            pendingFlyRef.current = null;
          }
        });
      } catch (err) {
        console.warn('Backdrop map failed:', err.message);
      }
    })();
    return () => {
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [dark]);

  useEffect(() => {
    if (!containerRef.current || !mapInstanceRef.current) return;
    const observer = new ResizeObserver(() => {
      mapInstanceRef.current?.resize();
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [dark]);

  useEffect(() => {
    let cancelled = false;
    const fetchSituation = async () => {
      try {
        const [inc, traffic, eq, ev, mk, news] = await Promise.all([
          fetch(apiPath(`/api/incidents?lat=${center.lat}&lon=${center.lon}`)).then(r => r.json()).catch(() => ({ incidents: [] })),
          fetch(apiPath(`/api/traffic?lat=${center.lat}&lon=${center.lon}`)).then(r => r.json()).catch(() => ({ incidents: [] })),
          fetch(apiPath('/api/earthquakes')).then(r => r.json()).catch(() => ({ earthquakes: [] })),
          fetch(apiPath('/api/events')).then(r => r.json()).catch(() => ({ events: [] })),
          fetch(apiPath('/api/markets')).then(r => r.json()).catch(() => []),
          fetch(apiPath(`/api/news?lat=${center.lat}&lon=${center.lon}`)).then(r => r.json()).catch(() => ({ articles: [] })),
        ]);
        if (!cancelled) {
          const fb = fallbackPayload(center);
          setPayload({
            incidents: inc.incidents?.length ? inc.incidents : fb.incidents,
            trafficIncidents: traffic.incidents?.length ? traffic.incidents : fb.trafficIncidents,
            earthquakes: eq.earthquakes || [],
            events: ev.events?.length ? ev.events : fb.events,
            markets: Array.isArray(mk) ? mk.slice(0, 20) : [],
            newsArticles: Array.isArray(news?.articles) ? news.articles : [],
          });
        }
      } catch {
        if (!cancelled) setPayload(fallbackPayload(center));
      }
    };
    fetchSituation();
    const id = setInterval(fetchSituation, 120000);
    return () => { cancelled = true; clearInterval(id); };
  }, [center.lat, center.lon]);

  // User pin + local pulse -- render immediately on map load, no API dependency
  const userMarkersRef = useRef([]);
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    (async () => {
      try {
        const maplibregl = (await import('maplibre-gl')).default;
        userMarkersRef.current.forEach(m => m.remove());
        userMarkersRef.current = [];

        const addUserMarker = (css, title, data, lon, lat) =>
          createMarker(maplibregl, mapInstanceRef.current, userMarkersRef.current, css, title, data, lon, lat, setSelected);

        // User pin (Apple Maps drop pin style)
        addUserMarker(
          'width:14px;height:21px;background-image:url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 28 42\'><defs><radialGradient id=\'rg\' cx=\'40%25\' cy=\'35%25\' r=\'60%25\'><stop offset=\'0\' stop-color=\'%23ff6961\'/><stop offset=\'1\' stop-color=\'%23cc0000\'/></radialGradient><filter id=\'ds\'><feDropShadow dx=\'0\' dy=\'1.5\' stdDeviation=\'1.5\' flood-opacity=\'0.35\'/></filter></defs><ellipse cx=\'14\' cy=\'40\' rx=\'5\' ry=\'1.8\' fill=\'%23000\' opacity=\'.2\'/><line x1=\'14\' y1=\'22\' x2=\'14\' y2=\'39\' stroke=\'%23888\' stroke-width=\'2\' stroke-linecap=\'round\'/><circle cx=\'14\' cy=\'13\' r=\'12\' fill=\'url(%23rg)\' filter=\'url(%23ds)\'/><circle cx=\'11\' cy=\'10\' r=\'3.5\' fill=\'white\' opacity=\'.45\'/></svg>");background-size:contain;background-repeat:no-repeat;cursor:pointer;',
          'you',
          { type: 'location', title: 'You', detail: locLabel, level: 'local', source: geoState === 'granted' ? 'Browser Geolocation' : 'IP Geolocation', link: mapsLink(userPosition.lat, userPosition.lon) },
          userPosition.lon, userPosition.lat
        );

        // Local activity pulse
        addUserMarker(
          'width:10px;height:10px;border-radius:50%;background:#22c55e;box-shadow:0 0 0 0 rgba(34,197,94,0.45);animation:pulse-cyan 2s infinite;',
          'local activity',
          { type: 'local', title: 'LOCAL ACTIVITY', detail: `Live local pulse near ${locLabel}`, level: 'local', source: 'Local search', link: `https://www.google.com/search?q=${encodeURIComponent(`events near ${locLabel}`)}` },
          center.lon + 0.006, center.lat + 0.004
        );
      } catch {
        // ignore user marker failures
      }
    })();
    return () => { userMarkersRef.current.forEach(m => m.remove()); userMarkersRef.current = []; };
  }, [userPosition.lat, userPosition.lon, locLabel, geoState]);

  // API-dependent markers
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    (async () => {
      try {
        const maplibregl = (await import('maplibre-gl')).default;
        markersRef.current.forEach(m => m.remove());
        markersRef.current = [];

        const addMarker = (css, title, data, lon, lat) =>
          createMarker(maplibregl, mapInstanceRef.current, markersRef.current, css, title, data, lon, lat, setSelected);

        if (mapLayers?.incidents !== false) {
          payload.incidents.slice(0, 25).forEach((inc) => {
            if (inc.lon == null || inc.lat == null) return;
            addMarker(
              'width:44px;height:6px;border-radius:999px;background:repeating-linear-gradient(90deg,#f59e0b 0 7px,#fbbf24 7px 14px);border:1px solid rgba(0,0,0,0.22);transform:rotate(-22deg);box-shadow:0 0 0 0 rgba(245,158,11,0.35);animation:pulse-amber 1.8s infinite;',
              inc.description || inc.type,
              { type: 'construction', title: (inc.type || 'construction').toUpperCase(), detail: inc.description || 'Road/area incident', level: 'local', source: 'OpenStreetMap / Overpass', link: mapsLink(inc.lat, inc.lon) },
              inc.lon, inc.lat
            );
          });
        }

        if (mapLayers?.traffic !== false) {
          payload.trafficIncidents.slice(0, 20).forEach((inc) => {
            const p = inc.position;
            if (!p || p.lon == null || p.lat == null) return;
            addMarker(
              `width:48px;height:6px;border-radius:999px;background:${trafficColor(inc)};border:1px solid rgba(0,0,0,0.2);transform:rotate(18deg);box-shadow:0 0 0 0 rgba(249,115,22,0.35);animation:pulse-amber 1.6s infinite;`,
              inc.description || inc.type || 'traffic incident',
              { type: 'traffic', title: (inc.type || 'traffic').toUpperCase(), detail: inc.description || 'Traffic incident', level: 'local', source: 'Traffic feed / fallback model', link: mapsLink(p.lat, p.lon) },
              p.lon, p.lat
            );
          });
        }

        if (mapLayers?.earthquakes !== false) {
          payload.earthquakes.slice(0, 12).forEach((eq) => {
            if (eq.lon == null || eq.lat == null) return;
            const size = Math.max(10, Math.min(18, (eq.mag || 0) * 2.4));
            addMarker(
              `width:${size}px;height:${size}px;border-radius:50%;background:rgba(239,68,68,0.78);box-shadow:0 0 0 0 rgba(239,68,68,0.5);animation:pulse-red 1.9s infinite;`,
              `M${eq.mag} ${eq.place || ''}`,
              { type: 'seismic', title: `M${eq.mag?.toFixed?.(1) ?? eq.mag}`, detail: eq.place || 'Earthquake', level: (eq.mag || 0) >= 6 ? 'high' : (eq.mag || 0) >= 4 ? 'elevated' : 'monitor', source: 'USGS Earthquake Catalog', link: eq.url || 'https://earthquake.usgs.gov/earthquakes/map/' },
              eq.lon, eq.lat
            );
          });
        }

        if (mapLayers?.news !== false) {
          payload.events.slice(0, 16).forEach((ev, i) => {
            const kw = geoKeywordMatch(ev.title);
            // Spread unmatched events in a ring around user's position (visible at neighborhood zoom)
            const angle = (i / 16) * 2 * Math.PI;
            const r = 0.018 + (i % 3) * 0.012;
            const target = kw || {
              lat: center.lat + Math.sin(angle) * r,
              lon: center.lon + Math.cos(angle) * r,
              label: locLabel,
            };
            addMarker(
              'width:9px;height:9px;border-radius:50%;background:#22D3EE;box-shadow:0 0 0 0 rgba(34,211,238,0.5);animation:pulse-cyan 2.2s infinite;',
              `${target.label}: ${ev.title}`,
              { type: 'event', title: ev.country ? `[${ev.country}] ${target.label}` : target.label, detail: ev.title, level: 'global', source: 'GDELT / News feed', link: ev.url || 'https://www.gdeltproject.org/' },
              target.lon, target.lat
            );
          });

          payload.newsArticles.slice(0, 12).forEach((article, i) => {
            let target = null;
            if (typeof article.lat === 'number' && typeof article.lon === 'number') {
              target = { lat: article.lat, lon: article.lon, label: article.source || 'News' };
            } else {
              target = geoKeywordMatch(article.title);
            }
            if (!target) {
              const angle = (i / 12) * 2 * Math.PI;
              const r = 0.026 + (i % 3) * 0.014;
              target = { lat: center.lat + Math.sin(angle) * r, lon: center.lon + Math.cos(angle) * r, label: 'Global' };
            }
            const pubTime = article.publishedAt ? new Date(article.publishedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
            const detail = [article.source, pubTime].filter(Boolean).join(' · ');
            addMarker(
              'width:8px;height:8px;border-radius:50%;background:#60A5FA;box-shadow:0 0 0 0 rgba(96,165,250,0.5);animation:pulse-blue 2.1s infinite;',
              article.title,
              { type: 'news', title: article.title || 'News', detail: detail || 'News article', level: 'global', source: 'GDELT News', link: article.url || 'https://www.gdeltproject.org/' },
              target.lon, target.lat
            );
          });
        }

        if (mapLayers?.predictions !== false) {
          payload.markets.forEach((m) => {
            const p = geoKeywordMatch(m.question);
            if (!p) return;
            const prob = typeof m.probability === 'number' ? m.probability : 0.5;
            const conf = Math.max(prob, 1 - prob);
            const size = conf > 0.9 ? 12 : conf > 0.75 ? 10 : 8;
            addMarker(
              `width:${size}px;height:${size}px;border-radius:50%;background:${prob >= 0.5 ? '#22C55E' : '#F43F5E'};box-shadow:0 0 0 0 rgba(34,197,94,0.4);animation:pulse-cyan 2.4s infinite;`,
              `${Math.round(prob * 100)}% · ${m.question || 'market'}`,
              { type: 'prediction', title: `${Math.round(prob * 100)}% ${prob >= 0.5 ? 'YES' : 'NO'}`, detail: m.question || 'Prediction market', level: p.label, source: 'Polymarket', link: `https://polymarket.com/event/${m.eventSlug || m.slug}` },
              p.lon, p.lat
            );
          });
        }
      } catch {
        // ignore map marker failures
      }
    })();
  }, [center.lat, center.lon, payload, mapLayers]);

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', height: '100%' }}>
      <style>{`
        @keyframes pulse-blue { 0%{box-shadow:0 0 0 0 rgba(59,130,246,.55)} 70%{box-shadow:0 0 0 16px rgba(59,130,246,0)} 100%{box-shadow:0 0 0 0 rgba(59,130,246,0)} }
        @keyframes pulse-amber { 0%{box-shadow:0 0 0 0 rgba(245,158,11,.45)} 70%{box-shadow:0 0 0 12px rgba(245,158,11,0)} 100%{box-shadow:0 0 0 0 rgba(245,158,11,0)} }
        @keyframes pulse-red { 0%{box-shadow:0 0 0 0 rgba(239,68,68,.45)} 70%{box-shadow:0 0 0 16px rgba(239,68,68,0)} 100%{box-shadow:0 0 0 0 rgba(239,68,68,0)} }
        @keyframes pulse-cyan { 0%{box-shadow:0 0 0 0 rgba(34,211,238,.45)} 70%{box-shadow:0 0 0 12px rgba(34,211,238,0)} 100%{box-shadow:0 0 0 0 rgba(34,211,238,0)} }
      `}</style>
      <div
        ref={mapRef}
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'auto', filter: dark ? 'saturate(1.12) brightness(0.9)' : 'saturate(1.1) brightness(0.95)' }}
      />
      {mapLayers && (
        <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 4, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {Object.entries(mapLayers).map(([key, enabled]) => (
            <button
              key={key}
              onClick={() => {/* no-op, controlled from parent */}}
              style={{
                padding: '3px 8px', borderRadius: 6, fontSize: 9, fontWeight: 600,
                border: enabled ? '1px solid rgba(34,211,238,0.5)' : '1px solid rgba(255,255,255,0.15)',
                background: enabled ? 'rgba(34,211,238,0.15)' : 'rgba(0,0,0,0.5)',
                color: enabled ? '#22D3EE' : 'rgba(255,255,255,0.4)',
                cursor: 'default', fontFamily: 'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace',
                backdropFilter: 'blur(8px)', textTransform: 'uppercase', letterSpacing: '0.05em',
              }}
            >
              {key}
            </button>
          ))}
        </div>
      )}
      <button
        onClick={() => {
          if (geoState !== 'granted') { requestLocation(); return; }
          mapInstanceRef.current?.flyTo({ center: [userPosition.lon, userPosition.lat], zoom: GEO_DETAIL_ZOOM, offset: [0, 120], duration: 900 });
        }}
        aria-label="Recenter to my location"
        title="Recenter to my location"
        style={{ position: 'absolute', right: 14, bottom: 56, zIndex: 2, width: 34, height: 34, border: '1px solid rgba(255,255,255,0.24)', borderRadius: 9999, background: 'rgba(2,6,23,0.82)', color: '#ff5a52', font: '700 15px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
      >
        ⌖
      </button>

      {selected && (
        <div style={{ position: 'absolute', right: 14, bottom: 96, zIndex: 3, width: 320, maxWidth: 'calc(100vw - 28px)', border: '1px solid rgba(255,255,255,0.24)', borderRadius: 12, background: 'rgba(2,6,23,0.84)', color: '#fff', padding: '10px 12px', boxShadow: '0 8px 24px rgba(0,0,0,0.28)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <div style={{ font: '700 12px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace' }}>{selected.title}</div>
            <button onClick={() => setSelected(null)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 14, lineHeight: 1 }}>x</button>
          </div>
          <div style={{ marginTop: 4, color: '#cbd5e1', fontSize: 11, lineHeight: 1.45 }}>{selected.detail}</div>
          <div style={{ marginTop: 6, fontSize: 10, color: '#67e8f9', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{selected.level}</div>
          <div style={{ marginTop: 6, fontSize: 10, color: '#93c5fd' }}>Source: {selected.source || 'Unknown'}</div>
          {selected.link && (
            <a href={selected.link} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', marginTop: 8, color: '#60a5fa', fontSize: 11, textDecoration: 'underline' }}>
              Open source →
            </a>
          )}
        </div>
      )}
    </div>
  );
}
