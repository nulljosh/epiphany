import { put, del, get as getBlob } from '@vercel/blob';
import { applyCors } from './_cors.js';
import { getStatementsPayload, summarizeStatementBuffer } from './statements-data.js';
import { getKv } from './_kv.js';
import { getSessionUser, errorResponse } from './auth-helpers.js';
import { checkRateLimit } from './_ratelimit.js';
import { summarizeTransactions } from './statements-shared.js';

function transactionId(txn) {
  return `${txn?.date}|${txn?.description}|${txn?.amount}`;
}

function safeName(name = 'statement.pdf') {
  return name.replace(/[^a-zA-Z0-9._-]/g, '-');
}

// Was 4MB, forced by KV's value ceiling. Blob's practical limit is far higher;
// 25MB is a sanity bound on a scanned PDF, not a storage constraint.
const MAX_STATEMENT_BYTES = 25 * 1024 * 1024;

// ponytail: statements live in Blob, not KV. KV rejected values over ~4MB, which
// is why both the web and native clients carried a hard 4MB guard and why a
// perfectly ordinary bank PDF could fail with a 502. Blob has no such cliff.
//
// access:'private' is NOT optional here — these are bank statements. Avatars use
// access:'public' because a public avatar URL is harmless; a public statement URL
// is a data breach. Reading one back requires the store token (see readStatementBuffer).
async function putStatementBlob(userId, recordId, buffer) {
  const blob = await put(`statements/${userId}/${recordId}.pdf`, buffer, {
    access: 'private',
    contentType: 'application/pdf',
    addRandomSuffix: false,
  });
  return blob.url;
}

// Reads a stored statement back for re-parsing. Falls back to the legacy
// KV base64 copy so statements uploaded before this migration still open.
async function readStatementBuffer(kv, statement) {
  if (statement?.blobUrl) {
    const result = await getBlob(statement.blobUrl, { access: 'private' });
    if (!result?.stream) return null;
    const chunks = [];
    for await (const chunk of result.stream) chunks.push(chunk);
    return Buffer.concat(chunks);
  }
  const storedFile = await kv.get(`statement-file:${statement.id}`);
  if (!storedFile?.contentBase64) return null;
  return Buffer.from(storedFile.contentBase64, 'base64');
}

async function refreshStoredStatements(kv, statements) {
  if (!Array.isArray(statements) || statements.length === 0) return [];

  const refreshed = await Promise.all(
    statements.map(async (statement) => {
      // Skip re-parsing if spendingMonth and transactions already exist
      if (statement?.spendingMonth?.month && statement?.spendingMonth?.total != null && Array.isArray(statement?.transactions) && statement.transactions.length > 0) {
        return statement;
      }
      try {
        const buffer = await readStatementBuffer(kv, statement);
        if (!buffer) return statement;

        const { spendingMonth, transactions } = await summarizeStatementBuffer(buffer, statement.filename);
        return { ...statement, spendingMonth, transactions: transactions || [] };
      } catch {
        // Don't let one bad statement kill the entire list
        return statement;
      }
    })
  );

  return refreshed.sort((a, b) => String(a?.spendingMonth?.sortKey || '').localeCompare(String(b?.spendingMonth?.sortKey || '')));
}

