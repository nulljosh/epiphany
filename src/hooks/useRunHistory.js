import { useState, useEffect, useRef } from 'react';
import { saveRun, getStats } from '../utils/runHistory';

// Auto-saves a completed simulator run (win or bust) and tracks all-time stats
export function useRunHistory({ running, balance, tick, trades, elapsedTime, targetTrillion }) {
  const [runStats, setRunStats] = useState(() => getStats());
  const hasSavedRun = useRef(false);

  // Auto-save run when sim ends (win or bust)
  useEffect(() => {
    const target = targetTrillion ? 1000000000000 : 1000000000;
    const isWon = balance >= target;
    const isBusted = balance <= 0.5;

    if ((isWon || isBusted) && !hasSavedRun.current && tick > 0) {
      hasSavedRun.current = true;
      const exits = trades.filter(t => t.pnl);
      const wins = exits.filter(t => parseFloat(t.pnl) > 0);
      saveRun({
        won: isWon,
        finalBalance: balance,
        duration: elapsedTime,
        tradeCount: exits.length,
        tradeWinRate: exits.length ? (wins.length / exits.length * 100) : 0,
        ticks: tick,
        target: target,
      });
      setRunStats(getStats());
    }
  }, [balance, tick]);

  // Reset save flag on new run
  useEffect(() => {
    if (running) hasSavedRun.current = false;
  }, [running]);

  return { runStats };
}
