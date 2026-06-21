# Epiphany Roadmap

Ordered by effort (fewest tokens → most). Ship the top first.

Last updated: 2026-06-13

---

## Open

- **Map event animations** — loading/popup states for events rendering on the
  map feel abrupt. Reference: lottiefiles.com for lightweight Lottie loading
  animations, cross-platform (web + iOS/macOS/watchOS). Not started — needs a
  design pass on which events specifically get an enter/loading animation
  before touching `LiveMapBackdrop.jsx`.
- **"Map too zoomed out, renders no sources" — checked 2026-06-21, root cause still unconfirmed.**
  `LiveMapBackdrop.jsx` has no `minzoom`/`maxzoom` layer constraint, and
  `decimateByZoom` (line ~551) never returns an empty array for non-empty
  input (worst case is 25% at zoom<10, not 0%). So the complaint isn't a
  simple culling-threshold bug. Likely candidates not yet checked: the
  data-fetch bbox/radius calculation at low zoom, or a screenshot-timing
  artifact (captured before async data loaded). Needs an actual repro
  (reload at a specific low zoom, check network tab for empty responses
  vs. a render-layer issue) before a fix is attempted.
- **Landing page screenshots incomplete** — `LandingPage.jsx` currently only
  shows a map screenshot. Should also show Markets, Portfolio, and Settings
  tabs, plus matching watchOS + macOS screenshots (README parity). Not
  started — screenshot pipeline needs the map-too-zoomed-out bug (line ~212,
  zoom-based culling) fixed first or screenshots will look broken.
- People tab and TradingView MCP integration: see "Decide whether to also
  unhide People" and TradingView widget embedding entries below — both
  already tracked here, no new decision made in this pass.
- Add `og:title`/`og:description`/`og:image` meta tags to `index.html` — currently zero OG tags, so shared links (iMessage/Slack/etc.) show no preview card. Confirmed still missing 2026-06-20; the rest of a June design-review note's "splash page is blank" claim is stale (`LandingPage.jsx` already ships a full hero/feature/screenshot/CTA landing for unauthenticated visitors, see CLAUDE.md).
- Stocks list redesign like iOS Stocks: inline sparkline + ticker symbol in
  list — investigated 2026-06-13: needs a backend change (bulk stocks endpoint
  must return a price-history series per symbol for the sparkline), too large
  for a lean pass. Deferred.
- [x] Buy/sell/hold "why" — DONE 2026-06-13: each reason (RSI/MACD/MA trend)
  in `StockDetail.jsx`'s "Why buy/sell/hold?" panel now shows a short math
  rationale beneath it (from WHITEPAPER.md's Algorithms section). Lint clean,
  not yet manually verified in browser.
- Language support (i18n) across app and website
- **Autopilot 24/7 — due 2026-06-14/15**: crypto/CFD/extended hours (currently
  market-hours only). Blocked on **Joshua: Disconnect → Connect brokerage once**
  with trade permission (current connection is read-only, 403 code 3007), then
  re-run the `broker/impact-test` probe → Monday trades. Once unblocked: auth
  with brokerage, auto buy/sell tiny crypto amounts over minutes while the app
  is closed, plus user-facing run/error logging (KV trade log → UI).
- Multi-brokerage support for premium tier — investigated 2026-06-13: the
  data layer already merges holdings/cash across ALL of a user's SnapTrade
  connections (`getHoldings`/`getBalance` loop every `/accounts` entry, which
  spans every linked brokerage). What's actually missing is UI: `broker/sync.js`
  only calls `loginLink()` when the user has **zero** accounts, so there's no
  way to add a *second* brokerage. Remaining scope: (1) `broker/sync.js` —
  accept `{ action: 'connect-additional' }`, gate with `isPro(session)` from
  `gates.js` (return `{ upgradeRequired: true }` for free users), then call
  `loginLink()` even when accounts exist; (2) `Settings.jsx` — "Connect
  another brokerage" button (Pro only) + upgrade prompt for free users (no
  existing paywall UI pattern in this codebase to copy from — design needed).
  (picker menu + iOS disconnect already shipped 2026-06-12, `ec51d11f`)
