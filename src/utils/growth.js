// Compound growth, one point per year: deposit `monthly` at each month end, compounding monthly.
export function growthCurve(monthly, years, ratePct) {
  const r = ratePct / 100 / 12;
  const points = [{ year: 0, contributed: 0, value: 0 }];
  let value = 0;
  for (let m = 1; m <= Math.round(years) * 12; m++) {
    value = value * (1 + r) + monthly;
    if (m % 12 === 0) points.push({ year: m / 12, contributed: monthly * m, value });
  }
  return points;
}
