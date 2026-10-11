// Storage for watchlists, alerts and portfolio history: the spark-api Worker (D1) at api.jaybulb.com.
// Server to server only, so every call carries the service key; the handlers check the session before they get here.
function getSparkConfig() {
  const url = (process.env.SPARK_API_URL || 'https://api.jaybulb.com').trim();
  const key = (process.env.SPARK_SERVICE_KEY || '').trim();
  return { url, key };
}

// path is the PostgREST-style table path the handlers already use: `watchlists?user_email=eq.x&select=*`
export async function sparkRequest(path, { method = 'GET', body } = {}) {
  const { url, key } = getSparkConfig();
  if (!key) throw new Error('spark_not_configured');

  const res = await fetch(`${url}/rest/${path}`, {
    method,
    headers: {
      'x-service-key': key,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try { data = await res.json(); } catch { data = null; }

  if (!res.ok) {
    const err = new Error((data && (data.error || data.message)) || `spark_http_${res.status}`);
    err.status = res.status;
    throw err;
  }

  return data;
}

export function sparkConfigured() {
  return !!getSparkConfig().key;
}
