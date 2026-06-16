import { useState } from 'react';
import { useVisibilityPolling } from '../hooks/useVisibilityPolling';

export default function WeatherWidget({ t }) {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchWeather = async () => {
    try {
      const res = await fetch('/api/weather?city=Vancouver');
      const data = await res.json();
      setWeather(data);
      setLoading(false);
    } catch (err) {
      console.error('Weather fetch error:', err);
      setLoading(false);
    }
  };

  useVisibilityPolling(fetchWeather, 10 * 60 * 1000);

  if (loading) return null;
  if (!weather || weather.fallback) return null;

  const weatherLabel = (icon) => {
    if (icon.startsWith('01')) return 'SUN';
    if (icon.startsWith('02')) return 'PCLOUD';
    if (icon.startsWith('03') || icon.startsWith('04')) return 'CLOUD';
    if (icon.startsWith('09') || icon.startsWith('10')) return 'RAIN';
    if (icon.startsWith('11')) return 'STORM';
    if (icon.startsWith('13')) return 'SNOW';
    if (icon.startsWith('50')) return 'FOG';
    return 'FAIR';
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      fontSize: 11,
      color: t.textSecondary,
      padding: '4px 10px',
      background: t.glass,
      border: `0.5px solid ${t.border}`,
      borderRadius: 12,
    }}>
      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.04em' }}>{weatherLabel(weather.icon)}</span>
      <span style={{ fontWeight: 600 }}>{weather.temp}°C</span>
      <span style={{ opacity: 0.7 }}>{weather.city}</span>
    </div>
  );
}
