const LOCAL_DEV_ORIGINS = new Set([
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
]);

function getAllowedOrigins() {
  const configured = (process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map(v => v.trim())
    .filter(Boolean);

  const vercelOrigin = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null;
  return new Set([...configured, ...(vercelOrigin ? [vercelOrigin] : []), ...LOCAL_DEV_ORIGINS]);
}

export function applyCors(req, res, { methods = 'GET, OPTIONS', headers = 'Content-Type' } = {}) {
  const requestOrigin = req?.headers?.origin;
  const allowedOrigins = getAllowedOrigins();

  if (requestOrigin && allowedOrigins.has(requestOrigin)) {
    res.setHeader('Access-Control-Allow-Origin', requestOrigin);
    res.setHeader('Vary', 'Origin');
  } else if (!requestOrigin && allowedOrigins.size > 0) {
    // Non-browser requests may omit Origin; expose a reviewed default instead of wildcard.
    res.setHeader('Access-Control-Allow-Origin', [...allowedOrigins][0]);
  }

  res.setHeader('Access-Control-Allow-Methods', methods);
  res.setHeader('Access-Control-Allow-Headers', headers);
}
