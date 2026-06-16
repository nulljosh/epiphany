// Mock allocation engine for the Trade workflow prototype. Equal-weights
// current holdings plus a couple of diversification picks from live market
// data, then suggests buys/sells to close the gap. Illustrative only.
export function generateRecommendations({ holdings = [], cashValue = 0, stocks = [] }) {
  const heldSymbols = new Set(holdings.map((h) => h.symbol));
  const positions = holdings.filter((h) => h.value > 0);
  const holdingsValue = positions.reduce((sum, h) => sum + h.value, 0);
  const portfolioValue = holdingsValue + cashValue;

  const picks = stocks
    .filter((s) => !heldSymbols.has(s.symbol) && typeof s.price === 'number' && s.price > 0)
    .sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0))
    .slice(0, 2);

  const slots = positions.length + picks.length;
  const targetWeight = slots > 0 ? 1 / slots : 0;

  const recommendations = [];
  let cashRemaining = cashValue;

  for (const h of positions) {
    const price = h.currentPrice || h.value / h.shares;
    if (!price || !Number.isFinite(price)) continue;
    const currentWeight = portfolioValue > 0 ? h.value / portfolioValue : 0;
    const diff = targetWeight - currentWeight;

    if (diff > 0.02 && cashRemaining > price) {
      const amount = Math.min(diff * portfolioValue, cashRemaining);
      const shares = Math.floor(amount / price);
      if (shares > 0) {
        recommendations.push({
          symbol: h.symbol, action: 'buy', shares, price, amount: shares * price,
          currentWeight, targetWeight,
          rationale: `Underweight vs target allocation (${(currentWeight * 100).toFixed(1)}% vs ${(targetWeight * 100).toFixed(1)}%)`,
        });
        cashRemaining -= shares * price;
      }
    } else if (diff < -0.02) {
      const amount = -diff * portfolioValue;
      const shares = Math.min(Math.floor(amount / price), Math.floor(h.shares));
      if (shares > 0) {
        recommendations.push({
          symbol: h.symbol, action: 'sell', shares, price, amount: shares * price,
          currentWeight, targetWeight,
          rationale: `Overweight vs target allocation (${(currentWeight * 100).toFixed(1)}% vs ${(targetWeight * 100).toFixed(1)}%)`,
        });
      }
    }
  }

  for (const pick of picks) {
    if (cashRemaining <= pick.price) break;
    const amount = Math.min(targetWeight * portfolioValue, cashRemaining);
    const shares = Math.floor(amount / pick.price);
    if (shares > 0) {
      recommendations.push({
        symbol: pick.symbol, action: 'buy', shares, price: pick.price, amount: shares * pick.price,
        currentWeight: 0, targetWeight,
        rationale: 'New position for diversification (not currently held)',
      });
      cashRemaining -= shares * pick.price;
    }
  }

  return {
    liquidCash: cashValue,
    portfolioValue,
    cashDeployed: cashValue - cashRemaining,
    cashRemaining,
    recommendations,
    disclaimer: 'Illustrative only -- not investment advice. No real orders are placed.',
  };
}
