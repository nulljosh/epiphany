# Opticon Notes

## What It Is

Live map and market app. Map is the main view. Top bar shows prices. Side panel (or mobile sheet) shows the active tab.

## Rules

- Map stays steady -- no jumps on load, no flashing on state changes
- No fake prices before real data arrives
- Mobile-first layout, same-tab toggle opens/closes sheet
- Simulator stays centered, does not push the map

## Running

```bash
npm install
npm run dev
npm test -- --run
npm run build
```

## Deploy

Production on Vercel. Cloudflare is future migration path (API first).

## Features

- Income scenario overlays on spending chart (+$500, +$1000, x2)
- Stacked category bar charts
- Expandable monthly breakdowns with per-category progress bars
- Debt payoff projections (avalanche method)
