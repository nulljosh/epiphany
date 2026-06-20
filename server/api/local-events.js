// Local events endpoint: PredictHQ (primary) + free fallbacks for universal coverage
// Fallbacks: Wikipedia GeoSearch (multi-point), OSM venues, Eventbrite, news RSS

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

async function fetchWithTimeout(url, headers = {}, ms = TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { signal: controller.signal, headers });
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

function severityFromCategory(category) {
  const high = ['disasters', 'terror', 'severe-weather'];
  const medium = ['sports', 'concerts', 'festivals', 'conferences'];
  if (high.includes(category)) return 'high';
  if (medium.includes(category)) return 'medium';
  return 'low';
}

// PredictHQ (primary, requires API key)
async function fetchPredictHQ(lat, lon, radius, apiKey) {
  const now = new Date().toISOString().split('T')[0];
  const weekLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const url = `https://api.predicthq.com/v1/events/?within=${radius}@${lat},${lon}&active.gte=${now}&active.lte=${weekLater}&limit=50&sort=rank`;

  const data = await fetchWithTimeout(url, {
    Authorization: `Bearer ${apiKey}`,
    Accept: 'application/json',
  });

  return (data.results || [])
    .filter(e => e.location && e.location.length === 2)
    .map(e => ({
      lat: e.location[1], lng: e.location[0], type: 'local-event', kind: 'event',
      category: e.category || 'event', title: e.title || 'Local event',
      severity: severityFromCategory(e.category),
      timestamp: e.start || new Date().toISOString(),
      attendees: e.phq_attendance || null, rank: e.rank || 0, source: 'predicthq',
      description: e.description || null,
    }));
}

// Eventbrite public search (no API key needed for public events)
async function fetchEventbrite(lat, lon) {
  const events = [];
  try {
    const data = await fetchWithTimeout(
      `https://www.eventbriteapi.com/v3/events/search/?location.latitude=${lat}&location.longitude=${lon}&location.within=25km&expand=venue&sort_by=date`,
      { Accept: 'application/json' }
    );
    for (const e of (data.events || [])) {
      const venue = e.venue;
      if (!venue?.latitude || !venue?.longitude) continue;
      events.push({
        lat: parseFloat(venue.latitude), lng: parseFloat(venue.longitude),
        type: 'local-event', kind: 'event', category: 'community',
        title: e.name?.text || 'Event',
        severity: 'low',
        timestamp: e.start?.utc || new Date().toISOString(),
        source: 'eventbrite',
        description: e.description?.text?.slice(0, 200) || null,
        venue: venue.name || null,
        image: e.logo?.url || null,
      });
    }
  } catch { /* Eventbrite unavailable */ }
  return events;
}

// Wikipedia GeoSearch with multi-point coverage for suburban areas
// gsradius caps at 10000m, so query multiple offsets for wider coverage
async function fetchWikipediaPlaces(lat, lon) {
  const offsets = [
    [0, 0],
    [0.05, 0], [-0.05, 0],
    [0, 0.05], [0, -0.05],
  ];

  const fetchers = offsets.map(([dLat, dLon]) => fetchWikipediaSingle(lat + dLat, lon + dLon));
  const results = await Promise.all(fetchers.map(f => f.catch(() => [])));
  const all = results.flat();

  // Deduplicate by page title
  const seen = new Set();
  return all.filter(e => {
    if (seen.has(e.title)) return false;
    seen.add(e.title);
    return true;
  });
}

async function fetchWikipediaSingle(lat, lon) {
  const events = [];
  try {
    // Get places with extracts for richer detail
    const geoUrl = `https://en.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord=${lat}|${lon}&gsradius=10000&gslimit=50&format=json`;
    const geoData = await fetchWithTimeout(geoUrl, {}, 6000);
    const pages = geoData.query?.geosearch || [];

    // Batch fetch full intros + lead images for all found pages.
    // exintro+exchars (not exsentences) avoids truncating on abbreviation periods
    // like "(pop. approx.)"; pageimages adds a photo in the same request.
    const pageIds = pages.map(p => p.pageid).slice(0, 20);
    let extracts = {};
    if (pageIds.length > 0) {
      try {
        const extractUrl = `https://en.wikipedia.org/w/api.php?action=query&pageids=${pageIds.join('|')}&prop=extracts|pageimages&exintro&explaintext&exchars=600&piprop=thumbnail|original&pithumbsize=480&format=json`;
        const extractData = await fetchWithTimeout(extractUrl, {}, 6000);
        extracts = extractData.query?.pages || {};
      } catch { /* extracts optional */ }
    }

    for (const place of pages) {
      const page = extracts[place.pageid];
      const extract = page?.extract || null;
      const image = page?.original?.source || page?.thumbnail?.source || null;
      events.push({
        lat: place.lat, lng: place.lon, type: 'local-event', kind: 'place',
        category: 'place',
        title: place.title,
        venue: place.title,
        severity: 'low',
        timestamp: new Date().toISOString(),
        source: 'wikipedia',
        description: extract,
        image,
        url: `https://en.wikipedia.org/wiki/${encodeURIComponent(place.title.replace(/ /g, '_'))}`,
      });
    }
  } catch { /* Wikipedia unavailable */ }
  return events;
}

