function roundMoney(value) {
  return Math.round(value * 100) / 100;
}

function hashSeries(months) {
  const text = JSON.stringify(months.map((month) => [month.sortKey, month.total]));
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createRandom(seed) {
  let state = seed || 1;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function gaussian(random) {
  let u = 0;
  let v = 0;
  while (u === 0) u = random();
  while (v === 0) v = random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function monthDateFromSortKey(sortKey) {
  if (typeof sortKey === 'string' && /^\d{4}-\d{2}$/.test(sortKey)) {
    return new Date(`${sortKey}-01T00:00:00Z`);
  }
  return null;
}

function nextMonth(sortKey, offset) {
  const baseDate = monthDateFromSortKey(sortKey);
  if (!baseDate) return null;
  const date = new Date(Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth() + offset, 1));
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  return {
    sortKey: `${year}-${month}`,
    month: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' }),
  };
}

function percentile(sortedValues, p) {
  if (!sortedValues.length) return 0;
  const index = (sortedValues.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sortedValues[lower];
  const weight = index - lower;
  return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
}

export function buildSpendingForecast(months, { simulations = 2000 } = {}) {
  if (!Array.isArray(months) || months.length < 3) return null;
  const series = months
    .map((month) => ({
      month: month.month,
      sortKey: month.sortKey,
      total: Math.max(0, Number(month.total) || 0),
    }))
    .filter((month) => month.total > 0);

  if (series.length < 3) return null;

  const returns = [];
  for (let i = 1; i < series.length; i += 1) {
    const prev = series[i - 1].total;
    const current = series[i].total;
    if (prev > 0 && current > 0) {
      returns.push(Math.log(current / prev));
    }
  }

  if (returns.length === 0) return null;

  const drift = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance = returns.reduce((sum, value) => sum + (value - drift) ** 2, 0) / Math.max(1, returns.length - 1);
  const volatility = Math.sqrt(Math.max(variance, 0));
  const horizon = series.length;
  const random = createRandom(hashSeries(series));
  const startValue = series[series.length - 1].total;
  const paths = Array.from({ length: horizon }, () => []);

  for (let i = 0; i < simulations; i += 1) {
    let value = startValue;
    for (let step = 0; step < horizon; step += 1) {
      const shock = gaussian(random);
      const projected = value * Math.exp(drift - 0.5 * volatility * volatility + volatility * shock);
      value = Math.max(0, projected);
      paths[step].push(roundMoney(value));
    }
  }

  const lastSortKey = series[series.length - 1].sortKey;
  if (!lastSortKey) return null;

  const points = paths.map((pathValues, index) => {
    const sorted = [...pathValues].sort((a, b) => a - b);
    const label = nextMonth(lastSortKey, index + 1);
    return {
      month: label?.month || `+${index + 1}`,
      sortKey: label?.sortKey || `${lastSortKey}-${index + 1}`,
      median: roundMoney(percentile(sorted, 0.5)),
      low: roundMoney(percentile(sorted, 0.1)),
      high: roundMoney(percentile(sorted, 0.9)),
    };
  });

  return {
    horizon,
    points,
    summary: {
      expectedNextMonth: points[0]?.median || 0,
      rangeLow: points[0]?.low || 0,
      rangeHigh: points[0]?.high || 0,
    },
  };
}
