import { useEffect, useMemo, useState } from 'react';

const DEFAULT_THEME = {
  text: '#f5f5f7',
  textSecondary: '#a1a1aa',
  textTertiary: '#71717a',
  border: 'rgba(255,255,255,0.15)',
  glass: 'rgba(255,255,255,0.06)',
  red: '#ff453a',
  green: '#30d158',
};

function formatAmount(amount) {
  const value = Number(amount) || 0;
  return value.toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const EDITABLE_CATEGORIES = [
  'food', 'shopping', 'tech', 'apps', 'transit', 'gas', 'pets', 'laundry',
  'fitness', 'entertainment', 'auto', 'services', 'transfers', 'vape',
  'alcohol', 'cannabis', 'housing', 'utilities', 'health', 'insurance',
  'subscriptions', 'other', 'uncategorized',
].sort();

function transactionId(txn) {
  return `${txn?.date}|${txn?.description}|${txn?.amount}`;
}

export default function Statements({ theme, t: themeProp }) {
  const t = useMemo(() => ({ ...DEFAULT_THEME, ...(themeProp || theme || {}) }), [theme, themeProp]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statements, setStatements] = useState([]);
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    let active = true;

    const fetchStatements = async () => {
      setLoading(true);
      setError('');

      try {
        const res = await fetch('/api/statements');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        if (!active) return;

        const files = Array.isArray(data?.statements) ? data.statements : [];
        setStatements(files);
      } catch (err) {
        if (!active) return;
        setError(err?.message || 'Failed to load statements');
        setStatements([]);
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchStatements();
    return () => {
      active = false;
    };
  }, []);

  const toggleExpanded = (filename) => {
    setExpanded((prev) => ({ ...prev, [filename]: !prev[filename] }));
  };

  const deleteStatement = async (statement) => {
    if (!statement.id) return;
    try {
      const res = await fetch(`/api/statements?action=delete&id=${encodeURIComponent(statement.id)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setStatements(Array.isArray(data?.statements) ? data.statements : []);
    } catch (err) {
      setError(err?.message || 'Failed to delete statement');
    }
  };

  const editTransactionCategory = async (statement, txn, category) => {
    if (!statement.id) return;
    try {
      const res = await fetch('/api/statements?action=edit-transaction', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: statement.id, transactionId: transactionId(txn), category }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setStatements(Array.isArray(data?.statements) ? data.statements : []);
    } catch (err) {
      setError(err?.message || 'Failed to update category');
    }
  };

  if (loading) {
    return <div style={{ color: t.textSecondary, fontSize: 12, padding: 12 }}>Loading statements...</div>;
  }

  if (error) {
    return <div style={{ color: t.red, fontSize: 12, padding: 12 }}>Error loading statements: {error}</div>;
  }

  if (!statements.length) {
    return <div style={{ color: t.textTertiary, fontSize: 12, padding: 12 }}>No statements found.</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {statements.map((statement) => {
        const isOpen = !!expanded[statement.filename];
        const transactions = Array.isArray(statement.transactions) ? statement.transactions : [];

        return (
          <div
            key={statement.id || statement.filename}
            style={{
              border: `0.5px solid ${t.border}`,
              borderRadius: 12,
              overflow: 'hidden',
              background: t.glass,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <button
                onClick={() => toggleExpanded(statement.filename)}
                style={{
                  flex: 1,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  border: 'none',
                  background: 'transparent',
                  color: t.text,
                  padding: '10px 12px',
                  fontSize: 12,
                  fontWeight: 600,
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                <span>{statement.filename}</span>
                <span style={{ color: t.textSecondary, fontWeight: 500 }}>
                  {transactions.length} transaction{transactions.length === 1 ? '' : 's'}
                </span>
              </button>
              {statement.id && (
                <button
                  onClick={() => deleteStatement(statement)}
                  title="Delete statement"
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: t.textTertiary,
                    padding: '10px 12px',
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  Delete
                </button>
              )}
            </div>

            {isOpen && (
              <div style={{ borderTop: `0.5px solid ${t.border}`, overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th style={{ padding: '8px 12px', textAlign: 'left', color: t.textSecondary, fontWeight: 600 }}>Date</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', color: t.textSecondary, fontWeight: 600 }}>Description</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', color: t.textSecondary, fontWeight: 600 }}>Category</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right', color: t.textSecondary, fontWeight: 600 }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.length > 0 ? (
                      transactions.map((txn, idx) => (
                        <tr key={`${statement.id || statement.filename}-${idx}`} style={{ borderTop: `0.5px solid ${t.border}` }}>
                          <td style={{ padding: '8px 12px', color: t.text }}>{txn.date}</td>
                          <td style={{ padding: '8px 12px', color: t.text }}>{txn.description}</td>
                          <td style={{ padding: '8px 12px', color: t.text }}>
                            {statement.id ? (
                              <select
                                value={txn.category || 'uncategorized'}
                                onChange={(e) => editTransactionCategory(statement, txn, e.target.value)}
                                style={{
                                  background: 'transparent',
                                  color: t.text,
                                  border: `0.5px solid ${t.border}`,
                                  borderRadius: 6,
                                  fontSize: 11,
                                  padding: '2px 4px',
                                }}
                              >
                                {EDITABLE_CATEGORIES.map((cat) => (
                                  <option key={cat} value={cat}>{cat}</option>
                                ))}
                              </select>
                            ) : (
                              txn.category || 'uncategorized'
                            )}
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', color: (txn.amount || 0) < 0 ? t.red : t.green, fontVariantNumeric: 'tabular-nums' }}>
                            {formatAmount(txn.amount)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="4" style={{ padding: '10px 12px', color: t.textTertiary }}>
                          No transactions parsed.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
