import { applyCors } from './_cors.js';
import { getStatementsPayload, summarizeStatementBuffer } from './statements-data.js';
import { getKv } from './_kv.js';
import { getSessionUser, errorResponse } from './auth-helpers.js';

function safeName(name = 'statement.pdf') {
  return name.replace(/[^a-zA-Z0-9._-]/g, '-');
}

async function refreshStoredStatements(kv, statements) {
  if (!Array.isArray(statements) || statements.length === 0) return [];

  const refreshed = await Promise.all(
    statements.map(async (statement) => {
      // Skip re-parsing if spendingMonth already exists and is valid
      if (statement?.spendingMonth?.month && statement?.spendingMonth?.total != null) {
        return statement;
      }
      try {
        const storedFile = await kv.get(`statement-file:${statement.id}`);
        if (!storedFile?.contentBase64) return statement;

        const buffer = Buffer.from(storedFile.contentBase64, 'base64');
        const { spendingMonth } = await summarizeStatementBuffer(buffer, statement.filename);
        return { ...statement, spendingMonth };
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
      const requested = typeof req.query?.filename === 'string' ? req.query.filename : '';
      const requestedDir = typeof req.query?.dir === 'string' ? req.query.dir : undefined;
      const payload = await getStatementsPayload({ filename: requested, statementsDir: requestedDir });
      return res.status(200).json(payload);
    }

    if (req.method === 'GET') {
      const statements = await kv.get(statementsKey);
      const storedStatements = Array.isArray(statements) ? statements : [];
      const refreshed = await refreshStoredStatements(kv, storedStatements);

      if (JSON.stringify(refreshed) !== JSON.stringify(storedStatements)) {
        await kv.set(statementsKey, refreshed);
      }

      return res.status(200).json({ statements: refreshed });
    }

    if (req.method === 'POST' && action === 'upload') {
      const filename = typeof req.body?.filename === 'string' ? req.body.filename : '';
      const contentBase64 = typeof req.body?.contentBase64 === 'string' ? req.body.contentBase64 : '';

      if (!filename || !contentBase64) {
        return errorResponse(res, 400, 'filename and contentBase64 are required');
      }

      const buffer = Buffer.from(contentBase64, 'base64');
      const { spendingMonth } = await summarizeStatementBuffer(buffer, filename);
      const statements = await kv.get(statementsKey);
      const nextRecord = {
        id: `${session.userId}:${Date.now()}:${safeName(filename)}`,
        filename,
        uploadedAt: new Date().toISOString(),
        spendingMonth,
      };
      const nextStatements = [...(Array.isArray(statements) ? statements : [])]
        .filter((item) => item.filename !== filename && item?.spendingMonth?.month !== spendingMonth.month)
        .concat(nextRecord)
        .sort((a, b) => String(a?.spendingMonth?.sortKey || a?.spendingMonth?.month || '').localeCompare(String(b?.spendingMonth?.sortKey || b?.spendingMonth?.month || '')));

      await kv.set(`statement-file:${nextRecord.id}`, {
        filename,
        contentBase64,
        uploadedAt: nextRecord.uploadedAt,
      });
      await kv.set(statementsKey, nextStatements);

      return res.status(200).json({ ok: true, statement: nextRecord, statements: nextStatements });
    }

    return errorResponse(res, 405, 'Method not allowed');
  } catch (err) {
    console.error('[STATEMENTS] Unhandled error:', err?.message || err);
    return res.status(500).json({ error: 'Internal server error', statements: [] });
  }
}
