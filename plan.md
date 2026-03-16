# Spending Dashboard Integration Plan

## What we built

A single React component (`FinanceDashboard.jsx`) that shows:
- Monthly spending broken down by category (stacked bar)
- Income line overlaid per scenario (EI / PWD+DTC / PWD+work / Actual)
- Click a month to drill into a category breakdown
- Debt payoff projection across all 4 income scenarios

---

## Step 1: Drop the file in

Copy `FinanceDashboard.jsx` into your project.

```
src/
  components/
    FinanceDashboard.jsx   <-- here
```

Install the one dependency:

```bash
npm install recharts
```

---

## Step 2: Wire it up

Wherever you want the dashboard in your app:

```jsx
import FinanceDashboard from './components/FinanceDashboard'

export default function App() {
  return <FinanceDashboard />
}
```

That is it. It renders with your real data from the statements already baked in.

---

## Step 3: Connect your real data

At the top of `FinanceDashboard.jsx` there is a `STATEMENT_DATA` array. Replace it with your actual source.

**Option A: Static (good for now)**
Just edit the array directly. Each month is one object.

```js
{ month: "Mar 26", actual: 1200, cats: { Vaping: 60, Food: 300, ... } }
```

**Option B: Fetch from your backend**
Convert the component to accept a `data` prop:

```jsx
export default function FinanceDashboard({ data = STATEMENT_DATA }) {
```

Then pass it in:

```jsx
<FinanceDashboard data={statementsFromAPI} />
```

**Option C: Pull from Wealthsimple CSV export**
Export your transactions as CSV, write a small parser that groups by month and category, and feed the result into option B.

---

## Step 4: Customize categories

The `CAT_COLORS` object at the top controls categories and their colors. Add, remove, or rename to match however you tag your transactions.

```js
export const CAT_COLORS = {
  Rent: "#ff6b6b",
  Food: "#0a84ff",
  Vaping: "#ff453a",
  // add yours here
}
```

The breakdown bar chart and stacked chart update automatically.

---

## Step 5: Update the debt target

Find `const DEBT = 7000` near the top and change it to whatever you are actually tracking. The payoff projection recalculates on its own.

---

## Step 6: Dark mode

The artifact version auto-switches with `prefers-color-scheme`. The React JSX version uses semi-transparent glass that works in both modes. If your app has a theme context (e.g. Tailwind dark mode, a ThemeProvider), swap the hardcoded background color `#f2f2f7` for your theme token and it will follow automatically.

---

## What to do after

Once this is in your app, the natural next features are:

1. **Bank sync** - connect Wealthsimple API or Plaid so data updates automatically instead of you uploading PDFs
2. **Category tagging** - let you label transactions manually or with a rule engine
3. **Alerts** - notify when you hit 75% of the PWD earnings exemption ($12,150)
4. **Savings goal tracker** - track progress toward the $7k debt payoff in real time

---

## File summary

| File | Purpose |
|------|---------|
| `FinanceDashboard.jsx` | The whole dashboard, one file |
| `recharts` | Charting library, the only dependency |

No backend needed to start. No extra config files. One import and you are live.