// OSM venue query: find real places people visit (community centres, theatres, parks, libraries)
async function fetchOSMVenues(lat, lon) {
  const events = [];
  const delta = 0.08;
  const bb = `${lat - delta},${lon - delta},${lat + delta},${lon + delta}`;
  const query = `[out:json][timeout:8];(` +
    `node["amenity"~"^(community_centre|theatre|cinema|library|arts_centre|marketplace)$"](${bb});` +
    `node["tourism"~"^(museum|gallery|attraction|viewpoint|zoo|aquarium)$"](${bb});` +
    `node["leisure"~"^(park|sports_centre|stadium|swimming_pool|ice_rink)$"](${bb});` +
    `way["leisure"="park"](${bb});` +
    `);out center 30;`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`Overpass ${res.status}`);
    const json = await res.json();

    for (const el of (json.elements || [])) {
      const elLat = el.center?.lat ?? el.lat;
      const elLon = el.center?.lon ?? el.lon;
      if (elLat == null || elLon == null) continue;
      const name = el.tags?.name;
      if (!name) continue;

      const amenity = el.tags?.amenity || el.tags?.tourism || el.tags?.leisure || '';
      events.push({
        lat: elLat, lng: elLon, type: 'local-event', kind: 'place',
        category: el.tags?.tourism ? 'attraction' : el.tags?.leisure ? 'recreation' : 'venue',
        title: name,
        venue: name,
        severity: 'low',
        timestamp: new Date().toISOString(),
        source: 'openstreetmap',
        description: amenity.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      });
    }
  } catch { /* OSM venues unavailable */ }

  // OSM doesn't carry photos; backfill from Wikipedia when a venue has a
  // same-named article (common for museums, theatres, parks) so these places
  // aren't the only ones in the feed without an image.
  if (events.length) await backfillImagesFromWikipedia(events);

  return events;
}

// Batched exact-title lookup -- only attaches an image when Wikipedia has a
// page matching the venue name (no fuzzy search, so no risk of mismatched photos).
async function backfillImagesFromWikipedia(events) {
  const titles = events.map(e => e.title);
  try {
    const data = await fetchWithTimeout(
      `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(titles.join('|'))}` +
      `&prop=pageimages&piprop=thumbnail|original&pithumbsize=480&redirects=1&format=json`
    );
    const pages = Object.values(data?.query?.pages || {});
    const imageByTitle = new Map();
    for (const page of pages) {
      const image = page.original?.source || page.thumbnail?.source;
      if (image) imageByTitle.set(page.title, image);
    }
    // `redirects` in the response maps a queried title to the page title it resolved to.
    for (const r of (data?.query?.redirects || [])) {
      if (imageByTitle.has(r.to)) imageByTitle.set(r.from, imageByTitle.get(r.to));
    }
    for (const event of events) {
      const image = imageByTitle.get(event.title);
      if (image) event.image = image;
    }
  } catch { /* Wikipedia image backfill unavailable */ }
}

