import { withMapErrorHandler } from './_map-error-handler.js';

// GDELT Project — global news events, geocoded, real-time 15min updates (free, no auth)
const GDELT_BASE = 'https://api.gdeltproject.org/api/v2/doc/doc';

// GDELT's `sourcecountry` field is a full English country name (e.g.
// "United States", "United Kingdom"), NOT an ISO2 code -- name → [lat, lon]
// centroid for map placement.
const COUNTRY_CENTROIDS = {
  'United States':[37.1,-95.7],'Canada':[56.1,-106.3],'United Kingdom':[55.4,-3.4],
  'Germany':[51.2,10.4],'France':[46.2,2.2],'Italy':[41.9,12.6],'Spain':[40.5,-3.7],
  'Russia':[61.5,105.3],'China':[35.9,104.2],'Japan':[36.2,138.3],'India':[20.6,79.0],
  'Brazil':[14.2,-51.9],'Australia':[-25.3,133.8],'Mexico':[23.6,-102.6],
  'South Korea':[35.9,127.8],'South Africa':[-30.6,22.9],'Egypt':[26.8,30.8],
  'Nigeria':[9.1,8.7],'Argentina':[-38.4,-63.6],'Ukraine':[48.4,31.2],
  'Turkey':[38.9,35.2],'Saudi Arabia':[24.0,45.0],'Iran':[32.4,53.7],
  'Israel':[31.0,34.9],'Pakistan':[30.4,69.3],'Afghanistan':[33.9,67.7],
  'Iraq':[33.2,43.7],'Syria':[35.0,38.0],'North Korea':[40.3,127.5],
  'Libya':[26.3,17.2],'Venezuela':[6.4,-66.6],'Colombia':[4.6,-74.1],
  'Chile':[-35.7,-71.5],'Philippines':[12.9,121.8],'Indonesia':[-0.8,113.9],
  'Thailand':[15.9,100.9],'Vietnam':[14.1,108.3],'Sweden':[60.1,18.6],
  'Norway':[60.5,8.5],'Poland':[51.9,19.1],'Netherlands':[52.1,5.3],
  'Belgium':[50.5,4.5],'Switzerland':[46.8,8.2],'Austria':[47.5,14.6],
  'Portugal':[39.4,-8.2],'Greece':[39.1,21.8],'Hungary':[47.2,19.5],
  'Romania':[45.9,25.0],'Czech Republic':[49.8,15.5],'Czechia':[49.8,15.5],
  'New Zealand':[-40.9,174.9],'Denmark':[56.0,9.5],'Finland':[64.0,26.0],
  'Ireland':[53.4,-8.0],'Iceland':[65.0,-19.0],'Luxembourg':[49.8,6.1],
  'Slovakia':[48.7,19.7],'Slovenia':[46.1,14.8],'Croatia':[45.1,15.2],
  'Bosnia and Herzegovina':[43.9,17.7],'Serbia':[44.0,21.0],'Bulgaria':[42.7,25.5],
  'Albania':[41.2,20.2],'North Macedonia':[41.6,21.7],'Montenegro':[42.7,19.4],
  'Kosovo':[42.6,20.9],'Lithuania':[55.2,23.9],'Latvia':[56.9,24.6],
  'Estonia':[58.6,25.0],'Belarus':[53.7,28.0],'Moldova':[47.4,28.4],
  'Cyprus':[35.1,33.4],'Malta':[35.9,14.4],'Kazakhstan':[48.0,67.0],
  'Uzbekistan':[41.4,64.6],'Turkmenistan':[39.0,59.6],'Tajikistan':[38.9,71.0],
  'Kyrgyzstan':[41.2,74.8],'Mongolia':[46.9,103.8],'Taiwan':[23.7,121.0],
  'Hong Kong':[22.3,114.2],'Malaysia':[4.2,102.0],'Singapore':[1.35,103.8],
  'Myanmar':[21.9,95.9],'Cambodia':[12.6,105.0],'Laos':[19.9,102.5],
  'Bangladesh':[23.7,90.4],'Nepal':[28.4,84.1],'Bhutan':[27.5,90.4],
  'Sri Lanka':[7.9,80.8],'Maldives':[3.2,73.2],'United Arab Emirates':[23.4,53.8],
  'Qatar':[25.4,51.2],'Kuwait':[29.3,47.5],'Bahrain':[26.0,50.6],'Oman':[21.5,55.9],
  'Yemen':[15.6,48.5],'Jordan':[31.2,36.5],'Lebanon':[33.9,35.9],'Armenia':[40.1,45.0],
  'Azerbaijan':[40.1,47.6],'Georgia':[42.3,43.4],'Morocco':[31.8,-7.1],
  'Algeria':[28.0,1.7],'Tunisia':[33.9,9.5],'Sudan':[12.9,30.2],
  'South Sudan':[7.9,30.0],'Ethiopia':[9.1,40.5],'Kenya':[-0.0,37.9],
  'Tanzania':[-6.4,34.9],'Uganda':[1.4,32.3],'Rwanda':[-1.9,29.9],
  'Somalia':[5.2,46.2],'Ghana':[7.9,-1.0],'Ivory Coast':[7.5,-5.5],
  'Senegal':[14.5,-14.5],'Mali':[17.6,-4.0],'Niger':[17.6,8.1],'Chad':[15.5,18.7],
  'Cameroon':[7.4,12.4],'Angola':[-11.2,17.9],'Zambia':[-13.1,27.8],
  'Zimbabwe':[-19.0,29.2],'Mozambique':[-18.7,35.5],'Botswana':[-22.3,24.7],
  'Namibia':[-22.6,17.1],'Democratic Republic of the Congo':[-4.0,21.8],
  'Republic of the Congo':[-0.2,15.8],'Gabon':[-0.8,11.6],'Togo':[8.6,0.8],
  'Benin':[9.3,2.3],'Burkina Faso':[12.2,-1.6],'Guinea':[9.9,-9.7],
  'Mauritania':[21.0,-10.9],'Eritrea':[15.2,39.8],'Djibouti':[11.8,42.6],
  'Malawi':[-13.3,34.3],'Lesotho':[-29.6,28.2],'Eswatini':[-26.5,31.5],
  'Madagascar':[-18.8,47.0],'Mauritius':[-20.3,57.6],'Peru':[-9.2,-75.0],
  'Ecuador':[-1.8,-78.2],'Bolivia':[-16.3,-63.6],'Paraguay':[-23.4,-58.4],
  'Uruguay':[-32.5,-55.8],'Guyana':[4.9,-58.9],'Suriname':[4.0,-56.0],
  'Costa Rica':[9.7,-83.8],'Panama':[8.5,-80.8],'Nicaragua':[12.9,-85.2],
  'Honduras':[15.2,-86.2],'Guatemala':[15.8,-90.2],'Belize':[17.2,-88.5],
  'El Salvador':[13.8,-88.9],'Cuba':[21.5,-77.8],'Dominican Republic':[18.7,-70.2],
  'Haiti':[18.9,-72.3],'Jamaica':[18.1,-77.3],'Trinidad and Tobago':[10.7,-61.2],
  'Bahamas':[25.0,-77.4],'Papua New Guinea':[-6.3,143.9],'Fiji':[-17.7,178.1],
};

