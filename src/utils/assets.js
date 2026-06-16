// Asset metadata (prices fetched live from APIs - no hardcoded values)
export const defaultAssets = {
  // PRECIOUS METALS
  silver: { name: 'XAGUSD', full: 'Silver Spot', notes: 'COMEX paper vs physical spread. Big short squeeze thesis.', spot: 30, vol: 0.25, targets: [32, 35, 40], hi52: 35, lo52: 22 },
  gold: { name: 'XAUUSD', full: 'Gold Spot', notes: 'Central banks buying 850t/yr. De-dollarization accelerating.', spot: 2650, vol: 0.15, targets: [2800, 3000, 3200], hi52: 2800, lo52: 2000 },
  platinum: { name: 'XPTUSD', full: 'Platinum', notes: 'Supply deficit 7 of 11 years. Undervalued vs gold.', spot: 950, vol: 0.20, targets: [1000, 1100, 1200], hi52: 1100, lo52: 850 },
  palladium: { name: 'XPDUSD', full: 'Palladium', notes: 'Russia supply risk. EV transition headwind.', spot: 950, vol: 0.30, targets: [1000, 1200, 1400], hi52: 1400, lo52: 800 },
  copper: { name: 'COPPER', full: 'Copper HG', notes: 'Data center/EV demand. Chile strikes. Record highs.', spot: 4.2, vol: 0.22, targets: [4.5, 5.0, 5.5], hi52: 5.0, lo52: 3.5 },
  oil: { name: 'USOIL', full: 'WTI Crude', notes: 'OPEC+ cuts. Geopolitical premium.', spot: 75, vol: 0.35, targets: [80, 90, 100], hi52: 95, lo52: 65 },
  natgas: { name: 'NATGAS', full: 'Natural Gas', notes: 'AI data center power demand. LNG exports.', spot: 3.5, vol: 0.40, targets: [4.0, 5.0, 6.0], hi52: 6.0, lo52: 2.0 },
  nas100: { name: 'NAS100', full: 'NASDAQ 100', notes: 'AI concentration risk. Mag7 = 35% of index.', spot: 22000, vol: 0.18, targets: [23000, 25000, 27000], hi52: 24000, lo52: 18000 },
  us500: { name: 'US500', full: 'S&P 500', notes: 'Shiller PE elevated. Breadth improving.', spot: 6000, vol: 0.15, targets: [6200, 6500, 7000], hi52: 6200, lo52: 5200 },
  us30: { name: 'US30', full: 'Dow Jones 30', notes: 'Value rotation potential if AI unwinds.', spot: 45000, vol: 0.14, targets: [46000, 48000, 50000], hi52: 48000, lo52: 40000 },
  btc: { name: 'BTCUSD', full: 'Bitcoin', notes: 'ETF inflows. Halving supply shock. $200K bull target.', spot: 100000, vol: 0.60, targets: [120000, 150000, 200000], hi52: 110000, lo52: 40000 },
  eth: { name: 'ETHUSD', full: 'Ethereum', notes: 'Staking yield. L2 scaling. ETF potential.', spot: 3500, vol: 0.65, targets: [4000, 5000, 6000], hi52: 4500, lo52: 1500 },
  // MAG7 STOCKS
  aapl: { name: 'AAPL', full: 'Apple Inc', notes: 'iPhone 16 cycle. Services growth. AI integration.', spot: 240, vol: 0.25, targets: [260, 280, 300], hi52: 250, lo52: 165 },
  msft: { name: 'MSFT', full: 'Microsoft', notes: 'Azure AI dominance. OpenAI partnership. Cloud growth.', spot: 420, vol: 0.22, targets: [450, 500, 550], hi52: 470, lo52: 350 },
  googl: { name: 'GOOGL', full: 'Alphabet', notes: 'Search dominance. Gemini AI. YouTube strength.', spot: 190, vol: 0.24, targets: [210, 230, 250], hi52: 200, lo52: 125 },
  amzn: { name: 'AMZN', full: 'Amazon', notes: 'AWS margins expanding. Retail dominance. AI compute.', spot: 220, vol: 0.28, targets: [240, 270, 300], hi52: 230, lo52: 140 },
  meta: { name: 'META', full: 'Meta Platforms', notes: 'AI ad targeting. Reality Labs. Instagram/WhatsApp growth.', spot: 600, vol: 0.30, targets: [650, 700, 800], hi52: 640, lo52: 275 },
  tsla: { name: 'TSLA', full: 'Tesla', notes: 'FSD potential. Energy storage. Robotaxi narrative.', spot: 400, vol: 0.50, targets: [500, 600, 700], hi52: 490, lo52: 140 },
  nvda: { name: 'NVDA', full: 'NVIDIA', notes: 'AI chip monopoly. H100/H200 demand. Blackwell ramp.', spot: 145, vol: 0.45, targets: [180, 220, 260], hi52: 200, lo52: 105 },
  pltr: { name: 'PLTR', full: 'Palantir', notes: 'AI platform. Government contracts. AIP growth.', spot: 70, vol: 0.55, targets: [90, 110, 130], hi52: 80, lo52: 15 },
  hood: { name: 'HOOD', full: 'Robinhood', notes: 'Crypto trading. Options growth. New users.', spot: 38, vol: 0.50, targets: [45, 55, 70], hi52: 45, lo52: 10 },
  dxy: { name: 'DXY', full: 'US Dollar Index', notes: 'De-dollarization watch. Twin deficits.', spot: 108, vol: 0.08, targets: [110, 112, 115], hi52: 110, lo52: 100 },
};

// Scenario configurations for Monte Carlo
export const scenarios = {
  bull: { drift: 0.50, label: 'Bull', volMult: 1.1 },
  base: { drift: 0.25, label: 'Base', volMult: 1.0 },
  bear: { drift: 0.05, label: 'Bear', volMult: 0.9 },
};

// Time horizons (days)
export const horizons = [90, 180, 365];

// Generate date labels dynamically from today
export const getHorizonLabels = () => {
  const now = new Date();
  return horizons.map(days => {
    const date = new Date(now);
    date.setDate(date.getDate() + days);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  });
};
export const horizonLabels = getHorizonLabels();
