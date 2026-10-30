// The review queue: statement rows nothing could categorize. Picking a category teaches the merchant
// for every statement (the server learns a rule); "Mark all reviewed" waves the rest through.
import { formatCurrency } from '../utils/formatting';

const EDITABLE_CATEGORIES = [
  'food', 'groceries', 'coffee', 'pharmacy', 'shopping', 'tech', 'apps',
  'transit', 'gas', 'pets', 'laundry',
  'fitness', 'entertainment', 'auto', 'services', 'transfers', 'vape',
  'alcohol', 'cannabis', 'housing', 'utilities', 'health', 'insurance',
  'subscriptions', 'other', 'uncategorized',
].sort();

// Mirrors needsReview in server/api/statements-shared.js.
const needsReview = (txn) => (!txn?.category || txn.category === 'uncategorized') && !txn?.reviewed;
const transactionId = (txn) => `${txn?.date}|${txn?.description}|${txn?.amount}`;

async function patch(action, body) {
  const res = await fetch(`/api/statements?action=${action}`, {
    method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

export default function ReviewQueue({ statements = [], onChanged, t }) {
  const queue = statements.flatMap((statement) => (statement.transactions || []).filter(needsReview).map((txn) => ({ statement, txn })));
  if (!queue.length) return null;
  const run = (action, body) => patch(action, body).then(onChanged).catch(() => {});

  return (
    <div style={{ marginBottom: 16, border: `0.5px solid ${t.border}`, borderRadius: 12, padding: '12px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>{queue.length} to review</span>
        <button onClick={() => run('mark-reviewed', {})} style={{ border: 'none', background: 'transparent', color: t.textSecondary, fontSize: 12, cursor: 'pointer', padding: 0 }}>
          Mark all reviewed
        </button>
      </div>
      {queue.slice(0, 5).map(({ statement, txn }) => (
        <div key={`${statement.id}-${transactionId(txn)}`} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderTop: `0.5px solid ${t.border}`, fontSize: 12 }}>
          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{txn.description}</span>
          <span style={{ color: t.textSecondary, fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(Math.abs(txn.amount))}</span>
          <select
            value="uncategorized"
            onChange={(e) => run('edit-transaction', { id: statement.id, transactionId: transactionId(txn), category: e.target.value })}
            aria-label={`Category for ${txn.description}`}
            style={{ background: 'transparent', color: t.text, border: `0.5px solid ${t.border}`, borderRadius: 6, padding: '2px 6px', fontSize: 12 }}
          >
            {EDITABLE_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
        </div>
      ))}
      <div style={{ fontSize: 11, color: t.textTertiary, marginTop: 4 }}>A category you pick applies to that merchant in every statement.</div>
    </div>
  );
}
