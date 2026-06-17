import { applyCors } from './_cors.js';

// Open-Meteo: free, no API key, global coverage
const OPEN_METEO = 'https://api.open-meteo.com/v1/forecast';
const CACHE_TTL = 10 * 60 * 1000;
const cache = new Map();

function buildMeta(status, extra = {}) {
  return {
    status,
    updatedAt: new Date().toISOString(),
    ...extra,
  };
}

// WMO weather code -> description
const WMO_CODES = {
  0: 'Clear', 1: 'Mostly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Fog', 48: 'Rime fog',
  51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle',
  61: 'Light rain', 63: 'Rain', 65: 'Heavy rain',
  66: 'Freezing rain', 67: 'Heavy freezing rain',
  71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 77: 'Snow grains',
  80: 'Light showers', 81: 'Showers', 82: 'Heavy showers',
  85: 'Light snow showers', 86: 'Heavy snow showers',
  95: 'Thunderstorm', 96: 'Thunderstorm + hail', 99: 'Severe thunderstorm',
};

// WMO code -> emoji-style icon key
function weatherIcon(code) {
  if (code === 0) return 'sun';
  if (code <= 2) return 'partly';
  if (code === 3) return 'cloud';
  if (code <= 48) return 'fog';
  if (code <= 55) return 'drizzle';
  if (code <= 67) return 'rain';
  if (code <= 77) return 'snow';
  if (code <= 82) return 'showers';
  if (code <= 86) return 'snow';
  return 'storm';
}

export default async function handler(req, res) {
  applyCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { lat, lon } = req.query;
  if (!lat || !lon || isNaN(+lat) || isNaN(+lon)) {
    return res.status(400).json({ error: 'lat and lon required' });
  }

  const key = `${(+lat).toFixed(2)},${(+lon).toFixed(2)}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    res.setHeader('Cache-Control', 'public, max-age=600');
    return res.status(200).json({
      ...cached.data,
      meta: buildMeta('cache', { cached: true, cacheAgeMs: Date.now() - cached.ts }),
    });
  }

  try {
    const url = `${OPEN_METEO}?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=relative_humidity_2m&forecast_days=1&timezone=auto`;
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const json = await response.json();

    if (!response.ok || !json.current_weather) {
      throw new Error('Open-Meteo unavailable');
    }

    const cw = json.current_weather;
    const humidity = json.hourly?.relative_humidity_2m?.[0] ?? null;

    const data = {
      temp: Math.round(cw.temperature),
      feels_like: null,
      wind: Math.round(cw.windspeed),
      wind_dir: cw.winddirection,
      description: WMO_CODES[cw.weathercode] || 'Unknown',
      icon: weatherIcon(cw.weathercode),
      code: cw.weathercode,
      humidity,
      source: 'open-meteo',
      meta: buildMeta('live'),
    };

    cache.set(key, { ts: Date.now(), data });
    res.setHeader('Cache-Control', 'public, max-age=600');
    return res.status(200).json(data);
  } catch (err) {
    return res.status(200).json({
      error: err.message,
      fallback: true,
      temp: null,
      description: 'Weather unavailable',
      meta: buildMeta('degraded', {
        degraded: true,
        warning: 'Open-Meteo weather data unavailable',
      }),
    });
  }
}
