# Epiphany Roadmap

Ordered by effort (fewest tokens → most). Ship the top first.

---

## Tier 1 — Quick fixes (< 30 min each)

### Whitepaper bump + README link fix
- `WHITEPAPER.md`: v1.0.0 → v1.1.0, trim to ~80 lines (collapse data-sources table → link `docs/data-sources.md`, drop Architecture/Repo Structure redundancy)
- `README.md:8`: `[Whitepaper](whitepaper.md)` → `[Whitepaper](WHITEPAPER.md)` (case-correct for Linux/Vercel)
- Badge `v1.0.0--beta` → `v1.1.0`

### Roadmap tab wiring
- `src/components/RoadmapProjection.jsx` and `src/utils/roadmapSim.js` committed but `FinancePanel.jsx` not patched
- Push `'roadmap'` into tabs array; render `{tab === 'roadmap' && <RoadmapProjection t={t} />}` near line 1425

### Avatar regen on profile icon click
- `Settings.jsx:50-90` already regenerates on click
- Wire same handler to header/nav profile icon so every click cycles avatar
- Keep unseeded random

### Password reset email still says "Monica"
- `server/api/_email.js:11` — FROM still `Monica <noreply@monica.heyitsmejosh.com>`
- Fix display name to Epiphany + domain
- End-to-end test: forgot-password → email → click link → set password → `balance update`

---

## Tier 2 — Small fixes (30–60 min)

### AI Enrich — DEFERRED
- People enrichment via AI is disabled until a cheaper provider decision is made
- `people-enrich.js` code is clean (no dead code), just needs `ANTHROPIC_API_KEY` when re-enabled
- Do not wire up or expose this feature until provider is chosen

### Avatar toast fires but image doesn't change
- Brain dump 2026-04-23: toast fires, avatar doesn't update
- Likely stale blob URL or missing state refresh after upload

### Mobile stocks view overflow
- `src/components/StockDetail.jsx:741-787` timeframe + chart-type rows need `@media (max-width: 520px)`: `flex-wrap: wrap`, `padding: 4px 8px`, `font-size: 11px`
- Detail modal `paddingTop: 44px` on mobile to prevent ticker overlay

### Ticker items clickable
- Currently clicking a ticker item only pauses the cycle
- Wire click to open stock detail view

---

## Tier 3 — Medium (1–2 hr)

### Map events geocoding fix
- `src/components/LiveMapBackdrop.jsx:550-560` drops GLOBAL events; keyword match pins global event to wrong city
- `server/api/events.js`: add country-centroid JSON lookup, attach `lat`/`lon`
- Client: server coords first → keyword fallback → drop silently if both absent

### Fix Vercel monorepo deployment
- Each sub-app (epiphany, dose, tally) must have its own linked Vercel project
- Check `.vercel/project.json` — run `cd apps/epiphany && vercel link` if wrong
- Audit `nulljosh-9577s-projects` for orphan projects (was at ~75% of 1M req/mo)

### assetmarketcap.com integration
- Add `server/api/assetmarketcap.js` proxy/cache route
- Display in Markets tab alongside existing stock/crypto data

### Claude usage + invoices sync
- Cron or webhook → store in KV → display in Portfolio or new "Costs" panel

---

## Tier 4 — Larger features (2+ hr)

### Net Worth + Predictions integration
- Pull `USER_ACCOUNTS`, `USER_DEBT`, `USER_GOALS`, `USER_INCOME_PHASES` from `userProfile.js` into unified net-worth view
- Chart: current net worth over time (from portfolio history) + projected trajectory
- Run `projectNetWorth()` from `debtProjections.js` using real KV portfolio snapshots
- Show debt-free date, savings milestone dates, surplus trend
- `FinanceDashboard.jsx` has simulation infra — wire in real data

### Stripe $1/week
- Have: `server/api/stripe.js`, `server/api/stripe-webhook.js`, `user.tier` in KV
- Create price in Stripe dashboard, wire webhook to upgrade tier, add feature gates

### Data sources expansion
- **Reddit** trending (added to gateway, `/api/reddit`)
- **CoinGecko** crypto prices (added to gateway, `/api/crypto`)
- **Reuters/AP wire** via NewsAPI or Mediastack
- **SEC filings** via EDGAR RSS
- **StatCan** releases, Bank of Canada rate decisions

### Local LLM cost reduction (Ollama)
- Wire AI panel to Ollama endpoint fallback (`http://localhost:11434/api/generate`)
- Settings model selector: `claude` vs `ollama/gemma4:e2b` (local, free)
- Gate: health check `http://localhost:11434` before showing local option

---

## Tier 5 — Long-term

### Remaining days / life section
- Pull from previous life-planning conversations
- Add `Life` section or connect to `RoadmapProjection.jsx` with milestones, time horizons, probability curves

### UI polish
- Map event UX (Republic SF-inspired filtering, event cards)
- TradingView widget embedding (Pine Scripts exist in `tradingview/`)
- Service BC location markers on map (Tally integration)
- Split `App.jsx` into smaller modules (currently 1500+ lines)

### Dormant features (need API keys)
- Traffic layer (TOMTOM)
- Geocoding / places (HERE)
- High-res wildfire (FIRMS_MAP)
- Local events (TICKETMASTER)
- FMP stock data
- Blob-cached latest snapshot (`/api/latest`) — restore handler when ready

### Security + API audit
- Per-service API audit: keep/drop, data populated?, reliable?, safe?
- Tighten overall security + vulnerabilities
- Integrate goals better, update debts to realistic values

---

## Free vs Premium ($1/wk)

| Free | Premium |
|---|---|
| Map + all data layers | AI Analyst (Claude) |
| Situation monitor (read) | Portfolio + watchlist |
| Stock data + ticker | Ontology writes + batch |
| Weather/quakes/traffic | Deep news + crime data |

---

## Done

- Rename: Monica → Epiphany (GitHub repo, Vercel, iOS/macOS bundle IDs, READMEs, CLAUDE.md, memory)
- STALE indicator / heartbeat
- Macro pulse strip (dynamic from `/api/macro`)
- MacroPanel data-shape fix (ca43e23)
- Map layers (11 layers, coord validation, mapLayers filtering)
- Ticker (live data + static fallback)
- Avatar sync iOS/web
- Upgrade button UX (PricingPage modal)
- Error resilience (fetchJsonGraceful, iOS/macOS decode logging)
- Gateway stability (lazy() per route, try/catch isolation)
- Double star watchlist fix
- Polymarket whale tracking
- Tally payday on web
- People tabs merged (web + iOS + macOS)
- Nav flattened (Situation | Markets | Portfolio | People | Settings)
- Fake map data removed (real coords only)
- Wikipedia popup links fixed
- Repo cleanup (10 dead folders removed)
- GitHub repos cleaned (33 → 10)
- Palantir-style icon across all platforms
- Reddit + CoinGecko data sources added
- Whitepaper written
- Dead API key cleanup (5 expired Vercel env vars removed; dead fetches stripped in fd4d5b2)
- Stocks ticker font size reduced (12 → 10)
- People tab: add clear search (X) button
