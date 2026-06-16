const DEFAULT_API_WORKER_ORIGIN = 'https://monica-api.trommatic.workers.dev';

function buildProxyRequest(request, targetOrigin) {
  const incomingUrl = new URL(request.url);
  const proxyUrl = new URL(`${incomingUrl.pathname}${incomingUrl.search}`, targetOrigin);
  const headers = new Headers(request.headers);
  headers.delete('host');

  return new Request(proxyUrl.toString(), {
    method: request.method,
    headers,
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
    redirect: 'manual',
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/')) {
      const targetOrigin = env.API_WORKER_ORIGIN || DEFAULT_API_WORKER_ORIGIN;
      return fetch(buildProxyRequest(request, targetOrigin));
    }

    return env.ASSETS.fetch(request);
  },
};