export default async function handler(req, res) {
  applyCors(req, res);

  try {
    const session = await getSessionUser(req);
    if (!session) {
      return errorResponse(res, 401, 'Authentication required');
    }

    const kv = await getKv();
    const statementsKey = `statements:${session.userId}`;
    const action = req.query?.action || 'list';

    if (req.method === 'GET' && action === 'scan-local') {
      if (process.env.VERCEL) {
        return errorResponse(res, 404, 'Not found');
      }
      const requested = typeof req.query?.filename === 'string' ? req.query.filename : '';
      const payload = await getStatementsPayload({ filename: requested });
      return res.status(200).json(payload);
    }

    if (req.method === 'GET') {
      const statements = await kv.get(statementsKey);
      console.log(`[STATEMENTS] KV get for ${statementsKey}: type=${typeof statements}, isArray=${Array.isArray(statements)}, length=${Array.isArray(statements) ? statements.length : 'N/A'}`);
      const storedStatements = Array.isArray(statements) ? statements : [];
      const refreshed = await refreshStoredStatements(kv, storedStatements);

      if (JSON.stringify(refreshed) !== JSON.stringify(storedStatements)) {
        await kv.set(statementsKey, refreshed);
      }

      return res.status(200).json({ statements: refreshed });
    }

    if (req.method === 'POST' && action === 'upload') {
      if (!(await checkRateLimit(req, { prefix: 'rl:statements', max: 20 }))) {
        return errorResponse(res, 429, 'Too many requests');
      }
      const filename = typeof req.body?.filename === 'string' ? req.body.filename : '';
      const contentBase64 = typeof req.body?.contentBase64 === 'string' ? req.body.contentBase64 : '';

      if (!filename || !contentBase64) {
        return errorResponse(res, 400, 'filename and contentBase64 are required');
      }

      const buffer = Buffer.from(contentBase64, 'base64');
      if (buffer.length > MAX_STATEMENT_BYTES) {
        return errorResponse(res, 400, 'Statement too large (max 25MB)');
      }
      const { spendingMonth, transactions } = await summarizeStatementBuffer(buffer, filename);
      const statements = await kv.get(statementsKey);
      const recordId = `${session.userId}:${Date.now()}:${safeName(filename)}`;

      let blobUrl;
      try {
        blobUrl = await putStatementBlob(session.userId, safeName(recordId), buffer);
      } catch (blobErr) {
        return errorResponse(res, 502, `Could not store statement: ${blobErr?.message || 'unknown error'}`);
      }

      const nextRecord = {
        id: recordId,
        filename,
        uploadedAt: new Date().toISOString(),
        blobUrl,
        spendingMonth,
        transactions: transactions || [],
      };
      const nextStatements = [...(Array.isArray(statements) ? statements : [])]
        .filter((item) => item?.spendingMonth?.month !== spendingMonth.month)
        .concat(nextRecord)
        .sort((a, b) => String(a?.spendingMonth?.sortKey || a?.spendingMonth?.month || '').localeCompare(String(b?.spendingMonth?.sortKey || b?.spendingMonth?.month || '')));

      // Only the metadata list goes to KV now — small, well under any limit.
      await kv.set(statementsKey, nextStatements);

      return res.status(200).json({ ok: true, statement: nextRecord, statements: nextStatements });
    }

    if (req.method === 'DELETE' && action === 'delete') {
      const id = typeof req.query?.id === 'string' ? req.query.id : '';
      if (!id) return errorResponse(res, 400, 'id is required');

      const statements = await kv.get(statementsKey);
      const existing = (Array.isArray(statements) ? statements : []).find((item) => item?.id === id);
      const nextStatements = (Array.isArray(statements) ? statements : []).filter((item) => item?.id !== id);
      await kv.set(statementsKey, nextStatements);
      // Both paths run: new records have a blob, pre-migration ones a KV copy.
      if (existing?.blobUrl) {
        try { await del(existing.blobUrl); } catch { /* orphan blob beats a failed delete */ }
      }
      await kv.del(`statement-file:${id}`);

      return res.status(200).json({ ok: true, statements: nextStatements });
    }

    if (req.method === 'PATCH' && action === 'edit-transaction') {
      const id = typeof req.body?.id === 'string' ? req.body.id : '';
      const txnId = typeof req.body?.transactionId === 'string' ? req.body.transactionId : '';
      const category = typeof req.body?.category === 'string' ? req.body.category : '';
      if (!id || !txnId || !category) {
        return errorResponse(res, 400, 'id, transactionId and category are required');
      }

      const statements = await kv.get(statementsKey);
      const list = Array.isArray(statements) ? statements : [];
      const index = list.findIndex((item) => item?.id === id);
      if (index === -1) return errorResponse(res, 404, 'Statement not found');

      const statement = list[index];
      const nextTransactions = (statement.transactions || []).map((txn) =>
        transactionId(txn) === txnId ? { ...txn, category } : txn
      );
      const nextStatement = {
        ...statement,
        transactions: nextTransactions,
        spendingMonth: summarizeTransactions(nextTransactions, statement.filename),
      };
      const nextStatements = [...list];
      nextStatements[index] = nextStatement;
      await kv.set(statementsKey, nextStatements);

      return res.status(200).json({ ok: true, statement: nextStatement, statements: nextStatements });
    }

    return errorResponse(res, 405, 'Method not allowed');
  } catch (err) {
    console.error('[STATEMENTS] Unhandled error:', err?.message || err);
    return res.status(500).json({ error: 'Internal server error', statements: [] });
  }
}
