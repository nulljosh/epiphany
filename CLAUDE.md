# Epiphany

v2.6.0 -- Personal intelligence platform. Palantir for regular people. App Store: v1.0 live (READY_FOR_SALE) since 2026-06-23; v2.5.1 (build 6) submitted for review 2026-06-30, WAITING_FOR_REVIEW — not yet live (https://apps.apple.com/app/epiphany/id6779522175).

## Screenshot pipeline status (2026-07-04)
Fixed real bugs in `ios/scripts/update_screenshots.sh` + UI test: What's New sheet
now dismissed before capture, device-name mismatch in copy step fixed, and
`SNAPSHOT_EMAIL`/`SNAPSHOT_PASSWORD` now correctly forward from
`.env.accounts.local` into the UI test runner (Xcode schemes don't pass shell env
into Test actions unless declared — added to `ios/project.yml`
`schemes.Epiphany.test.environmentVariables`). Still unresolved: logging into a
real account (jatrommel@gmail.com, Wealthsimple-linked) in the UI test failed
outright (landed on "Sign In" screen, not authenticated) — root cause not yet
diagnosed, could be wrong password, 2FA, or the 10s post-launch wait being too
short for a real login vs the seeded demo account. Last screenshot commit
(`4283091`) has this logged-out state — needs a fix-forward or revert next
session before shipping to the App Store listing.

## Shipped (2026-06-30)
- [x] iOS v2.5.1 (build 6) submitted to App Store — export compliance answered, What's New (en-CA) filled, WAITING_FOR_REVIEW

## Shipped (2026-06-28)
- [x] ToS checkbox required on register — `src/components/RegisterPage.jsx`, `public/tos.html`
- [x] GitHub Sign In/Up buttons on login + register pages
- [x] GitHub OAuth backend — `github` + `github-callback` actions in `server/api/auth.js`
- [x] GITHUB_CLIENT_ID + GITHUB_CLIENT_SECRET set in Vercel production

## Known issue (post-launch)
SnapTrade phantom holdings: FIXED 2026-07-02 — `listAccounts()` now dedupes accounts by id (SnapTrade returned duplicates, doubling every position); holdings merge keys on account id, not name. Trade tab in `FinancePanel.jsx` still disabled — re-enable after Josh eyeballs a real force-sync.

## Rules

- Map stays steady -- no jumps on load, no flashing on state changes
- No fake prices before real data arrives
- Mobile-first layout
- Web: dark only (Gotham brand, hardcoded dark surfaces). Native (iOS/macOS/watchOS): follows system appearance via adaptive `Palette`
- iOS app: four tabs (Situation, Markets, Portfolio, Settings)
- Web app: epiphany.heyitsmejosh.com
- Never use raw `setInterval` for API polling -- always use `useVisibilityPolling` from `src/hooks/useVisibilityPolling.js`

## Run

```bash
npm install && npm run dev
npm test -- --run
npm run build
```

Deploy: Vercel. Repo: github.com/nulljosh/epiphany

## Key Systems

- **Gateway**: `api/gateway.js` -- critical routes static-imported; everything else lazy-loaded
- **Auth**: `server/api/auth.js`, `server/api/auth-helpers.js`
- **Map**: `src/components/LiveMapBackdrop.jsx` (11 data layers, MapLibre GL)
- **Local events/places**: `server/api/local-events.js` tags every result with `kind` — `place` (Wikipedia towns/cities, OSM venues/parks) vs `event` (PredictHQ, Eventbrite, news RSS). Detail views (iOS/macOS `SituationView`, web popup) label "Place" vs "Event" and never call a town an event. Wikipedia places carry a lead `image` (pageimages) and a full intro extract (`exintro`+`exchars=600`, not `exsentences` which truncated on abbreviation periods like "(pop. approx."). Reviews/ratings are a gated follow-up — needs `GOOGLE_PLACES_API_KEY` (none set, no fake data).
- **KV**: `server/api/_kv.js` (Upstash Redis) — always import via `getKv()`, never `@vercel/kv` directly
- **Stocks**: `server/api/stocks-free.js` (web + watchOS) and `server/api/stocks.js` (iOS/macOS). Fundamentals from Yahoo v10 quoteSummary authenticated with cookie+crumb. Optional `FMP_API_KEY` in Vercel overrides Yahoo.
- **History**: `server/api/history.js` -- Yahoo Finance proxy. Accepts range (1d/5d/1mo/3mo/6mo/1y/2y/5y/10y/ytd/max) + interval (1m/5m/15m/1d etc). iOS maps 1m→(1d,1m), 15m→(5d,15m), max→(max,1d).
- **Avatar**: `server/api/avatar.js` -- accepts JPEG or SVG (`format: 'svg'`), stores to Vercel Blob. Web generates 8-bit pixel art SVG; iOS/macOS use photo picker JPEG. iOS rasterizes SVG avatars via `SVGRasterizer.swift` (WKWebView snapshot) when fetching web-uploaded SVGs.
- **Brokerage sync**: `server/api/broker/sync.js` — SnapTrade read-only sync of holdings + cash + per-account balances (`SnapTradeAdapter.getAccounts()` in `src/utils/brokers/snaptrade.js`, name/type inferred dynamically, no hardcoded account list). Requires `SNAPTRADE_CLIENT_ID` + `SNAPTRADE_CONSUMER_KEY` in Vercel. UI at Settings → Brokerage.
- **TradingView MCP**: `.mcp.json` wired to `_external/tradingview-mcp/src/server.js` — CDP tools for chart analysis and Pine Script dev.
- **Landing Page**: `src/pages/LandingPage.jsx` + `src/pages/landing.css` -- shown to unauthenticated visitors before auth flow. Fraunces serif headlines, animated node-graph canvas, scrolling ticker, feature/pricing sections. Gate in `App.jsx` via `showLanding` state.
- **Finance/Roadmap**: `src/components/EpiphanyFinance.jsx` — spending history, tracker, and 17-year forecasts. Wired to Portfolio → Roadmap tab.
- **Roadmap**: `ROADMAP.md`

## Imported from Epiphany.pdf (2026-06-21)
- [ ] watchOS — no ASC app record exists for `com.heyitsmejosh.epiphany.watchos`; watch apps typically bundle with iOS rather than ship standalone — needs a decision.
- [ ] Mac screenshots to ASC App Store listing — requires creating an "App Store" version (description/keywords) in ASC first for the "Epiphany Mac" app record (id 6782703473); can't be scripted blind.

## Recent changes
- Spending categories split into starbucks/liquor/transfer subtypes (coarser categories before)
- Confirmed Epiphany.pdf bug reports (NYC map glitch, flights unavailable) already fixed

## Roadmap

Ordered by effort (fewest tokens → most). Ship the top first. Last updated: 2026-06-13.

### Open

- **2026-06-23: Venue photos/reviews — backend shipped, UI wiring pending.**
  `server/api/venue-details.js` (Yelp Fusion, free, no billing) is built and
  registered in `api/gateway.js`, but no-ops until `YELP_API_KEY` is set in
  Vercel (Joshua: sign up free at yelp.com/developers, no credit card). Once
  the key is set, still needs: web popup wiring in `LiveMapBackdrop.jsx`,
  iOS `VenueDetailSheet` in `ios/Views/SituationView.swift` (~L1515-1565),
  and the macOS equivalent in `macos/Views/SituationView.swift` — each calls
  the new endpoint with `{name, lat, lon}` and renders photos + review
  snippets when `available: true`. Plan: `~/.claude/plans/spicy-mapping-reddy.md`.
- **ASC: remove duplicate macOS platform from "Epiphany" (iPhone) app record** —
  App Information → deactivate macOS App section. Standalone "Epiphany Mac"
  record (id 6782703473) already covers macOS distribution. Manual ASC click,
  not scriptable. Decided 2026-06-22: leave it, low value, ignore going forward.
- **ASC: resolve "Missing Compliance" on Epiphany Mac build** — Build Activity
  flags export compliance as unanswered, blocking submission past "Prepare for
  Submission." Manual ASC click, not scriptable.
- **2026-06-22: Epiphany Mac build uploaded successfully** — fixed version mismatch
  (2.2.4 → 1.0 to match existing ASC version record), archived, exported as .pkg,
  uploaded build 1.0 (1). Content rights + copyright also set.
- **2026-06-22: Epiphany Mac support URL missing** — required before submission,
  needs a real URL decision.
- **2026-06-22: watchOS app decision needed** — `EpiphanyWatch.xcodeproj` is set up
  as a *standalone* watch app (`WKWatchOnly: YES`, own bundle
  `com.heyitsmejosh.epiphany.watchos`), not an embedded WatchKit extension of the
  iOS app. No ASC app record exists for it. Creating a new standalone ASC record
  needs either the official API (asc CLI doesn't expose app creation) or an
  unofficial/discouraged web-session flow requiring live Apple ID + 2FA — not run
  unattended. Recommended fix: re-embed the watch app as a companion WatchKit
  extension target inside `ios/project.yml` instead (standard pattern, no new ASC
  record needed) — not yet done, needs its own build-verification pass since it
  touches the already-submitted iOS app's project structure.
- **Map event animations** — loading/popup states for events rendering on the
  map feel abrupt. Reference: lottiefiles.com for lightweight Lottie loading
  animations, cross-platform (web + iOS/macOS/watchOS). Not started — needs a
  design pass on which events specifically get an enter/loading animation
  before touching `LiveMapBackdrop.jsx`.
- **"Map too zoomed out, renders no sources" — ROOT CAUSE FOUND 2026-06-21, fix not yet applied.**
  `LiveMapBackdrop.jsx:442` builds the data-fetch bbox as a **fixed `center ± 1°`**
  box (~111km) for incidents/traffic/flights/emergency, regardless of current
  zoom. It's not a culling/decimation bug (`decimateByZoom` is fine). At low
  zoom the visible map area is much larger than 111km, so almost everything
  on screen is outside the fetched box and looks empty. Fix: scale the bbox
  size to current zoom (e.g. derive degrees from the map's actual visible
  bounds via `map.getBounds()` instead of a hardcoded ±1). Not applied this
  pass — touches 5 API calls + needs a sanity check on API rate limits for a
  bigger bbox at low zoom.
- **Landing page screenshots incomplete** — `LandingPage.jsx` currently only
  shows a map screenshot. Should also show Markets, Portfolio, and Settings
  tabs, plus matching watchOS + macOS screenshots (README parity). Not
  started — screenshot pipeline needs the map-too-zoomed-out bug (line ~212,
  zoom-based culling) fixed first or screenshots will look broken.
- [x] People tab — DECIDED + DONE 2026-06-21: unhidden in `App.jsx` TAB_PILLS.
  `PeoplePanel.jsx` (2,113 lines) and its full backend (`/api/people`,
  `/api/people-index`, `/api/people-crossref`, `/api/people-import`) were
  already complete, just excluded behind an "early dev" comment with no
  documented bug. Verified clean merge against the current app: prop
  signature (`dark`, `t`, `isAuthenticated`) matches what `App.jsx` already
  passes, build succeeds, full test suite passes (392/394, 2 pre-existing
  skips). If real use surfaces rough edges, re-hiding is a one-line revert.
  **Cross-platform status**: web ✅ done. macOS ✅ done same day — `PeopleView.swift`
  already existed, was just missing from `ContentView.AppSection`'s enum (not
  merely hidden); wired in as a 5th tab (Cmd+3), `xcodebuild` BUILD SUCCEEDED.
  iOS ⚠️ — only `PersonModels.swift` + API calls exist, no UI was ever built;
  this is net-new SwiftUI work, not an unhide, left for its own session.
  watchOS — out of scope by design (3 fixed glance views only, no People
  models/API exist there either).
- [x] TradingView MCP / account sync — DECIDED 2026-06-21: not buildable as
  asked. There's no public TradingView API for reading a user's
  watchlist/account, so "sync alerts, watchlist" from a linked TradingView
  account isn't something to build, full stop. The MCP server in `.mcp.json`
  (`_external/tradingview-mcp`) is a dev-tool for chart analysis/Pine Script
  authoring and is unrelated to this ask — no change needed there. The one
  legitimate integration path going forward: TradingView Pro+ accounts can
  fire outbound webhook alerts, which Epiphany could receive via a new
  `/api/tradingview/webhook` endpoint (alerts-in only, no OAuth/account
  linking needed). Not built this pass — real new feature needing
  auth/storage design — but the open question is now closed with a concrete
  next step instead of re-deferred.
- [x] Add `og:title`/`og:description`/`og:image` meta tags to `index.html` — DONE 2026-06-21 (commit `c355a33`): added og:title/description/image/type/url + twitter:card + a plain `<meta name="description">`, using LandingPage.jsx's hero copy and `screenshot-situation-new.png` as the OG image. The rest of a June design-review note's "splash page is blank" claim is stale (`LandingPage.jsx` already ships a full hero/feature/screenshot/CTA landing for unauthenticated visitors, see CLAUDE.md).
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

#### macOS open items (merged from `macos/plan.md`, 2026-06-13)

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

#### Ontology / "Bridge to A+" push (largest item — do this in its own session)

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

#### Monica/Opticon → Epiphany rename sweep (~128 refs across 50 files, web + iOS + macOS + watchOS)

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

### Tier 2 — Map data layer overhaul (major initiative)

**Audit complete 2026-05-23.** Map library: MapLibre GL v5.18.0. Layer toggle
infra is solid (CSS display:none, no re-fetch on toggle). Problems are in the
data sources. Fix one at a time, test before moving on.

#### Layer status

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

#### API keys needed

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

#### Implementation order

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

### Tier 3 — Medium (1–2 hr)

#### Stripe — verify config (code is complete)
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

#### Auth UX
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

### Tier 4 — Larger features (2+ hr)

#### Net Worth + Predictions
- Pull `USER_ACCOUNTS`, `USER_DEBT`, `USER_GOALS`, `USER_INCOME_PHASES` from `userProfile.js` into unified net-worth view
- Chart current net worth over time from portfolio history + projected trajectory
- Run `projectNetWorth()` from `debtProjections.js` using real KV portfolio snapshots
- Show debt-free date, savings milestone dates, surplus trend
- `FinanceDashboard.jsx` has simulation infra — wire in real data

#### Data sources expansion
- **Reuters/AP wire** via NewsAPI or Mediastack
- **SEC filings** via EDGAR RSS
- **StatCan** releases, Bank of Canada rate decisions
- **assetmarketcap.com** integration (`server/api/assetmarketcap.js` proxy/cache route)

#### AI Analyst feature (blocked — prerequisite for the two items below)
2026-06-13: there is no AI chat/analyst panel in the codebase to extend.
Both items below assume one exists. Either build a base AI Analyst panel
first (provider TBD — see "AI is the only gated feature" above for the
gating/pricing decision this depends on), or drop these two items.

#### Local LLM fallback (Ollama) — blocked on AI Analyst panel above
- Wire AI panel to Ollama endpoint (`http://localhost:11434/api/generate`)
- Settings model selector: `claude` vs `ollama/gemma4:e2b`
- Gate: health check before showing local option

#### AI Enrich (deferred) — blocked on AI Analyst panel above
- `people-enrich.js` doesn't exist (roadmap reference was stale); would need
  to be written from scratch using `ANTHROPIC_API_KEY`
- Hold until provider cost decision is made

#### Native parity (v1.8.0–v1.9.0 features still web-only)
- Cached news, full macro series, real PDF spending, and the map Gotham pass
  are web-only; iOS/macOS still on legacy `stocks.js`

#### Apple Pay / StoreKit native upgrade
- Stripe gate exists server-side; wire IAP for Pro. No custodial banking (regulatory).

### Tier 5 — Long-term

#### iOS map sources (custom tile overlay)
- Swap SwiftUI `Map {}` for `MKMapView` via `UIViewRepresentable` in `SituationView.swift`
- New `ios/Helpers/MapViewRepresentable.swift` — `MKTileOverlay` for any XYZ tile URL
- Settings picker: 10 presets (OSM, ESRI Satellite, Stamen Terrain, CartoDB Dark, etc.) + custom URL field

#### App polish
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

#### Security + API audit
- Per-service API audit: keep/drop, data populated?, reliable?, safe?
- Tighten CSP, review auth flows

### Free vs Premium ($1/wk)

| Free | Premium |
|---|---|
| Map + all data layers | Autopilot (live trading) |
| Situation monitor | Portfolio + watchlist |
| Stock data + ticker | Ontology writes + batch |
| Weather/quakes | Deep news + crime data |

### Monetization

Strategy: the ambient intelligence layer (map, events, news, markets) stays free
to drive signups; the money features are premium. Feature→tier map lives in
`src/config/features.js`; server enforcement via `isPro()` in `server/api/gates.js`.

| Phase | Trigger | Moves behind premium |
|---|---|---|
| 1 (live) | shipped | Autopilot auto-trading (paper + live via SnapTrade) |
| 2 | ~25 paying users | Trade recommendations, brokerage sync, Daily Brief |
| 3 | ~100 paying users | People graph, deep news/crime layers, alerts |

Free tier always keeps: map + local events, headlines, basic market quotes.

### Shipped

The full shipped list now lives in [README.md](README.md#shipped).

### Stashed 2026-06-21
- [ ] App Store Connect shows a placeholder icon for "Epiphany Mac" — the local macOS `AppIcon.appiconset` (`macos/Assets.xcassets/AppIcon.appiconset/`) is actually complete and valid (16–1024, verified via `sips`). The placeholder is just because no build has been archived/uploaded yet for that target — archive & upload via Xcode/Transporter to populate it in ASC.

### From Epiphany.pdf (imported 2026-06-23)
- [x] CI: latest GitHub Actions run on main is green (`Tests` workflow).
- [x] "Situation tab moves map to NYC" glitch — already fixed in commit ca1cd29 (2026-06-21, "Fix map permanently stranding on NYC after Situation tab mount"). Verified: `useSituation.test.js` passes (15/15).
- [x] "Flights temporarily unavailable" — already fixed in commit bfba323 (2026-06-21). OpenSky (the IP-blocked source) was removed entirely; flights now come from adsb.lol, no API key required. The PDF note predates this fix.

## Feature Tracker (seed — 2026-06-21)

Status legend: Untested | Pass | Fail | Blocked

| Feature | User story | Status |
|---|---|---|
| Situation map (iOS/macOS/web) | As a user, I see a live map with 8+ toggleable data layers (earthquakes, flights, incidents, weather, crime, events, traffic, wildfires) that stays steady — no jumps on load. | Untested |
| Markets list | As a user, I browse stocks/commodities/crypto with filters, search, and sparkline charts, and can open a detail sheet per asset. | Untested |
| Portfolio | As a user, I see my net worth, spending forecast, holdings, budget, debt/goals calendar, and statements. | Untested |
| Brokerage sync (SnapTrade) | As a user, I connect a brokerage and see read-only synced holdings/cash/balances. | Untested |
| Settings — profile/avatar | As a user, I set a profile photo or generate a pixel-art/node-graph avatar. | Untested |
| Auth (email/password) | As a user, I sign up, log in, and stay logged in between launches. | Untested |
| People tab (macOS) | As a user, I search/view people-related data in a dedicated tab. | Untested |
| Daily Brief / Fear & Greed | As a user, I see a daily market brief and fear/greed index on the Markets tab. | Untested |
| Landing page (web, unauthenticated) | As a visitor, I see a marketing landing page before signing in. | Untested |

This is a seed list only — a full feature audit, per-story testing pass, and UX/logistics fix loop was explicitly deferred by the user to a future session. Do not expand this without that go-ahead.

## Roadmap (from 2026-06-28 PDF)
- [ ] Map results: show photos + reviews, tighten layout
- [ ] iOS login: use Epiphany branding; add Sign in with Apple on both login + register screens
- [ ] All iOS apps: add "What's New" screen shown on first launch after update
- [ ] Maps: copy Google Maps local-vibe drawer style (photos, local info, vibe)
- [ ] Maps: let users save locations + add custom labels
