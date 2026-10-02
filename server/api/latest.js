import { get, list } from './_blob.js';
import { applyCors } from './_cors.js';
import { BLOB_PREFIX } from './stocks-shared.js';

export default async function handler(req, res) {
  applyCors(req, res);
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');

  try {
    // Find the blob by prefix (most recent cache)
    const { blobs } = await list({ prefix: BLOB_PREFIX });

    if (!blobs || blobs.length === 0) {
      console.warn('[LATEST] No cache blob found');
      return res.status(200).json({
        cached: false,
        data: null,
        message: 'Cache not available - cron job may not have run yet',
      });
    }

    // Read straight from KV. A Worker cannot fetch() its own custom domain
    // (Cloudflare answers 522), which is what killed this endpoint after Vercel.
    const blobUrl = blobs[0].url;
    const raw = await get(blobs[0].pathname);
    if (raw == null) throw new Error('Blob missing from KV');
    const data = JSON.parse(raw);

    return res.status(200).json({
      cached: true,
      data,
      blobAge: new Date() - new Date(data.updatedAt),
      blobUrl,
    });
  } catch (err) {
    console.error('[LATEST] Error:', err.message);
    return res.status(200).json({
      cached: false,
      data: null,
      error: err.message,
      timestamp: new Date().toISOString(),
    });
  }
}
