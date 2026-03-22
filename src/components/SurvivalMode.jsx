import { useState, useEffect, useRef } from 'react';
import { usePolymarket } from '../hooks/usePolymarket';

// Kelly Criterion: f = (bp - q) / b
// f = fraction to bet, b = odds, p = win probability, q = 1-p
function calculateKelly(odds, winProb, fractional = 0.25) {
  const b = odds - 1;
  const p = winProb;
  const q = 1 - p;
  const kelly = (b * p - q) / b;
  return Math.max(0, Math.min(kelly * fractional, 0.1)); // Cap at 10%
}

// Edge detection: compare market odds to implied probability
function detectEdge(market) {
  // Simplified: Look for markets with >90% probability (implied edge vs 50/50)
  const yesProb = parseFloat(market.outcomePrices?.[0]) || 0;
  const noProb = parseFloat(market.outcomePrices?.[1]) || 0;
  
  const edge = Math.max(yesProb, noProb) - 0.5; // Edge over coin flip
  const side = yesProb > noProb ? 'YES' : 'NO';
  const prob = Math.max(yesProb, noProb);
  
  return { edge, side, prob, hasEdge: edge > 0.4 }; // >90% = edge
}

export default function SurvivalMode() {
  const [balance, setBalance] = useState(50.00);
  const [initialBalance] = useState(50.00);
  const [trades, setTrades] = useState([]);
  const [log, setLog] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [apiCostPerDay] = useState(2.89); // From tweet
  const [startTime, setStartTime] = useState(null);
  
  const { markets, loading } = usePolymarket();
  const logRef = useRef(null);
  
  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [log]);
  
  const addLog = (message) => {
    const timestamp = startTime 
      ? `[${Math.floor((Date.now() - startTime) / 1000)}s]`
      : '[--]';
    setLog(prev => [...prev, `${timestamp} ${message}`]);
  };
  
  const startAgent = () => {
    setIsRunning(true);
    setStartTime(Date.now());
    addLog(`agent started, balance: $${balance.toFixed(2)}`);
    addLog('connecting to Polymarket...');
    addLog('strategy: edge detection + fractional Kelly...');
  };
  
  const stopAgent = () => {
    setIsRunning(false);
    addLog('agent stopped by user');
  };
  
  // Scan for edges
  useEffect(() => {
    if (!isRunning || loading || !markets.length) return;
    
    const interval = setInterval(() => {
      // Find markets with edges
      const opportunities = markets
        .map(m => ({ ...m, ...detectEdge(m) }))
        .filter(m => m.hasEdge)
        .sort((a, b) => b.edge - a.edge)
        .slice(0, 3); // Top 3
      
      if (opportunities.length > 0) {
        const opp = opportunities[0];
        const kellyFraction = calculateKelly(opp.prob / (1 - opp.prob), opp.prob);
        const betSize = balance * kellyFraction;
        
        if (betSize > 0.01) {
          addLog(`edge detected: ${opp.question.slice(0, 40)}... (${(opp.edge * 100).toFixed(1)}% edge)`);
          addLog(`Kelly suggests ${(kellyFraction * 100).toFixed(1)}% bet ($${betSize.toFixed(2)} on ${opp.side})`);
          
          // Simulate trade (50% win for demo)
          const win = Math.random() > 0.5;
          const payout = win ? betSize * (opp.prob / (1 - opp.prob)) : -betSize;
          
          setBalance(prev => prev + payout);
          setTrades(prev => [...prev, {
            market: opp.question,
            side: opp.side,
            size: betSize,
            payout,
            win,
            time: Date.now()
          }]);
          
          addLog(`trade executed: ${win ? 'WIN' : 'LOSS'} ${win ? '+' : ''}$${payout.toFixed(2)}`);
        }
      }
    }, 10000); // Scan every 10s
    
    return () => clearInterval(interval);
  }, [isRunning, markets, loading, balance]);
  
  // Calculate metrics
  const pnl = balance - initialBalance;
  const pnlPercent = ((pnl / initialBalance) * 100).toFixed(1);
  const wins = trades.filter(t => t.win).length;
  const losses = trades.filter(t => !t.win).length;
  const winRate = trades.length > 0 ? ((wins / trades.length) * 100).toFixed(1) : '--';
  const runway = balance / apiCostPerDay;
  const uptime = startTime ? Math.floor((Date.now() - startTime) / 1000) : 0;
  const uptimeStr = `${Math.floor(uptime / 3600).toString().padStart(2, '0')}:${Math.floor((uptime % 3600) / 60).toString().padStart(2, '0')}:${(uptime % 60).toString().padStart(2, '0')}`;
  
  return (
    <div style={{ 
      background: '#0a0a0a', 
      color: '#0f0', 
      fontFamily: 'monospace',
      padding: '20px',
      minHeight: '100vh'
    }}>
      {/* Header */}
      <div style={{ borderBottom: '1px solid #0f0', paddingBottom: '10px', marginBottom: '20px' }}>
        <h1 style={{ margin: 0, fontSize: '20px' }}>
          BREAD / SURVIVAL MODE {isRunning ? '🟢 ALIVE' : '⚪️ IDLE'}
        </h1>
        <div style={{ display: 'flex', gap: '20px', marginTop: '10px', fontSize: '14px' }}>
          <span>Uptime <strong>{uptimeStr}</strong></span>
          <span>Trades <strong>{trades.length}</strong></span>
          <span>Markets Scanned <strong>{markets.length}</strong></span>
        </div>
      </div>
      
      {/* Metrics Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '20px' }}>
        <div>
          <div style={{ opacity: 0.7, fontSize: '12px' }}>CURRENT BALANCE</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold' }}>${balance.toFixed(2)}</div>
          <div style={{ fontSize: '12px', opacity: 0.5 }}>Initial: ${initialBalance.toFixed(2)}</div>
        </div>
        
        <div>
          <div style={{ opacity: 0.7, fontSize: '12px' }}>TOTAL P&L</div>
          <div style={{ 
            fontSize: '24px', 
            fontWeight: 'bold',
            color: pnl >= 0 ? '#0f0' : '#f00'
          }}>
            {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
          </div>
          <div style={{ fontSize: '12px', opacity: 0.5 }}>{pnlPercent}%</div>
        </div>
        
        <div>
          <div style={{ opacity: 0.7, fontSize: '12px' }}>WIN RATE</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{winRate}%</div>
          <div style={{ fontSize: '12px', opacity: 0.5 }}>{wins}W / {losses}L</div>
        </div>
        
        <div>
          <div style={{ opacity: 0.7, fontSize: '12px' }}>SURVIVAL</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{runway.toFixed(0)} days</div>
          <div style={{ fontSize: '12px', opacity: 0.5 }}>Daily API cost: -${apiCostPerDay}</div>
        </div>
      </div>
      
      {/* Controls */}
      <div style={{ marginBottom: '20px' }}>
        {!isRunning ? (
          <button 
            onClick={startAgent}
            style={{
              background: '#0f0',
              color: '#000',
              border: 'none',
              padding: '10px 20px',
              fontSize: '16px',
              fontFamily: 'monospace',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            ▶ START AGENT
          </button>
        ) : (
          <button 
            onClick={stopAgent}
            style={{
              background: '#f00',
              color: '#fff',
              border: 'none',
              padding: '10px 20px',
              fontSize: '16px',
              fontFamily: 'monospace',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            ■ STOP AGENT
          </button>
        )}
      </div>
      
      {/* Activity Log */}
      <div>
        <div style={{ opacity: 0.7, fontSize: '12px', marginBottom: '10px' }}>ACTIVITY LOG</div>
        <div 
          ref={logRef}
          style={{ 
            background: '#000',
            border: '1px solid #0f0',
            padding: '10px',
            height: '200px',
            overflowY: 'auto',
            fontSize: '12px',
            fontFamily: 'monospace'
          }}
        >
          {log.length === 0 && (
            <div style={{ opacity: 0.5 }}>[--------] press START AGENT to begin</div>
          )}
          {log.map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </div>
      </div>
      
      {/* Trade History */}
      {trades.length > 0 && (
        <div style={{ marginTop: '20px' }}>
          <div style={{ opacity: 0.7, fontSize: '12px', marginBottom: '10px' }}>RECENT TRADES</div>
          <div style={{ fontSize: '12px' }}>
            {trades.slice(-5).reverse().map((trade, i) => (
              <div key={i} style={{ 
                padding: '5px',
                borderBottom: '1px solid #333',
                color: trade.win ? '#0f0' : '#f00'
              }}>
                {trade.win ? '✓' : '✗'} {trade.market.slice(0, 50)}... 
                <span style={{ float: 'right' }}>
                  {trade.win ? '+' : ''}${trade.payout.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
