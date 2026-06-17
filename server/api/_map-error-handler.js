// Wrap map data handlers to catch uncaught errors and return 503
export function withMapErrorHandler(handler) {
  return async (req, res) => {
    try {
      return await handler(req, res);
    } catch (err) {
      console.error(`[MAP] Uncaught error in ${req.url}:`, err.message, err.stack);
      return res.status(503).json({
        error: 'Service temporarily unavailable',
        meta: { status: 'error', degraded: true },
      });
    }
  };
}
