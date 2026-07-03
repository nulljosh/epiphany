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

async function refreshStoredStatements(kv, statements) {
  if (!Array.isArray(statements) || statements.length === 0) return [];

  const refreshed = await Promise.all(
    statements.map(async (statement) => {
      // Skip re-parsing if spendingMonth and transactions already exist
      if (statement?.spendingMonth?.month && statement?.spendingMonth?.total != null && Array.isArray(statement?.transactions) && statement.transactions.length > 0) {
        return statement;
      }
      try {
        const storedFile = await kv.get(`statement-file:${statement.id}`);
        if (!storedFile?.contentBase64) return statement;

        const buffer = Buffer.from(storedFile.contentBase64, 'base64');
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
      const { spendingMonth, transactions } = await summarizeStatementBuffer(buffer, filename);
      const statements = await kv.get(statementsKey);
      const nextRecord = {
        id: `${session.userId}:${Date.now()}:${safeName(filename)}`,
        filename,
        uploadedAt: new Date().toISOString(),
        spendingMonth,
        transactions: transactions || [],
      };
      const nextStatements = [...(Array.isArray(statements) ? statements : [])]
        .filter((item) => item?.spendingMonth?.month !== spendingMonth.month)
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

    if (req.method === 'DELETE' && action === 'delete') {
      const id = typeof req.query?.id === 'string' ? req.query.id : '';
      if (!id) return errorResponse(res, 400, 'id is required');

      const statements = await kv.get(statementsKey);
      const nextStatements = (Array.isArray(statements) ? statements : []).filter((item) => item?.id !== id);
      await kv.set(statementsKey, nextStatements);
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
