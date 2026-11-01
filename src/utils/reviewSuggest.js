// Two category suggestions for a statement row nothing could categorize: the categories most used by rows whose
// merchant text shares a word with this one, topped up with the most used categories overall.
// Mirrors ReviewQueueCard.suggestions in Shared/ReviewQueueCard.swift.
const NOISE = new Set(['the', 'and', 'inc', 'ltd', 'pos', 'purchase', 'visa', 'debit', 'credit', 'www', 'com', 'card', 'payment', 'store']);
export const merchantWords = (description = '') =>
  new Set(String(description).toLowerCase().split(/[^a-z]+/).filter((w) => w.length >= 3 && !NOISE.has(w)));

const counted = (rows) => {
  const n = {};
  for (const c of rows) n[c] = (n[c] || 0) + 1;
  return Object.entries(n).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).map(([c]) => c);
};

export function suggestCategories(txn, transactions = []) {
  const known = transactions.filter((t) => t?.category && t.category !== 'uncategorized');
  const mine = merchantWords(txn?.description);
  const near = counted(known.filter((t) => [...merchantWords(t.description)].some((w) => mine.has(w))).map((t) => t.category));
  const out = near.slice(0, 2);
  for (const c of counted(known.map((t) => t.category))) { if (out.length >= 2) break; if (!out.includes(c)) out.push(c); }
  return out;
}
