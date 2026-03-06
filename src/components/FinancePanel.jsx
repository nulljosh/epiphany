import { useState, useRef, useCallback } from 'react';
import { Card } from './ui';
import { usePortfolio } from '../hooks/usePortfolio';
import { formatCurrency } from '../utils/formatting';

const TABS = ['portfolio', 'budget', 'debt', 'goals', 'spending'];

function PieChart({ data, size = 160, t }) {
  if (!data || data.length === 0) return null;
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total <= 0) return null;

  const colors = ['#0071e3', '#30D158', '#FF453A', '#FF9F0A', '#BF5AF2', '#64D2FF', '#FF375F', '#FFD60A'];
  let angle = 0;

  const slices = data.map((d, i) => {
    const pct = d.value / total;
    const startAngle = angle;
    angle += pct * 360;
    const endAngle = angle;
    const largeArc = pct > 0.5 ? 1 : 0;
    const r = size / 2 - 4;
    const cx = size / 2;
    const cy = size / 2;
    const startRad = (startAngle - 90) * Math.PI / 180;
    const endRad = (endAngle - 90) * Math.PI / 180;
    const x1 = cx + r * Math.cos(startRad);
    const y1 = cy + r * Math.sin(startRad);
    const x2 = cx + r * Math.cos(endRad);
    const y2 = cy + r * Math.sin(endRad);

    if (pct >= 0.999) {
      return <circle key={i} cx={cx} cy={cy} r={r} fill={colors[i % colors.length]} />;
    }

    return (
      <path
        key={i}
        d={`M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`}
        fill={colors[i % colors.length]}
        opacity={0.85}
      />
    );
  });

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {slices}
        <circle cx={size / 2} cy={size / 2} r={size / 2 - 30} fill={t.bg} />
        <text x={size / 2} y={size / 2 - 6} textAnchor="middle" fill={t.text} fontSize="14" fontWeight="700" fontFamily="-apple-system, system-ui, sans-serif">
          {formatCurrency(total)}
        </text>
        <text x={size / 2} y={size / 2 + 10} textAnchor="middle" fill={t.textTertiary} fontSize="9" fontFamily="-apple-system, system-ui, sans-serif">
          TOTAL
        </text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {data.map((d, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: colors[i % colors.length] }} />
            <span style={{ color: t.textSecondary }}>{d.label}</span>
            <span style={{ color: t.text, fontWeight: 600, marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(d.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProgressBar({ value, max, color, t }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div style={{ height: 6, background: t.glass, borderRadius: 3, overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.3s' }} />
    </div>
  );
}

function SpendingChart({ spending, t }) {
  if (!spending || spending.length === 0) return null;
  const maxTotal = Math.max(...spending.map(s => s.total));
  const W = 320, H = 140;
  const padding = { left: 40, right: 20, top: 20, bottom: 30 };
  const chartW = W - padding.left - padding.right;
  const chartH = H - padding.top - padding.bottom;

  const points = spending.map((s, i) => {
    const x = padding.left + (i / Math.max(1, spending.length - 1)) * chartW;
    const y = padding.top + (1 - s.total / maxTotal) * chartH;
    return { x, y, ...s };
  });

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaD = pathD + ` L ${points[points.length - 1].x} ${padding.top + chartH} L ${points[0].x} ${padding.top + chartH} Z`;

  const trendPct = spending.length >= 2
    ? ((spending[spending.length - 1].total - spending[0].total) / spending[0].total * 100).toFixed(0)
    : 0;

  return (
    <div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={t.green} stopOpacity="0.3" />
            <stop offset="100%" stopColor={t.green} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map(pct => (
          <line key={pct} x1={padding.left} y1={padding.top + pct * chartH} x2={W - padding.right} y2={padding.top + pct * chartH} stroke={t.border} strokeWidth="0.5" />
        ))}
        <path d={areaD} fill="url(#spendGrad)" />
        <path d={pathD} fill="none" stroke={t.green} strokeWidth="2" />
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="4" fill={t.green} />
            <text x={p.x} y={p.y - 8} textAnchor="middle" fill={t.text} fontSize="9" fontWeight="600" fontFamily="-apple-system, system-ui, sans-serif">
              ${p.total.toLocaleString()}
            </text>
            <text x={p.x} y={H - 6} textAnchor="middle" fill={t.textTertiary} fontSize="9" fontFamily="-apple-system, system-ui, sans-serif">
              {p.month.replace(' 20', " '")}
            </text>
          </g>
        ))}
        <text x={padding.left - 4} y={padding.top + 4} textAnchor="end" fill={t.textTertiary} fontSize="8" fontFamily="-apple-system, system-ui, sans-serif">
          ${maxTotal.toLocaleString()}
        </text>
        <text x={padding.left - 4} y={padding.top + chartH + 4} textAnchor="end" fill={t.textTertiary} fontSize="8" fontFamily="-apple-system, system-ui, sans-serif">
          $0
        </text>
      </svg>
      <div style={{ fontSize: 11, color: Number(trendPct) <= 0 ? t.green : t.red, fontWeight: 600, marginTop: 4 }}>
        {trendPct}% {Number(trendPct) <= 0 ? 'reduction' : 'increase'} ({spending[0].month} to {spending[spending.length - 1].month})
      </div>
    </div>
  );
}

export default function FinancePanel({ dark, t, stocks, isAuthenticated }) {
  const [tab, setTab] = useState('portfolio');
  const [importError, setImportError] = useState(null);
  const fileInputRef = useRef(null);

  const {
    holdings, accounts, budget, debt, goals, spending, giving,
    stocksValue, cashValue, totalDebt, totalIncome, totalExpenses,
    surplus, netWorth, isDemo, importData, exportData, resetToDemo,
  } = usePortfolio(stocks, isAuthenticated);

  const handleImport = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        const result = importData(data);
        if (!result.success) setImportError(result.error);
      } catch {
        setImportError('Invalid JSON file');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [importData]);

  const handleExport = useCallback(() => {
    const data = exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'opticon-portfolio.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [exportData]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (!file || !file.name.endsWith('.json')) return;
    setImportError(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        const result = importData(data);
        if (!result.success) setImportError(result.error);
      } catch {
        setImportError('Invalid JSON file');
      }
    };
    reader.readAsText(file);
  }, [importData]);

  const font = '-apple-system, BlinkMacSystemFont, system-ui, sans-serif';
  const sectionStyle = { padding: '16px 20px' };
  const labelStyle = { fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: t.textTertiary, marginBottom: 12 };
  const rowStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${t.border}` };

  const pieData = [
    ...holdings.filter(h => h.value > 0).map(h => ({ label: h.symbol, value: h.value })),
    ...accounts.filter(a => a.balance > 0).map(a => ({ label: a.name, value: a.balance })),
  ];

  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      style={{
        overflow: 'auto',
        height: '100%',
        fontFamily: font,
      }}
    >
      {/* Header */}
      <div style={{ padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${t.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: t.text, letterSpacing: '-0.3px' }}>Portfolio</span>
          {isDemo && <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: t.glass, color: t.textTertiary, fontWeight: 600 }}>DEMO</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={handleExport} style={{ background: t.glass, border: `1px solid ${t.border}`, borderRadius: 6, padding: '4px 8px', fontSize: 10, color: t.textSecondary, cursor: 'pointer', fontFamily: font }}>
            Export
          </button>
          <button onClick={() => fileInputRef.current?.click()} style={{ background: t.glass, border: `1px solid ${t.border}`, borderRadius: 6, padding: '4px 8px', fontSize: 10, color: t.textSecondary, cursor: 'pointer', fontFamily: font }}>
            Import
          </button>
          {!isDemo && (
            <button onClick={resetToDemo} style={{ background: t.glass, border: `1px solid ${t.border}`, borderRadius: 6, padding: '4px 8px', fontSize: 10, color: t.red, cursor: 'pointer', fontFamily: font }}>
              Reset
            </button>
          )}
        </div>
        <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} style={{ display: 'none' }} />
      </div>

      {importError && (
        <div style={{ margin: '8px 16px', padding: '8px 12px', background: 'rgba(255,69,58,0.15)', borderRadius: 8, fontSize: 11, color: t.red }}>
          Import error: {importError}
        </div>
      )}

      {/* Net Worth Hero */}
      <div style={{ padding: '16px 16px 12px' }}>
        <div style={{ fontSize: 11, color: t.textTertiary, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Net Worth</div>
        <div style={{ fontSize: 'clamp(28px, 6vw, 40px)', fontWeight: 700, color: netWorth >= 0 ? t.text : t.red, fontVariantNumeric: 'tabular-nums', letterSpacing: '-1.5px', lineHeight: 1 }}>
          {formatCurrency(netWorth)}
        </div>
        <div style={{ fontSize: 12, color: t.textSecondary, marginTop: 6, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <span>Stocks: {formatCurrency(stocksValue)}</span>
          <span>Cash: {formatCurrency(cashValue, 'CAD')}</span>
          <span style={{ color: t.red }}>Debt: -{formatCurrency(totalDebt)}</span>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, padding: '0 16px', marginBottom: 16, overflowX: 'auto' }}>
        {TABS.map(t2 => (
          <button
            key={t2}
            onClick={() => setTab(t2)}
            style={{
              padding: '6px 14px', borderRadius: 100, border: 'none', fontSize: 12, fontWeight: 600,
              fontFamily: font, cursor: 'pointer', whiteSpace: 'nowrap',
              background: tab === t2 ? t.text : t.glass,
              color: tab === t2 ? t.bg : t.textSecondary,
              transition: 'all 0.15s ease',
            }}
          >
            {t2.charAt(0).toUpperCase() + t2.slice(1)}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: '0 16px 80px', maxWidth: 700, margin: '0 auto' }}>

        {tab === 'portfolio' && (
          <>
            <Card dark={dark} t={t} style={{ marginBottom: 16, padding: 20 }}>
              <div style={labelStyle}>Holdings</div>
              <PieChart data={pieData} t={t} />
            </Card>

            <Card dark={dark} t={t} style={{ marginBottom: 16 }}>
              <div style={sectionStyle}>
                <div style={labelStyle}>Stocks</div>
                {holdings.map(h => (
                  <div key={h.symbol} style={rowStyle}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{h.symbol}</div>
                      <div style={{ fontSize: 11, color: t.textTertiary }}>{h.shares.toFixed(4)} shares @ {formatCurrency(h.costBasis)}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 600, fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(h.value)}</div>
                      <div style={{ fontSize: 11, color: h.gain >= 0 ? t.green : t.red, fontVariantNumeric: 'tabular-nums' }}>
                        {h.gain >= 0 ? '+' : ''}{formatCurrency(h.gain)} ({h.gainPercent >= 0 ? '+' : ''}{h.gainPercent.toFixed(1)}%)
                      </div>
                    </div>
                  </div>
                ))}
                <div style={{ ...rowStyle, borderBottom: 'none', fontWeight: 700, fontSize: 16 }}>
                  <span>Total</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(stocksValue)}</span>
                </div>
              </div>
            </Card>

            <Card dark={dark} t={t} style={{ marginBottom: 16 }}>
              <div style={sectionStyle}>
                <div style={labelStyle}>Cash Accounts</div>
                {accounts.map((a, i) => (
                  <div key={i} style={rowStyle}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{a.name}</div>
                      <div style={{ fontSize: 11, color: t.textTertiary }}>{a.type}</div>
                    </div>
                    <div style={{ fontWeight: 600, fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>
                      {formatCurrency(a.balance, a.currency)}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </>
        )}

        {tab === 'budget' && (
          <>
            <Card dark={dark} t={t} style={{ marginBottom: 16 }}>
              <div style={sectionStyle}>
                <div style={labelStyle}>Monthly Income</div>
                {budget.income.map((item, i) => (
                  <div key={i} style={rowStyle}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{item.name}</div>
                      {item.note && <div style={{ fontSize: 11, color: t.textTertiary }}>{item.note}</div>}
                    </div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: t.green, fontVariantNumeric: 'tabular-nums' }}>+{formatCurrency(item.amount)}</div>
                  </div>
                ))}
              </div>
            </Card>

            <Card dark={dark} t={t} style={{ marginBottom: 16 }}>
              <div style={sectionStyle}>
                <div style={labelStyle}>Monthly Expenses</div>
                {budget.expenses.map((item, i) => (
                  <div key={i} style={rowStyle}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{item.name}</div>
                      {item.note && <div style={{ fontSize: 11, color: t.textTertiary }}>{item.note}</div>}
                    </div>
                    <div style={{ fontWeight: 600, fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>-{formatCurrency(item.amount)}</div>
                  </div>
                ))}
                <div style={{ ...rowStyle, borderBottom: 'none', fontWeight: 700, fontSize: 16 }}>
                  <span>Surplus</span>
                  <span style={{ color: surplus >= 0 ? t.green : t.red, fontVariantNumeric: 'tabular-nums' }}>
                    {surplus >= 0 ? '+' : ''}{formatCurrency(surplus)}
                  </span>
                </div>
              </div>
            </Card>

            {giving.length > 0 && (
              <Card dark={dark} t={t} style={{ marginBottom: 16 }}>
                <div style={sectionStyle}>
                  <div style={labelStyle}>Giving</div>
                  {giving.map((g, i) => (
                    <div key={i} style={rowStyle}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14, opacity: g.active ? 1 : 0.5 }}>{g.name}</div>
                        {g.note && <div style={{ fontSize: 11, color: t.textTertiary }}>{g.note}</div>}
                      </div>
                      <div style={{ fontWeight: 600, fontSize: 14, fontVariantNumeric: 'tabular-nums', opacity: g.active ? 1 : 0.5 }}>
                        {formatCurrency(g.amount)}/mo
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </>
        )}

        {tab === 'debt' && (
          <>
            <Card dark={dark} t={t} style={{ marginBottom: 16 }}>
              <div style={sectionStyle}>
                <div style={labelStyle}>Outstanding Debt</div>
                {debt.map((d, i) => (
                  <div key={i} style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{d.name}</div>
                        {d.note && <div style={{ fontSize: 11, color: t.textTertiary }}>{d.note}</div>}
                      </div>
                      <div style={{ fontWeight: 600, fontSize: 14, color: t.red, fontVariantNumeric: 'tabular-nums' }}>
                        {formatCurrency(d.balance)}
                      </div>
                    </div>
                    <ProgressBar value={0} max={d.balance} color={t.red} t={t} />
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16, paddingTop: 12, borderTop: `1px solid ${t.border}`, fontWeight: 700, fontSize: 16 }}>
                  <span>Total Debt</span>
                  <span style={{ color: t.red, fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(totalDebt)}</span>
                </div>
              </div>
            </Card>

            {surplus > 0 && (
              <Card dark={dark} t={t} style={{ marginBottom: 16, padding: 20 }}>
                <div style={labelStyle}>Payoff Timeline</div>
                <div style={{ fontSize: 13, color: t.textSecondary }}>
                  At {formatCurrency(surplus)}/mo surplus: ~{Math.ceil(totalDebt / surplus)} months to debt-free
                </div>
                <div style={{ fontSize: 12, color: t.textTertiary, marginTop: 4 }}>
                  Target: {new Date(Date.now() + Math.ceil(totalDebt / surplus) * 30 * 86400000).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </div>
              </Card>
            )}
          </>
        )}

        {tab === 'goals' && (
          <Card dark={dark} t={t} style={{ marginBottom: 16 }}>
            <div style={sectionStyle}>
              <div style={labelStyle}>Goals</div>
              {goals.map((g, i) => {
                const pct = g.target > 0 ? (g.saved / g.target) * 100 : 0;
                const priorityColor = g.priority === 'high' ? t.red : g.priority === 'medium' ? t.orange : t.green;
                return (
                  <div key={i} style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 3, height: 20, borderRadius: 2, background: priorityColor }} />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{g.name}</div>
                          {g.note && <div style={{ fontSize: 11, color: t.textTertiary }}>{g.note}</div>}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 600, fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(g.target)}</div>
                        {g.deadline && <div style={{ fontSize: 10, color: t.textTertiary }}>{g.deadline}</div>}
                      </div>
                    </div>
                    <ProgressBar value={g.saved} max={g.target} color={priorityColor} t={t} />
                    <div style={{ fontSize: 10, color: t.textTertiary, marginTop: 2 }}>{pct.toFixed(0)}% saved</div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {tab === 'spending' && (
          <>
            <Card dark={dark} t={t} style={{ marginBottom: 16, padding: 20 }}>
              <div style={labelStyle}>Spending Trends</div>
              <SpendingChart spending={spending} t={t} />
            </Card>

            <Card dark={dark} t={t} style={{ marginBottom: 16 }}>
              <div style={sectionStyle}>
                <div style={labelStyle}>Monthly Breakdown</div>
                {spending.map((s, i) => (
                  <div key={i} style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, marginBottom: 6 }}>
                      <span>{s.month}</span>
                      <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(s.total)}</span>
                    </div>
                    {Object.entries(s.categories).sort((a, b) => b[1] - a[1]).map(([cat, amount]) => (
                      <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: t.textSecondary, padding: '2px 0' }}>
                        <span>{cat.charAt(0).toUpperCase() + cat.slice(1)}</span>
                        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(amount)} ({Math.round(amount / s.total * 100)}%)</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
