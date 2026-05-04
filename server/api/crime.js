// Crime data endpoint: universal coverage for any location
// Sources: US city open data portals (when nearby), Canadian open data, news RSS fallback

const CACHE_TTL_MS = 5 * 60 * 1000;
const TIMEOUT_MS = 8000;
const cache = new Map();

function buildMeta(status, extra = {}) {
  return {
    status,
    updatedAt: new Date().toISOString(),
    ...extra,
  };
}

async function fetchWithTimeout(url, ms = TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

async function fetchText(url, ms = TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.text();
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

function distance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function fetchNYC(lat, lon) {
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const data = await fetchWithTimeout(
    `https://data.cityofnewyork.us/resource/5uac-w243.json?$where=cmplnt_fr_dt>='${since}'&$limit=50&$order=cmplnt_fr_dt DESC`
  );
  return (Array.isArray(data) ? data : []).filter(i => i.latitude && i.longitude).map(i => ({
    lat: parseFloat(i.latitude), lng: parseFloat(i.longitude), type: 'crime',
    category: i.ofns_desc || 'Unknown',
    title: i.ofns_desc || 'Crime incident',
    severity: categorySeverity(i.ofns_desc),
    timestamp: i.cmplnt_fr_dt || new Date().toISOString(), source: 'nyc_opendata',
  }));
}

async function fetchBoston(lat, lon) {
  const data = await fetchWithTimeout(
    `https://data.boston.gov/api/3/action/datastore_search?resource_id=12cb3883-56f5-47de-afa5-3b1cf61b257b&limit=50&sort=occurred_on_date desc`
  );
  const records = data?.result?.records || [];
  return records.filter(i => i.lat && i.long && Math.abs(parseFloat(i.lat) - lat) < 0.1).map(i => ({
    lat: parseFloat(i.lat), lng: parseFloat(i.long), type: 'crime',
    category: i.offense_description || 'Unknown',
    title: i.offense_description || 'Crime incident',
    severity: categorySeverity(i.offense_description),
    timestamp: i.occurred_on_date || new Date().toISOString(), source: 'boston_opendata',
  }));
}

async function fetchAustinCrime(lat, lon) {
  const data = await fetchWithTimeout(
    `https://data.austintexas.gov/resource/fdj4-gpfu.json?$where=within_circle(location,${lat},${lon},10000)&$limit=50&$order=occurred_date DESC`
  );
  return (Array.isArray(data) ? data : []).filter(i => i.latitude && i.longitude).map(i => ({
    lat: parseFloat(i.latitude), lng: parseFloat(i.longitude), type: 'crime',
    category: i.highest_offense_description || 'Unknown',
    title: i.highest_offense_description || 'Crime incident',
    severity: categorySeverity(i.highest_offense_description),
    timestamp: i.occurred_date || new Date().toISOString(), source: 'austin_opendata',
  }));
}

// US city portals -- only query if user is within 50km
const US_PORTALS = [
  { name: 'sf_opendata', lat: 37.7749, lon: -122.4194, fetch: fetchSF },
  { name: 'chicago_clear', lat: 41.8781, lon: -87.6298, fetch: fetchChicago },
  { name: 'la_opendata', lat: 34.0522, lon: -118.2437, fetch: fetchLA },
  { name: 'seattle_opendata', lat: 47.6062, lon: -122.3321, fetch: fetchSeattle },
  { name: 'portland_opendata', lat: 45.5155, lon: -122.6789, fetch: fetchPortland },
  { name: 'nyc_opendata', lat: 40.7128, lon: -74.0060, fetch: fetchNYC },
  { name: 'boston_opendata', lat: 42.3601, lon: -71.0589, fetch: fetchBoston },
  { name: 'austin_opendata', lat: 30.2672, lon: -97.7431, fetch: fetchAustinCrime },
];

async function fetchSF(lat, lon) {
  const data = await fetchWithTimeout(
    `https://data.sfgov.org/resource/wg3w-h783.json?$where=within_circle(point, ${lat}, ${lon}, 10000)&$limit=50&$order=incident_datetime DESC`
  );
  return (Array.isArray(data) ? data : []).filter(i => i.latitude && i.longitude).map(i => ({
    lat: parseFloat(i.latitude), lng: parseFloat(i.longitude), type: 'crime',
    category: i.incident_category || 'Unknown',
    title: i.incident_description || i.incident_category || 'Crime incident',
    severity: categorySeverity(i.incident_category),
    timestamp: i.incident_datetime || new Date().toISOString(), source: 'sf_opendata',
  }));
}

async function fetchChicago(lat, lon) {
  const data = await fetchWithTimeout(
    `https://data.cityofchicago.org/resource/ijzp-q8t2.json?$where=within_circle(location, ${lat}, ${lon}, 10000)&$limit=50&$order=date DESC`
  );
  return (Array.isArray(data) ? data : []).filter(i => i.latitude && i.longitude).map(i => ({
    lat: parseFloat(i.latitude), lng: parseFloat(i.longitude), type: 'crime',
    category: i.primary_type || 'Unknown',
    title: i.description || i.primary_type || 'Crime incident',
    severity: categorySeverity(i.primary_type),
    timestamp: i.date || new Date().toISOString(), source: 'chicago_clear',
  }));
}

async function fetchLA(lat, lon) {
  const data = await fetchWithTimeout(
    `https://data.lacity.org/resource/2nrs-mtv8.json?$limit=50&$order=date_occ DESC`
  );
  return (Array.isArray(data) ? data : []).filter(i => {
    if (!i.lat || !i.lon) return false;
    return Math.abs(parseFloat(i.lat) - lat) < 0.1 && Math.abs(parseFloat(i.lon) - lon) < 0.1;
  }).map(i => ({
    lat: parseFloat(i.lat), lng: parseFloat(i.lon), type: 'crime',
    category: i.crm_cd_desc || 'Unknown', title: i.crm_cd_desc || 'Crime incident',
    severity: categorySeverity(i.crm_cd_desc),
    timestamp: i.date_occ || new Date().toISOString(), source: 'la_opendata',
  }));
}

async function fetchSeattle(lat, lon) {
  const data = await fetchWithTimeout(
    `https://data.seattle.gov/resource/tazs-3rd5.json?$where=within_circle(report_location, ${lat}, ${lon}, 10000)&$limit=50&$order=report_datetime DESC`
  );
  return (Array.isArray(data) ? data : []).filter(i => i.latitude && i.longitude).map(i => ({
    lat: parseFloat(i.latitude), lng: parseFloat(i.longitude), type: 'crime',
    category: i.crime_against_category || 'Unknown',
    title: i.offense || 'Crime incident',
    severity: categorySeverity(i.offense),
    timestamp: i.report_datetime || new Date().toISOString(), source: 'seattle_opendata',
  }));
}

async function fetchPortland(lat, lon) {
  const data = await fetchWithTimeout(
    `https://public.tableau.com/views/PPBOpenData/CrimeData.json` // Fallback -- Portland uses Tableau
  ).catch(() => []);
  return [];
}

// Canadian crime data via RCMP/municipal open data + news
async function fetchCanadianCrime(lat, lon) {
  const incidents = [];

  // Reverse geocode to get city + nearby cities for broader search
  const cityName = await reverseGeocode(lat, lon);

  // Build list of search terms: primary city + nearby municipalities
  const searchTerms = [];
  if (cityName) searchTerms.push(cityName);

  // Add nearby BC municipalities for broader coverage
  const nearbyBC = [
    { name: 'Langley', lat: 49.1044, lon: -122.6605 },
    { name: 'Surrey', lat: 49.1913, lon: -122.8490 },
    { name: 'Abbotsford', lat: 49.0504, lon: -122.3045 },
    { name: 'Maple Ridge', lat: 49.2193, lon: -122.5984 },
    { name: 'Coquitlam', lat: 49.2838, lon: -122.7932 },
    { name: 'Burnaby', lat: 49.2488, lon: -122.9805 },
    { name: 'Vancouver', lat: 49.2827, lon: -123.1207 },
    { name: 'New Westminster', lat: 49.2057, lon: -122.9110 },
    { name: 'Delta', lat: 49.0847, lon: -123.0587 },
    { name: 'Chilliwack', lat: 49.1579, lon: -121.9514 },
  ];
  for (const city of nearbyBC) {
    if (distance(lat, lon, city.lat, city.lon) < 30 && !searchTerms.includes(city.name)) {
      searchTerms.push(city.name);
    }
  }

  // Fetch crime news for primary city and nearest neighbour
  const termsToSearch = searchTerms.slice(0, 3);
  const fetchers = termsToSearch.map(term => fetchCrimeNews(lat, lon, term).catch(() => []));
  const results = await Promise.all(fetchers);
  const allNews = results.flat();

  // Deduplicate by title prefix
  const seen = new Set();
  for (const item of allNews) {
    const key = item.title.toLowerCase().slice(0, 40);
    if (seen.has(key)) continue;
    seen.add(key);
    incidents.push(item);
  }

  return incidents;
}

// Reverse geocode to get city name for news searches
async function reverseGeocode(lat, lon) {
  try {
    const data = await fetchWithTimeout(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=10`,
      5000
    );
    return data.address?.city || data.address?.town || data.address?.village || data.address?.county || null;
  } catch {
    return null;
  }
}

// News RSS fallback: search Google News for local crime reports
async function fetchCrimeNews(lat, lon, cityName) {
  const incidents = [];
  const query = encodeURIComponent(`${cityName} crime OR theft OR assault OR robbery`);

  try {
    const rss = await fetchText(
      `https://news.google.com/rss/search?q=${query}&hl=en&gl=CA&ceid=CA:en`
    );

    // Parse RSS items (simple regex extraction)
    const items = rss.match(/<item>[\s\S]*?<\/item>/g) || [];
    for (const item of items.slice(0, 15)) {
      const titleMatch = item.match(/<title><!\[CDATA\[(.*?)\]\]>/);
      const dateMatch = item.match(/<pubDate>(.*?)<\/pubDate>/);
      const title = titleMatch ? titleMatch[1] : null;
      if (!title) continue;

      // Filter for crime-related articles
      const lower = title.toLowerCase();
      const isCrime = ['crime', 'theft', 'assault', 'robbery', 'stabbing', 'shooting',
        'homicide', 'murder', 'break-in', 'break and enter', 'arson', 'fraud',
        'stolen', 'arrest', 'suspect', 'police', 'rcmp', 'charged'].some(k => lower.includes(k));
      if (!isCrime) continue;

      incidents.push({
        lat: lat + (Math.random() - 0.5) * 0.02,
        lng: lon + (Math.random() - 0.5) * 0.02,
        type: 'crime',
        category: 'News Report',
        title: title.length > 80 ? title.slice(0, 77) + '...' : title,
        severity: categorySeverity(title),
        timestamp: dateMatch ? new Date(dateMatch[1]).toISOString() : new Date().toISOString(),
        source: 'news_rss',
      });
    }
  } catch { /* news RSS unavailable */ }

  return incidents;
}

function categorySeverity(category) {
  if (!category) return 'low';
  const cat = category.toLowerCase();
  if (cat.includes('homicide') || cat.includes('murder') || cat.includes('assault') || cat.includes('robbery') || cat.includes('shooting') || cat.includes('stabbing')) return 'high';
  if (cat.includes('burglary') || cat.includes('theft') || cat.includes('weapon') || cat.includes('narcotics') || cat.includes('break')) return 'medium';
  return 'low';
}

export default async function handler(req, res) {
  const lat = parseFloat(req.query.lat);
  const lon = parseFloat(req.query.lon);

  if (isNaN(lat) || isNaN(lon)) {
    return res.status(400).json({ error: 'lat and lon query params required' });
  }

  const cacheKey = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  const cached = cache.get(cacheKey);
  if (cached && (Date.now() - cached.ts) < CACHE_TTL_MS) {
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json({
      incidents: cached.data,
      cached: true,
      meta: buildMeta('cache', { cached: true, cacheAgeMs: Date.now() - cached.ts }),
    });
  }

  try {
    const fetchers = [];
    const attemptedSources = [];

    // Query US portals only if user is within 50km of that city
    for (const portal of US_PORTALS) {
      if (distance(lat, lon, portal.lat, portal.lon) < 50) {
        attemptedSources.push(portal.name);
        fetchers.push(portal.fetch(lat, lon).catch(() => []));
      }
    }

    // Always try Canadian/news fallback for universal coverage
    attemptedSources.push('canadian_news_fallback');
    fetchers.push(fetchCanadianCrime(lat, lon).catch(() => []));

    const results = await Promise.all(fetchers);
    const incidents = results.flat();

    cache.set(cacheKey, { data: incidents, ts: Date.now() });
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    const sources = incidents.length > 0 ? [...new Set(incidents.map(i => i.source))] : [];
    const degraded = incidents.length === 0;
    return res.status(200).json({
      incidents,
      sources,
      attemptedSources,
      meta: buildMeta(degraded ? 'degraded' : 'live', degraded
        ? { degraded: true, warning: 'No crime feeds produced results for this location' }
        : {}),
    });
  } catch (err) {
    console.error('Crime API error:', err);
    if (cached) {
      return res.status(200).json({
        incidents: cached.data,
        stale: true,
        meta: buildMeta('stale', {
          cached: true,
          degraded: true,
          cacheAgeMs: Date.now() - cached.ts,
          warning: 'Crime providers failed; serving stale cached data',
        }),
      });
    }
    return res.status(200).json({
      incidents: [],
      attemptedSources: ['canadian_news_fallback'],
      meta: buildMeta('degraded', {
        degraded: true,
        warning: 'Crime providers failed and no cached data is available',
      }),
    });
  }
}
