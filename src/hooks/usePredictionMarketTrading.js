import { useState, useRef, useEffect } from 'react';
import { calculateKelly, detectEdge } from '../utils/trading';

// Scans Polymarket opportunities every 10s while running and auto-bets on strong edges
export function usePredictionMarketTrading({ markets, running, balance, setBalance, setTrades }) {
  const [pmTrades, setPmTrades] = useState([]);
  const lastPmBetRef = useRef({}); // { marketId: timestamp }

  useEffect(() => {
    if (!running || !markets || markets.length === 0) return;

    const scanInterval = setInterval(() => {
      // Find markets with strong edges (>90% probability)
      const opportunities = markets
        .map(m => ({ ...m, ...detectEdge(m) }))
        .filter(m => m.hasEdge)
        .sort((a, b) => b.edge - a.edge)
        .slice(0, 3);

      if (opportunities.length > 0 && balance > 1) {
        const opp = opportunities[0];
        const kellyFraction = calculateKelly(opp.prob / (1 - opp.prob), opp.prob);
        const betSize = Math.min(balance * kellyFraction, balance * 0.05); // Max 5% per PM bet

        if (betSize > 0.50) {
          // Simulate trade (use actual probability with some noise for realism)
          const win = Math.random() < opp.prob * 0.95; // Slight house edge
          const payout = win ? betSize * (1 / opp.prob - 1) : -betSize;

          setBalance(b => Math.max(0.5, b + payout));
          lastPmBetRef.current[opp.id || opp.slug] = Date.now();
          setPmTrades(prev => {
            const updated = [...prev, {
              type: win ? 'PM_WIN' : 'PM_LOSS',
              market: opp.question,
              side: opp.side,
              size: betSize,
              pnl: payout.toFixed(2),
              prob: (opp.prob * 100).toFixed(0)
            }];
            return updated.length > 50 ? updated.slice(-50) : updated;
          });

          // Add to main trades log with [PM] prefix
          setTrades(t => {
            const updated = [...t, {
              type: win ? 'PM_WIN' : 'PM_LOSS',
              sym: `[PM] ${opp.side}`,
              pnl: payout.toFixed(2)
            }];
            return updated.length > 100 ? updated.slice(-100) : updated;
          });
        }
      }
    }, 10000); // Scan every 10s

    return () => clearInterval(scanInterval);
  }, [running, markets, balance, setBalance, setTrades]);

  const resetPM = () => {
    setPmTrades([]);
  };

  return { pmExits: pmTrades.length, lastPmBetRef, resetPM };
}
