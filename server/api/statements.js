import path from 'path';
import { readdir, readFile } from 'fs/promises';
import pdfParse from 'pdf-parse';
import { applyCors } from './_cors.js';

const STATEMENTS_DIR = path.join(process.env.HOME || '', 'Documents/Misc/statement/');
const TRANSACTION_REGEX = /(\d{1,2}\/\d{1,2}\/?\d{0,4})\s+(.+?)\s+\$?([\d,]+\.\d{2})/g;

function parseTransactions(text = '') {
  const transactions = [];
  let match;

  while ((match = TRANSACTION_REGEX.exec(text)) !== null) {
    const [, date, description, amountRaw] = match;
    const amount = Number.parseFloat(amountRaw.replace(/,/g, ''));

    transactions.push({
      date: date.trim(),
      description: description.trim(),
      amount: Number.isFinite(amount) ? amount : 0,
    });
  }

  return transactions;
}

export default async function handler(req, res) {
  applyCors(req, res);

  if (req.method !== 'GET') {
    return res.status(405).json({ statements: [] });
  }

  try {
    const entries = await readdir(STATEMENTS_DIR, { withFileTypes: true });
    const pdfFiles = entries
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.pdf'))
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b));

    const statements = await Promise.all(
      pdfFiles.map(async (filename) => {
        try {
          const filePath = path.join(STATEMENTS_DIR, filename);
          const buffer = await readFile(filePath);
          const parsed = await pdfParse(buffer);
          const transactions = parseTransactions(parsed?.text || '');

          return { filename, transactions };
        } catch {
          return { filename, transactions: [] };
        }
      })
    );

    return res.status(200).json({ statements });
  } catch {
    return res.status(200).json({ statements: [] });
  }
}
