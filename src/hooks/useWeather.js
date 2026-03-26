import { useState, useEffect } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

const ICONS = {
  sun: '\u2600\uFE0F',
  partly: '\u26C5',
  cloud: '\u2601\uFE0F',
  fog: '\uD83C\uDF2B\uFE0F',
  drizzle: '\uD83C\uDF26\uFE0F',
  rain: '\uD83C\uDF27\uFE0F',
  snow: '\u2744\uFE0F',
  showers: '\uD83C\uDF26\uFE0F',
  storm: '\u26A1',
};

function getStoredGeo() {
  try {
    const raw = localStorage.getItem('monica_last_geo');
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (typeof p?.lat === 'number' && typeof p?.lon === 'number') return p;
  } catch {}
  return null;
}

export function useWeather() {
  const [weather, setWeather] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const fetchWeather = async () => {
      const geo = getStoredGeo();
      if (!geo) return;
      try {
        const res = await fetch(`${API_BASE}/api/weather?lat=${geo.lat}&lon=${geo.lon}`);
        const data = await res.json();
        if (!cancelled && !data.fallback) {
          setWeather({
            temp: data.temp,
            description: data.description,
            icon: ICONS[data.icon] || '',
            wind: data.wind,
          });
        }
      } catch {}
    };

    // Initial fetch after short delay (let geo resolve first)
    const t1 = setTimeout(fetchWeather, 2000);
    const id = setInterval(fetchWeather, 600000);
    return () => { cancelled = true; clearTimeout(t1); clearInterval(id); };
  }, []);

  return weather;
}
