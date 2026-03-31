import { applyCors } from './_cors.js';
import { list } from '@vercel/blob';
import { isMarketHours } from './stocks-shared.js';

export default async function handler(req, res) {
  applyCors(req, res);
  if (isMarketHours()) {
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
  } else {
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  }

  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return res.status(200).json({
        cached: false,
        data: null,
        message: 'BLOB_READ_WRITE_TOKEN not configured'
      });
    }

    // Find the blob by prefix (most recent cache)
    const { blobs } = await list({ prefix: 'rise-cache/results.json' });

    if (!blobs || blobs.length === 0) {
      console.warn('[LATEST] No cache blob found');
      return res.status(200).json({ 
        cached: false, 
        data: null,
        message: 'Cache not available - cron job may not have run yet'
      });
    }

    // Fetch the blob content with timeout
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
    console.log(`[LATEST] Blob retrieved, age: ${new Date() - new Date(data.updatedAt)}ms`);

    res.status(200).json({ 
      cached: true, 
      data,
      blobAge: new Date() - new Date(data.updatedAt),
      blobUrl,
    });
  } catch (err) {
    console.error('[LATEST] Error:', err.message);
    res.status(200).json({ 
      cached: false, 
      data: null, 
      error: err.message,
      timestamp: new Date().toISOString(),
    });
  }
}
