// Kelly Criterion: f = (bp - q) / b
// f = fraction to bet, b = odds, p = win probability, q = 1-p
export function calculateKelly(odds, winProb, fractional = 0.25) {
  const b = odds - 1;
  const p = winProb;
  const q = 1 - p;
  const kelly = (b * p - q) / b;
  return Math.max(0, Math.min(kelly * fractional, 0.1)); // Cap at 10%
}

// Edge detection: compare market odds to implied probability
export function detectEdge(market) {
  const yesProb = parseFloat(market.outcomePrices?.[0]) || 0;
  const noProb = parseFloat(market.outcomePrices?.[1]) || 0;

  const edge = Math.max(yesProb, noProb) - 0.5; // Edge over coin flip
  const side = yesProb > noProb ? 'YES' : 'NO';
  const prob = Math.max(yesProb, noProb);

  return { edge, side, prob, hasEdge: edge > 0.35 }; // >85% = edge
}
