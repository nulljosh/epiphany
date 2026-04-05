import { applyCors } from './_cors.js';

export default async function handler(req, res) {
  applyCors(req, res);
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  return res.status(200).json({
    cached: false,
    data: null,
    message: 'Blob cache disabled -- BLOB_READ_WRITE_TOKEN not configured',
  });
}
