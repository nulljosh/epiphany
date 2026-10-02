import path from 'path';
import { access, readdir, readFile } from 'fs/promises';
import { promisify } from 'util';
import { execFile } from 'child_process';
import { parseStatementText, summarizeTransactions } from './statements-shared.js';

const execFileAsync = promisify(execFile);
const DEFAULT_STATEMENTS_DIR = path.join(process.env.HOME || '', 'Documents/Misc/statement/');

// unpdf is pdf.js packaged for serverless runtimes. pdf-parse's build hung on a
// cold Cloudflare isolate (the request never returned), which is why uploads
// broke after the move off Vercel. The race keeps a bad PDF from hanging a request.
const PARSE_TIMEOUT_MS = 12000;

async function parsePdfBuffer(buffer) {
  const { extractText, getDocumentProxy } = await import('unpdf');
  const work = (async () => {
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(pdf, { mergePages: true });
    return text || '';
  })();
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`PDF parse timed out after ${PARSE_TIMEOUT_MS}ms`)), PARSE_TIMEOUT_MS);
  });
  try {
    return await Promise.race([work, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export async function readPdfText(filePath) {
  try {
    const { stdout } = await execFileAsync('pdftotext', [filePath, '-'], { maxBuffer: 10 * 1024 * 1024 });
    if (stdout?.trim()) return stdout;
  } catch {
    // Fall through to unpdf below.
  }

  const buffer = await readFile(filePath);
  try {
    return await parsePdfBuffer(buffer);
  } catch (err) {
    console.warn(`[PDF] Failed to parse ${filePath}: ${err.message}`);
    return '';
  }
}

export async function summarizeStatementBuffer(buffer, filename, providedText = '') {
  let text = '';
  try {
    // Native clients extract the text themselves (PDFKit), so the Worker never parses.
    // PDFKit spaces columns differently, so if its text yields no rows, try our own pass.
    text = providedText.trim() ? providedText : await parsePdfBuffer(buffer);
    if (providedText.trim() && parseStatementText(text).length === 0) {
      text = await parsePdfBuffer(buffer);
    }
  } catch (err) {
    // A PDF the parser cannot read is still a statement worth keeping. Returning a
    // null spendingMonth here used to blow up the upload handler's dedupe
    // (`spendingMonth.month` on null -> 500), so the file was rejected outright
    // and its blob orphaned. Fall back to the empty summary, which already names
    // the month after the filename.
    console.warn(`[PDF] Failed to parse ${filename}: ${err.message}`);
    return { transactions: [], spendingMonth: summarizeTransactions([], filename) };
  }
  const transactions = parseStatementText(text);
  return {
    transactions,
    spendingMonth: summarizeTransactions(transactions, filename),
  };
}

export async function listStatements({ filename, statementsDir = DEFAULT_STATEMENTS_DIR } = {}) {
  const entries = await readdir(statementsDir, { withFileTypes: true });
  const pdfFiles = entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.pdf'))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
  const selectedFiles = filename ? pdfFiles.filter((name) => name === filename) : pdfFiles;

  return Promise.all(
    selectedFiles.map(async (name) => {
      try {
        const filePath = path.join(statementsDir, name);
        const text = await readPdfText(filePath);
        const transactions = parseStatementText(text);
        const spendingMonth = summarizeTransactions(transactions, name);
        return { filename: name, transactions, spendingMonth };
      } catch {
        return { filename: name, transactions: [], spendingMonth: null };
      }
    })
  );
}

export async function getStatementsPayload({ filename, statementsDir = DEFAULT_STATEMENTS_DIR } = {}) {
  try {
    await access(statementsDir);
    const statements = await listStatements({ filename, statementsDir });
    return {
      exists: true,
      path: statementsDir,
      statements,
    };
  } catch {
    return {
      exists: false,
      path: statementsDir,
      statements: [],
    };
  }
}