function countryCoords(name) {
  if (!name) return null;
  return COUNTRY_CENTROIDS[name.trim()] || null;
}
const CACHE_TTL = 5 * 60 * 1000;
let cache = null;

function buildMeta(status, extra = {}) {
  return {
    status,
    updatedAt: new Date().toISOString(),
    ...extra,
  };
}

async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const lat = parseFloat(req.query.lat);
  const lon = parseFloat(req.query.lon);

  // Use location-specific cache key
  const cacheKey = (!isNaN(lat) && !isNaN(lon)) ? `${lat.toFixed(1)},${lon.toFixed(1)}` : 'global';

  if (cache && cache.key === cacheKey && Date.now() - cache.ts < CACHE_TTL) {
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.status(200).json({
      ...cache.data,
      meta: buildMeta('cache', { cached: true, cacheAgeMs: Date.now() - cache.ts }),
    });
  }

  // Make GDELT query location-aware when coordinates provided
  let query;
  if (!isNaN(lat) && !isNaN(lon)) {
    query = encodeURIComponent(`sourcelat:${lat.toFixed(1)} sourcelong:${lon.toFixed(1)} news OR politics OR economy OR technology OR health OR environment OR conflict OR disaster`);
  } else {
    query = encodeURIComponent('world OR breaking OR politics OR economy OR technology OR conflict OR disaster');
  }
  const url = `${GDELT_BASE}?query=${query}&mode=artlist&maxrecords=50&format=json&sort=datedesc`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const r = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!r.ok) throw new Error(`GDELT ${r.status}`);
    const json = await r.json();
    const events = (json.articles || []).slice(0, 25).map(a => {
      const coords = countryCoords(a.sourcecountry);
      return {
        title: a.title,
        url: a.url,
        domain: a.domain,
        date: a.seendate,
        country: a.sourcecountry,
        ...(coords ? { lat: coords[0], lon: coords[1] } : {}),
      };
    });
    const data = {
      events,
      meta: buildMeta('live'),
    };
    cache = { ts: Date.now(), data, key: cacheKey };
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.status(200).json(data);
  } catch (err) {
    clearTimeout(timer);
    console.error('GDELT error:', err.message);
    if (cache && cache.key === cacheKey) {
      res.setHeader('Cache-Control', 'public, max-age=60');
      return res.status(200).json({
        ...cache.data,
        meta: buildMeta('stale', {
          cached: true,
          degraded: true,
          cacheAgeMs: Date.now() - cache.ts,
          warning: 'GDELT unavailable; serving stale cached events',
        }),
      });
    }
    return res.status(502).json({
      error: 'GDELT unavailable',
      events: [],
      meta: buildMeta('degraded', {
        degraded: true,
        warning: 'GDELT unavailable and no cached events are available',
      }),
    });
  }
}

export default withMapErrorHandler(handler);