- iOS release: test brokerage flow in Xcode → archive → submit (review
  ~24–48h, finance may take a few days)
- [x] Graph↔news linkage — DONE 2026-06-13: `StockDetail.jsx` chart now
  `subscribeCrosshairMove`s; Related News filters to articles within 1 day
  (intraday ranges) or 3 days (daily+ ranges) of the hovered candle, falling
  back to the full list if nothing matches, with a "near {date}" label.
  Lint clean, not yet manually verified in browser.
- Local events: photos, phone number, address on everything clickable —
  blocked on `GOOGLE_PLACES_API_KEY` (see Tier 2)
- Mobile web view broken / map not appearing — needs repro
- Xcode Cloud: verify `ci_post_clone.sh` fixes archive step (watch next run)
- ⏳ Verify SnapTrade freshness after overlay fix — `connectionPortalVersion: 'v4'`
  requested in `snaptrade.js loginLink()`; not yet verified in portal (full
  searchable broker list expected; if still limited, check SnapTrade dashboard
  "enabled brokerages"). **Blocked on Joshua: test in brokerage reconnect flow** (June 14–15)
- CDB research (Canada Disability Benefit, ~$200/m)
- Eventually: rename to Yotta/Yota
- [x] Autopilot is the only gated feature — DONE 2026-06-13: there is currently
  **no** "AI Analyst (Claude)" chat feature in the codebase (no `AiPanel`, no
  `ANTHROPIC_API_KEY` usage, no `people-enrich.js`). `DailyBrief` is
  rule-based (movers + GDELT headlines), not LLM-generated. The only working
  Pro gate is autopilot live trading (`isPro` in `broker/autopilot.js` /
  `morning-run.js`). Free vs Premium table (line 330–335) correctly reflects
  this: autopilot only. If AI Analyst feature is built later, add to Premium.
- Landing page simplification (v2): `src/pages/LandingPage.jsx` (517 lines) +
  `landing.css` (398 lines) — needs the user to say *what* "simplify" means
  (fewer sections? cut the canvas animation for perf? trim copy?) before it
  can be scoped.
- "Buttons don't do anything": vague report, need user to specify which
  screen/buttons before this can be scoped.

### macOS open items (merged from `macos/plan.md`, 2026-06-13)

- App icon not scaled properly (dock)
- Map celebration icons → pin icons (they're events)
- Sync macOS with latest web/iOS features; auto-populate events while panning map
- [x] Market countdown: time until open when closed, time until close near close — DONE (MarketsView.swift:561,568 already implemented)
- [x] Login broken — entitlements file is empty; check sandbox/network-client — DONE 2026-06-13 (see quick wins commit)
- [x] Remove people indexer tab for now — DONE (already absent from macOS ContentView.swift, 4-tab nav only)
- Test + submit to App Store
- Bitmap avatar generator (`Views/SettingsView.swift`): currently shows initial
  letter only. Add "Generate avatar" button — 64x64 NSImage via
  NSBitmapImageRep, symmetric pixel pattern, random palette, upload via POST
  `/api/avatar` (base64 JPEG). Reference: web impl
  `src/components/Settings.jsx:generateBitmapAvatar`.

### Ontology / "Bridge to A+" push (largest item — do this in its own session)

1. `src/components/RelationshipGraph.jsx` — extract the force-directed canvas
   from `PeoplePanel.jsx:533`, generalize to accept any ontology object (color
   by type) instead of people-only.
2. `src/components/OntologyPanel.jsx` — `useOntology` stats header + type
   filter chips + the generalized graph + a real empty state (no fake data).
3. Wire converters: assets from `useStocks` (`stockToAsset`, App already has
   this data), accounts from portfolio. Situation events need `useSituation`
   lifted/passed up from `SituationMonitor` — the invasive part, do
   deliberately.
4. Add `{ key: 'ontology', label: 'Ontology' }` to `TAB_PILLS` (`App.jsx:1039`)
   + render branch + both layout navs. Decide whether to also unhide People.
5. Bump README ("Ontology tab" claim becomes true) + CLAUDE.md, test, build,
   commit, push.

### Monica/Opticon → Epiphany rename sweep (~128 refs across 50 files, web + iOS + macOS + watchOS)

NOT a blind sed — categorize first:
- SAFE: display strings, comments, docs (READMEs, WHITEPAPER, index.html
  title/meta, JSX text).
- MIGRATE, don't rename: `monica_*` localStorage keys (`monica_last_geo`,
  `monica_geo_granted`, `monica_broker_config`, `monica_broker_autosend`) and
  any `monica:*` KV cache keys — rename orphans saved state; needs a
  read-old-write-new migration shim.
