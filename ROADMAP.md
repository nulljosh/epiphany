# Epiphany Roadmap

## Active

### Net Worth + Predictions integration
- Pull `USER_ACCOUNTS`, `USER_DEBT`, `USER_GOALS`, `USER_INCOME_PHASES` from `userProfile.js` into a unified net-worth view
- Chart: current net worth over time (from portfolio history) + projected trajectory
- Run `projectNetWorth()` from `debtProjections.js` using real KV portfolio snapshots
- Show debt-free date, savings milestone dates, surplus trend
- Entry point: `FinanceDashboard.jsx` already has the simulation infra — wire in real data

### Fix Vercel monorepo deployment
- The `apps/` monorepo may be trying to deploy all sub-apps as a single Vercel project
- Check `.vercel/project.json` — each sub-app (epiphany, dose, tally, etc.) must have its own linked Vercel project
- Audit `nulljosh-9577s-projects` Vercel team for orphan projects consuming free tier (currently at ~75% of 1M req)
- Fix: `cd apps/epiphany && vercel link` to ensure it's linked to its own project, not the monorepo root

### Local LLM cost reduction (Ollama)
- Already installed: `gemma4:e2b` (Ollama, 7.2GB, 128K context)
- Registered in `~/.openclaw/agents/main/agent/models.json`
- Wire Epiphany AI panel to support Ollama endpoint as a fallback (`http://localhost:11434/api/generate`)
- Add model selector in Settings: `claude` (API) vs `ollama/gemma4:e2b` (local, free)
- Gate: only show local option when Ollama is running (health check `http://localhost:11434`)

### Integrate "remaining days" life conversation
- Pull context from previous conversations about life planning / remaining-days framework
- Add to `apps/life` project or create a new `Life` section within Epiphany
- Connect to `RoadmapProjection.jsx` or a new view showing milestones, time horizons, probability curves



### Stripe $1/week
- Have: `server/api/stripe.js`, `server/api/stripe-webhook.js`, `user.tier` in KV
- TODO: Create price in Stripe dashboard, wire webhook to upgrade tier, add feature gates

### Data sources to add
- **Reddit** trending (added to gateway, `/api/reddit`)
- **CoinGecko** crypto prices (added to gateway, `/api/crypto`)
- **Reuters/AP wire** via NewsAPI or Mediastack
- **SEC filings** via EDGAR RSS
- **StatCan** releases, Bank of Canada rate decisions

### assetmarketcap.com integration
- Integrate https://assetmarketcap.com/ into Markets view
- Add serverless route `server/api/assetmarketcap.js` to proxy/cache data
- Display in Markets tab alongside existing stock/crypto data

### Claude usage + invoices sync workflow
- Automate syncing Claude Max usage data + invoices into Epiphany
- Cron job or webhook → store in KV → display in Portfolio or a new "Costs" panel

### Dormant features (re-enable when keys available)
- Traffic layer (TOMTOM) -- https://developer.tomtom.com/user/register
- Geocoding / places (HERE) -- https://platform.here.com/sign-up
- High-res wildfire (FIRMS_MAP) -- https://firms.modaps.eosdis.nasa.gov/api/area/
- Local events (TICKETMASTER) -- https://developer.ticketmaster.com/
- FMP stock data -- https://site.financialmodelingprep.com/developer/docs
- Blob-cached latest snapshot (`/api/latest`) -- restore handler body when ready

### UI polish
- Map event UX (Republic SF-inspired filtering, event cards)
- TradingView widget embedding (Pine Scripts exist in `tradingview/`)
- Service BC location markers on map (Tally integration)
- Split App.jsx into smaller modules (1500+ lines)

### Free vs Premium ($1/wk)
| Free | Premium |
|---|---|
| Map + all data layers | AI Analyst (Claude) |
| Situation monitor (read) | Portfolio + watchlist |
| Stock data + ticker | Ontology writes + batch |
| Weather/quakes/traffic | Deep news + crime data |

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
- GitHub repos cleaned (33 -> 10)
- Palantir-style icon across all platforms
- Reddit + CoinGecko data sources added
- Whitepaper written
- Dead API key cleanup (5 expired Vercel env vars removed; dead fetches stripped in fd4d5b2)

## From 2026-04-18 PDF (pending)

In most-to-least relevance order:

1. **Password reset verification** -- flow is wired (`server/api/auth.js:340-385`, Resend in `_email.js`) but email FROM still says `Monica <noreply@monica.heyitsmejosh.com>` (`server/api/_email.js:11`). Fix display name to Epiphany. Then end-to-end test: forgot-password for jatrommel@gmail.com, confirm email arrives, click link, set password, run `balance update`.
2. **Mobile stocks view overflow** -- `src/components/StockDetail.jsx:741-787` timeframe (1D/1W/1M/...) and chart-type (Heikin Ashi/Candles/...) rows scroll horizontally but users don't see cue on iOS. Add `@media (max-width: 520px)` with `flex-wrap: wrap`, `padding: 4px 8px`, `font-size: 11px`. Also: top ticker bar overlays price -- give detail modal `paddingTop: 44px` on mobile.
3. **Map events geocoding** -- `src/components/LiveMapBackdrop.jsx:550-560` drops GLOBAL events; when a keyword like "Langley" happens to match, a global event gets pinned to Langley City. Fix in `server/api/events.js`: add country-centroid JSON lookup, attach `lat`/`lon`. Client: use server coords first, keyword as fallback, drop silently if both absent.
4. **Avatar regen on profile icon click** -- Settings.jsx:50-90 already regenerates on click. Wire same handler to the profile photo icon in header/nav so every click cycles the avatar (matches Claude behavior). Keep unseeded random.
5. **AI Enrich button fails** -- `server/api/people-enrich.js:48,78-88`. Vercel has no `claude` CLI so fallback fails. Set `ANTHROPIC_API_KEY` in Vercel prod env, remove `runClaudeCLI` fallback (dead code on Vercel), include `err.message` in `:168` catch so frontend shows specifics instead of "Enrichment failed".
6. **Whitepaper bump + slim + README link** -- `WHITEPAPER.md` v1.0.0 -> v1.1.0, trim 127 lines to ~80 (collapse data-sources table to link to `docs/data-sources.md`, drop Architecture/Repo Structure redundancy). `README.md:8` link `[Whitepaper](whitepaper.md)` -> `(WHITEPAPER.md)` (case-correct for Linux/Vercel). Badge `v1.0.0--beta` -> `v1.1.0`.
7. **Roadmap tab wiring** -- `src/components/RoadmapProjection.jsx` and `src/utils/roadmapSim.js` are committed but FinancePanel.jsx wasn't patched this session (git pack corruption required a reclone). Add a 5th "roadmap" tab: push `'roadmap'` into the tabs array and render `{tab === 'roadmap' && <RoadmapProjection t={t} />}` near line 1425.
8. **`/cleanup` skill** -- reusable across all projects. Behavior: merge plan.md into ROADMAP.md, strip items marked done/completed/fixed, verify README version badge + whitepaper link casing. Install at `~/.claude/skills/cleanup/SKILL.md`.


## Brain dump 2026-04-23
- [x] Stocks ticker font size reduced (12 -> 10)
- [ ] Make ticker items clickable to open stock view (currently pauses cycle)
- [x] People tab: add clear search (X) button
- [ ] Avatar generation: "new avatar" toast fires but image doesn't change
- [ ] Integrate goals better, update debts to realistic values
- [ ] Reset API keys (Vercel breach)
- [ ] Per-service API audit: keep/drop, data populated in area?, reliable?, safe?
- [ ] Tighten overall security + vulnerabilities
