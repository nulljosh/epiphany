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
            key={statement.filename}
            style={{
              border: `0.5px solid ${t.border}`,
              borderRadius: 12,
              overflow: 'hidden',
              background: t.glass,
            }}
          >
            <button
              onClick={() => toggleExpanded(statement.filename)}
              style={{
                width: '100%',
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

            {isOpen && (
              <div style={{ borderTop: `0.5px solid ${t.border}`, overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th style={{ padding: '8px 12px', textAlign: 'left', color: t.textSecondary, fontWeight: 600 }}>Date</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', color: t.textSecondary, fontWeight: 600 }}>Description</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right', color: t.textSecondary, fontWeight: 600 }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.length > 0 ? (
                      transactions.map((txn, idx) => (
                        <tr key={`${statement.filename}-${idx}`} style={{ borderTop: `0.5px solid ${t.border}` }}>
                          <td style={{ padding: '8px 12px', color: t.text }}>{txn.date}</td>
                          <td style={{ padding: '8px 12px', color: t.text }}>{txn.description}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', color: (txn.amount || 0) < 0 ? t.red : t.green, fontVariantNumeric: 'tabular-nums' }}>
                            {formatAmount(txn.amount)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="3" style={{ padding: '10px 12px', color: t.textTertiary }}>
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