- DO NOT TOUCH: `com.heyitsmejosh.opticon.pro` / `.ultra` StoreKit product IDs
  in `ios/Services/StoreKitManager.swift` — registered in App Store Connect,
  immutable, renaming breaks IAP.
- REFACTOR: `watchos/MonicaWatchApp.swift` file + `@main` struct rename
  (Xcode project refs).
- `.monica-map` / `.monica-map-popup` CSS class + selector pairs must rename
  together.

---

## Tier 2 — Map data layer overhaul (major initiative)

**Audit complete 2026-05-23.** Map library: MapLibre GL v5.18.0. Layer toggle
infra is solid (CSS display:none, no re-fetch on toggle). Problems are in the
data sources. Fix one at a time, test before moving on.

### Layer status

| Layer | Status | Root Cause |
|---|---|---|
| Earthquakes | Real | USGS free feed |
| Weather | Real | Open-Meteo free |
| Wildfires | Real | NASA EONET + FIRMS |
| Incidents | Real | OSM Overpass |
| News/Events | Real | [x] DONE 2026-06-13: `events.js`'s `countryCoords()` looked up ISO2 codes ("US") but GDELT's `sourcecountry` returns full English names ("United States") — never matched, so every event lost its coords. Rekeyed `COUNTRY_CENTROIDS` to ~140 country names. Lint clean. |
| Dispatch | US-only | PulsePoint US-only; news RSS fallback for Canada |
| Flights | Real | adsb.lol primary, OpenSky direct 6s-capped fallback |
| Local Events | Sparse | `PREDICTHQ_API_KEY` missing; Wikipedia/OSM only |
| Crime | Real (worldwide) | Vancouver/Surrey open data near BC + worldwide geocoded news fallback |
| Traffic | Entirely fake | TomTom/HERE keys gone; time-of-day heuristics only |
| AQI | Real | Stale — verified 2026-06-13: markers already use `_layerType: 'aqi'` (`LiveMapBackdrop.jsx:818`) matching the `mapLayers.aqi` toggle. Not broken. |
| POIs | Missing | Layer doesn't exist — needs Google Places key |
| Gas prices | Missing | Stub endpoint exists, needs API key — see below |
| Restaurants | Missing | Stub endpoint exists, needs API key — see below |

### API keys needed