// News RSS fallback: search for local events in news
async function fetchEventNews(lat, lon, cityName) {
  const events = [];
  if (!cityName) return events;

  const query = encodeURIComponent(`${cityName} event OR festival OR concert OR fair OR market`);
  try {
    const rss = await fetchText(
      `https://news.google.com/rss/search?q=${query}&hl=en&gl=CA&ceid=CA:en`
    );
    const items = rss.match(/<item>[\s\S]*?<\/item>/g) || [];
    for (const item of items.slice(0, 10)) {
      const titleMatch = item.match(/<title><!\[CDATA\[(.*?)\]\]>/);
      const dateMatch = item.match(/<pubDate>(.*?)<\/pubDate>/);
      const title = titleMatch ? titleMatch[1] : null;
      if (!title) continue;

      const lower = title.toLowerCase();
      const isEvent = ['event', 'festival', 'concert', 'fair', 'market', 'parade',
        'show', 'exhibit', 'celebration', 'fundraiser', 'tournament'].some(k => lower.includes(k));
      if (!isEvent) continue;

      // Google News titles are "Headline - Publication"; split that off so the
      // publication can show as the venue/source instead of the detail panel
      // having nothing but a title (the news item carries no other metadata).
      const splitIdx = title.lastIndexOf(' - ');
      const headline = splitIdx > 0 ? title.slice(0, splitIdx) : title;
      const publication = splitIdx > 0 ? title.slice(splitIdx + 3) : null;

      events.push({
        lat: lat + (Math.random() - 0.5) * 0.01,
        lng: lon + (Math.random() - 0.5) * 0.01,
        type: 'local-event', kind: 'event', category: 'community',
        title: headline.length > 80 ? headline.slice(0, 77) + '...' : headline,
        venue: publication,
        severity: 'low',
        timestamp: dateMatch ? new Date(dateMatch[1]).toISOString() : new Date().toISOString(),
        source: 'news_rss',
      });
    }
  } catch { /* news unavailable */ }
  return events;
}

async function reverseGeocode(lat, lon) {
  try {
    const data = await fetchWithTimeout(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=10`,
      {}, 5000
    );
    return data.address?.city || data.address?.town || data.address?.village || data.address?.county || null;
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  const lat = parseFloat(req.query.lat);
  const lon = parseFloat(req.query.lon);
  const radius = req.query.radius || '50km';

  if (isNaN(lat) || isNaN(lon)) {
    return res.status(400).json({ error: 'lat and lon query params required' });
  }

  const cacheKey = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  const cached = cache.get(cacheKey);
  if (cached && (Date.now() - cached.ts) < CACHE_TTL_MS) {
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json({
      events: cached.data,
      cached: true,
      meta: buildMeta('cache', { cached: true, cacheAgeMs: Date.now() - cached.ts }),
    });
  }

  const apiKey = process.env.PREDICTHQ_API_KEY;

  try {
    const fetchers = [];
    const attemptedSources = [];

    // PredictHQ if key available
    if (apiKey) {
      attemptedSources.push('predicthq');
      fetchers.push(fetchPredictHQ(lat, lon, radius, apiKey).catch(() => []));
    }

    // Free fallbacks (always run)
    attemptedSources.push('eventbrite', 'wikipedia', 'openstreetmap');
    fetchers.push(fetchEventbrite(lat, lon).catch(() => []));
    fetchers.push(fetchWikipediaPlaces(lat, lon).catch(() => []));
    fetchers.push(fetchOSMVenues(lat, lon).catch(() => []));

    // News fallback with city name
    const cityName = await reverseGeocode(lat, lon);
    if (cityName) {
      attemptedSources.push('news_rss');
      fetchers.push(fetchEventNews(lat, lon, cityName).catch(() => []));
    }

    const results = await Promise.all(fetchers);
    const events = results.flat();

    // Deduplicate by title similarity
    const seen = new Set();
    const deduped = events.filter(e => {
      const key = e.title.toLowerCase().slice(0, 30);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    cache.set(cacheKey, { data: deduped, ts: Date.now() });
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    const sources = [...new Set(deduped.map(e => e.source))];
    const degraded = deduped.length === 0;
    return res.status(200).json({
      events: deduped,
      sources,
      attemptedSources,
      meta: buildMeta(degraded ? 'degraded' : 'live', degraded
        ? { degraded: true, warning: 'No local event feeds produced results for this location' }
        : {}),
    });
  } catch (err) {
    console.error('Local events API error:', err);
    if (cached) {
      return res.status(200).json({
        events: cached.data,
        stale: true,
        meta: buildMeta('stale', {
          cached: true,
          degraded: true,
          cacheAgeMs: Date.now() - cached.ts,
          warning: 'Local event providers failed; serving stale cached data',
        }),
      });
    }
    return res.status(200).json({
      events: [],
      attemptedSources: apiKey ? ['predicthq', 'eventbrite', 'wikipedia', 'openstreetmap', 'news_rss'] : ['eventbrite', 'wikipedia', 'openstreetmap', 'news_rss'],
      meta: buildMeta('degraded', {
        degraded: true,
        warning: 'Local event providers failed and no cached data is available',
      }),
    });
  }
}
