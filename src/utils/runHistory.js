const STORAGE_KEY = 'monica_run_history';
const MAX_RUNS = 50;

export function saveRun(runData) {
  const runs = getRuns();
  runs.push({
    ...runData,
    id: Date.now(),
    timestamp: new Date().toISOString(),
  });
  // Keep only last MAX_RUNS
  if (runs.length > MAX_RUNS) runs.splice(0, runs.length - MAX_RUNS);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(runs));
  } catch (e) {
    console.warn('Failed to save run history:', e);
  }
}

export function getRuns() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function getStats() {
  const runs = getRuns();
  if (runs.length === 0) return null;

  const wins = runs.filter(r => r.won);
  const losses = runs.filter(r => !r.won);

  return {
    totalRuns: runs.length,
    wins: wins.length,
    losses: losses.length,
    winRate: (wins.length / runs.length * 100).toFixed(0),
    avgTrades: Math.round(runs.reduce((a, r) => a + (r.tradeCount || 0), 0) / runs.length),
    avgDuration: Math.round(runs.reduce((a, r) => a + (r.duration || 0), 0) / runs.length),
    bestBalance: Math.max(...runs.map(r => r.finalBalance || 0)),
    avgWinRate: (runs.reduce((a, r) => a + (r.tradeWinRate || 0), 0) / runs.length).toFixed(0),
  };
}

export function clearRuns() {
  localStorage.removeItem(STORAGE_KEY);
}