| Env Var | Service | Cost | Calls/day | Where to get |
|---|---|---|---|---|
| `TOMTOM_API_KEY` | Traffic Flow + Incidents | **Free forever** | 2,500 | developer.tomtom.com |
| `TICKETMASTER_API_KEY` | Local events | **Free** | 5,000 | developer.ticketmaster.com |
| `PREDICTHQ_API_KEY` | Events (better data) | Freemium | 100 active | predicthq.com — optional, Ticketmaster covers this |
| `GOOGLE_PLACES_API_KEY` | POIs — restaurants, shops, parks | Paid ($200/mo free credit, ~$0 light use) | varies | [console.cloud.google.com → Maps → Places API (New)](https://console.cloud.google.com/apis/library/places-backend.googleapis.com) |
| `GAS_PRICES_API_KEY` | Gas station prices (per-station pins) | Free tier: 100 req/day | 100/day | [CollectAPI Gas Prices](https://collectapi.com/api/gasPrice/gas-prices-api) — alt: [GasBuddy Data](https://www.gasbuddy.com/developer) (waitlist) |

**Free data sources, no key needed:**
- Vancouver Open Data — crime (`opendata.vancouver.ca`)
- Surrey Open Data CKAN — crime (`data.surrey.ca`)
- USGS, NASA, OSM, GDELT, Open-Meteo — all free, all already integrated
- GlobalPetrolPrices.com — worldwide gasoline price-per-litre by country, no
  key, single page covers ~150 countries — see Gas prices note below

**Note on TomTom:** Traffic.js comment says "keys expired" — the key was
deleted, not the service. TomTom free tier is permanent (2,500 req/day, no
billing required). Use `TOMTOM_API_KEY`.

### Implementation order

1. **Events fix** — `server/api/local-events.js`
   - Add Ticketmaster as first source: `https://app.ticketmaster.com/discovery/v2/events.json?apikey={KEY}&latlong={lat},{lon}&radius=50&unit=km&size=50`
   - Only fires if `TICKETMASTER_API_KEY` set

2. **Traffic fix** — `server/api/traffic.js`
   - Replace fake heuristic with TomTom Traffic Flow: `https://api.tomtom.com/traffic/services/4/flowSegmentData/relative0/10/json?point={lat},{lon}&key={TOMTOM_API_KEY}`
   - Map to existing response shape (`congestion`, `currentSpeed`, `freeFlowSpeed`, `confidence`)

3. **POI layer** — three sub-tasks, all blocked on API keys

   **Restaurants + reviews** (needs `GOOGLE_PLACES_API_KEY`)
   - Endpoint stub: `server/api/places.js` — wire to [Google Places Nearby Search (New)](https://developers.google.com/maps/documentation/places/web-service/nearby-search)
   - Request: `POST https://places.googleapis.com/v1/places:searchNearby` with `includedTypes: ["restaurant"]`, `locationRestriction.circle`
   - Response shape: `name`, `rating`, `userRatingCount`, `regularOpeningHours`, `priceLevel`, `googleMapsUri`
   - Cache to Vercel Blob (1 hr TTL); render as teal pins on map; tap → card with rating + hours + "Get Directions"
   - Sign up: [console.cloud.google.com](https://console.cloud.google.com) → APIs & Services → Places API (New) → Create key → restrict to `places-backend.googleapis.com`

   **Gas prices** — BCAA Fuel Spy (previously recommended no-key source)
   returns 404, page no longer exists. Two remaining paths:
   - **No-key, worldwide, country-level**: `server/api/gas.js` scrapes
     `globalpetrolprices.com/gasoline_prices/` (one page, ~150 countries,
     USD/L), cache 24h, reverse-geocode user lat/lon → country → look up
     price. No per-station coordinates, so render as a small stat (e.g. in
     `SituationMonitor.jsx`: "Gas: $1.62/L (CA avg)"), not map pins — per
     CLAUDE.md no-fake-data rule.
   - **Per-station map pins, needs `GAS_PRICES_API_KEY`**: `server/api/gas.js`
     → [CollectAPI Gas Prices](https://collectapi.com/api/gasPrice/gas-prices-api),
     `GET https://api.collectapi.com/gasPrice/fromCoordinates?lat={lat}&lng={lon}`
     with `authorization: apikey {key}`. Cache 1hr; render as orange pin with
     price badge. Sign up: [collectapi.com/pricing](https://collectapi.com/pricing) — free tier 100 req/day.

   **General POIs** (needs `GOOGLE_PLACES_API_KEY`, same key as restaurants)
   - New: `server/api/pois.js` — Google Places Nearby Search, OSM fallback for types without Places coverage
   - Add `pois: true` to mapLayers state
   - Register in `api/gateway.js`
   - Add fetch + marker render in `LiveMapBackdrop.jsx`

4. **Clustering** — Add `supercluster` npm package
   - Cluster per-layer before rendering markers; re-cluster on zoom change
   - Changes `LiveMapBackdrop.jsx` marker creation blocks

5. **Lazy loading + debouncing**
   - Only fetch layers that are toggled on
   - 500ms debounce on center-change re-fetch trigger

6. **Map perf**: zoom-based culling in `LiveMapBackdrop.jsx` — marker caps
   went ~3x in v1.9.0, dense cities now render hundreds of markers at low zoom.

---

## Tier 3 — Medium (1–2 hr)

### Stripe — verify config (code is complete)
`server/api/stripe.js`, `server/api/stripe-webhook.js`, `useSubscription`,
`PricingPage` exist and work. Server enforcement: `gates.js`'s `isPro` gates
**autopilot live trading** (`broker/autopilot.js`, `broker/morning-run.js`) —
verified working. Correction 2026-06-13: `checkFreeAiLimit` and `AiPanel`
do NOT exist anywhere in the codebase — that claim was stale/aspirational.
See "AI is the only gated feature" below.
- [x] `STRIPE_PRICE_ID_STARTER`, `STRIPE_PRICE_ID_PRO`, `STRIPE_WEBHOOK_SECRET`,
  `STRIPE_SECRET_KEY` all confirmed present in Vercel production (checked
  2026-06-13 via `vercel env ls production`).
- Remaining: confirm the live webhook endpoint is actually registered in the
  Stripe dashboard and that `STRIPE_PRICE_ID_PRO` value matches
  `price_1THURbBmnhdgU9sGA4usKDw1` (no Stripe API access locally to verify).

### Auth UX
- Surface the already-built Apple Sign In (`auth.js` ~line 265) on
  `LoginPage.jsx` — blocked: needs an Apple Developer Services ID/client ID
  for the web Sign In with Apple JS SDK (cannot self-provision, needs Joshua's
  Apple Developer account). Also flagged 2026-06-13: `signin-apple` in
  `auth.js` doesn't verify the JWT signature against Apple's JWKS — security
  follow-up once unblocked.
- Add TOTP 2FA (Wealthsimple-grade)


- [x] Macro native parity (cosmetic) — DONE 2026-06-13: `deficit` (FRED FYFSD,
  reported in millions) now renders as trillions (e.g. "-$1.77T") in
  `ios/Views/MacroView.swift` and `macos/Views/MacroView.swift`, matching web's
  `formatTrillions`. `joblessClaims`/"K" formatting was already correct
  (divides by 1000 above 10000) — not actually broken, roadmap note was stale.

---

## Tier 4 — Larger features (2+ hr)

### Net Worth + Predictions
- Pull `USER_ACCOUNTS`, `USER_DEBT`, `USER_GOALS`, `USER_INCOME_PHASES` from `userProfile.js` into unified net-worth view
- Chart current net worth over time from portfolio history + projected trajectory
- Run `projectNetWorth()` from `debtProjections.js` using real KV portfolio snapshots
- Show debt-free date, savings milestone dates, surplus trend
- `FinanceDashboard.jsx` has simulation infra — wire in real data

### Data sources expansion
- **Reuters/AP wire** via NewsAPI or Mediastack
- **SEC filings** via EDGAR RSS
- **StatCan** releases, Bank of Canada rate decisions
- **assetmarketcap.com** integration (`server/api/assetmarketcap.js` proxy/cache route)

### AI Analyst feature (blocked — prerequisite for the two items below)
2026-06-13: there is no AI chat/analyst panel in the codebase to extend.
Both items below assume one exists. Either build a base AI Analyst panel
first (provider TBD — see "AI is the only gated feature" above for the
gating/pricing decision this depends on), or drop these two items.

### Local LLM fallback (Ollama) — blocked on AI Analyst panel above
- Wire AI panel to Ollama endpoint (`http://localhost:11434/api/generate`)
- Settings model selector: `claude` vs `ollama/gemma4:e2b`
- Gate: health check before showing local option

### AI Enrich (deferred) — blocked on AI Analyst panel above
- `people-enrich.js` doesn't exist (roadmap reference was stale); would need
  to be written from scratch using `ANTHROPIC_API_KEY`
- Hold until provider cost decision is made

### Native parity (v1.8.0–v1.9.0 features still web-only)
- Cached news, full macro series, real PDF spending, and the map Gotham pass
  are web-only; iOS/macOS still on legacy `stocks.js`


### Apple Pay / StoreKit native upgrade
- Stripe gate exists server-side; wire IAP for Pro. No custodial banking (regulatory).

---

## Tier 5 — Long-term

### iOS map sources (custom tile overlay)
- Swap SwiftUI `Map {}` for `MKMapView` via `UIViewRepresentable` in `SituationView.swift`
- New `ios/Helpers/MapViewRepresentable.swift` — `MKTileOverlay` for any XYZ tile URL
- Settings picker: 10 presets (OSM, ESRI Satellite, Stamen Terrain, CartoDB Dark, etc.) + custom URL field

### App polish
- TradingView widget embedding (Pine Scripts exist in `tradingview/`)
- [x] Split `App.jsx` into smaller modules — DONE 2026-06-13: 1,355 -> 977 lines.
  Extracted `useElapsedTime`, `useRunHistory`, `useTradeShortcuts`,
  `usePredictionMarketTrading` (hooks/). Also deleted: ~80 lines of dead prediction-market
  UI state/handlers (`pmCategory`, `filteredMarkets`, `handleMarketClick`, etc. - never
  rendered), a stale commented-out simulation block, and the entire `simulatorPanel` JSX
  + its exclusive deps (`useChartData` hook, `realWorldTime`, `heroTextShadow`, `pnlGreen`,
  `pnlBg`, `bgProgress`, `showChart`) — the `simulator` tab was never in `TAB_PILLS` or
  reachable via keyboard/command-bar, so the whole panel was unrendered dead code.
  `pmBalance` state (tracked but never displayed) also removed from
  `usePredictionMarketTrading`.
  - Deferred (own session): `useTradeSimulator()` — the ~350-line RAF animation loop +
    position-management core (`App.jsx` state/refs + tick effects), still feeds
    `simData` -> SituationMonitor and the Space/R keyboard shortcuts even with no visible
    panel. Most interdependent piece, needs dedicated manual smoke-testing before/after.
  - Other oversized files noted as future `/simplify` targets (no action yet):
    `PeoplePanel.jsx` (2113 lines), `FinancePanel.jsx` (1559), `StockDetail.jsx` (1235),
    `LiveMapBackdrop.jsx` (1023).
- Life section / roadmap projection (connect `RoadmapProjection.jsx` with real milestone data)

### Security + API audit
- Per-service API audit: keep/drop, data populated?, reliable?, safe?
- Tighten CSP, review auth flows

---

## Free vs Premium ($1/wk)

| Free | Premium |
|---|---|
| Map + all data layers | Autopilot (live trading) |
| Situation monitor | Portfolio + watchlist |
| Stock data + ticker | Ontology writes + batch |
| Weather/quakes | Deep news + crime data |

---

## Monetization

Strategy: the ambient intelligence layer (map, events, news, markets) stays free
to drive signups; the money features are premium. Feature→tier map lives in
`src/config/features.js`; server enforcement via `isPro()` in `server/api/gates.js`.

| Phase | Trigger | Moves behind premium |
|---|---|---|
| 1 (live) | shipped | Autopilot auto-trading (paper + live via SnapTrade) |
| 2 | ~25 paying users | Trade recommendations, brokerage sync, Daily Brief |
| 3 | ~100 paying users | People graph, deep news/crime layers, alerts |

Free tier always keeps: map + local events, headlines, basic market quotes.

---

## Shipped

The full shipped list now lives in [README.md](README.md#shipped).
