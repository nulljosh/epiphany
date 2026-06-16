import { list } from '@vercel/blob';
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

    // Fetch the blob content with a hard timeout
    const blobUrl = blobs[0].url;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    console.log(`[LATEST] Fetching blob: ${blobs[0].pathname}`);
    const response = await fetch(blobUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Blob fetch returned HTTP ${response.status}`);
    }

    const data = await response.json();

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
