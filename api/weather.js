// OpenWeatherMap API proxy
const WEATHER_API_BASE = 'https://api.openweathermap.org/data/2.5';

export default async function handler(req, res) {
  const apiKey = process.env.OPENWEATHER_API_KEY;

  if (!apiKey) {
    res.status(200).json({
      error: 'OPENWEATHER_API_KEY not configured',
      fallback: true,
      temp: null,
      description: 'Weather unavailable'
    });
    return;
  }

  const { city = 'Vancouver', units = 'metric' } = req.query;

  try {
    const url = `${WEATHER_API_BASE}/weather?q=${encodeURIComponent(city)}&units=${units}&appid=${apiKey}`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Bread/1.0',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Weather API error');
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 's-maxage=600'); // Cache for 10 minutes
    res.status(200).json({
      temp: Math.round(data.main?.temp || 0),
      feels_like: Math.round(data.main?.feels_like || 0),
      description: data.weather?.[0]?.description || 'Unknown',
      icon: data.weather?.[0]?.icon || '01d',
      humidity: data.main?.humidity || 0,
      wind: data.wind?.speed || 0,
      city: data.name || city,
    });
  } catch (error) {
    res.status(200).json({
      error: error.message,
      fallback: true,
      temp: null,
      description: 'Weather unavailable'
    });
  }
}
