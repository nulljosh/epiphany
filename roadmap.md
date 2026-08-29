## Google sign-in on native: server is DONE, only the client is missing (verified 2026-08-28)

`https://epiphany.heyitsmejosh.com/api/auth?action=google` returns a live **302** to
accounts.google.com using client_id `455155642136-...apps.googleusercontent.com` — the same
Google Cloud client the shared Supabase project uses — with redirect_uri
`https://epiphany.heyitsmejosh.com/api/auth?action=google-callback` already configured.

So the "blocked on Joshua registering a Google app" note elsewhere is **stale for Epiphany**.
The web half works today. What is actually missing for iOS/macOS:

1. A Google button in `ios/Views/LoginSheet.swift` + the macOS equivalent, driving
   `ASWebAuthenticationSession`.
2. A custom URL scheme — Epiphany has **none** registered. Add `CFBundleURLTypes` via
   `ios/project.yml`'s generated info block, never the plist (xcodegen rewrites it).
3. A server change so the google-callback can redirect back to `epiphany://` for the native
   client instead of only to the web app.

Do NOT re-add Sign in with Apple here. It was removed 2026-08-28 to clear the Guideline
2.1(a) rejection and 2.5.6 is in review on that basis; revisit only after a verdict.

## RESOLVED 2026-08-26: /api/stocks 500 on the full default symbol list

Cloudflare Workers cap a single invocation at **50 subrequests**. This handler had
THREE per-symbol fan-out paths: FMP quote+ratios (2 subrequests each), the v8 chart
fallback (1 each), and v10 fundamentals enrichment (1 each). The 63-symbol default
list issued well over 100, so everything past the cap failed -- including the Upstash
KV read inside `getYahooCrumb`, which is what finally showed up in `wrangler tail` as
`[KV] get error: Too many subrequests by single Worker invocation`.

A second, independent bug masked it: early returns dropped response bodies without
reading or cancelling them. Workers cap concurrent in-flight responses and an unread
body never completes, so the runtime cancelled the oldest and unrelated fetches failed.
Fixed with `discardBody()`; that removed the stall warnings and exposed the real error.

Fix: Yahoo **v7 batch quote** first (one subrequest for all 63 symbols), with the two
per-symbol paths gated behind `PER_SYMBOL_FANOUT_MAX = 15`. Verified in production:
`/api/stocks` returns 200 with 62 symbols.

Worth remembering: the thrown error said "Yahoo Finance v8 chart API returned no data",
which was misleading -- Yahoo was fine, the Worker had simply run out of subrequests.
Diagnose Workers 500s with `wrangler tail` before trusting the handler's own message.

## 2026-08-10 (late) — UI + data pass, shipped
- [ ] **Not verified this session**: iOS statement upload with a real PDF. The web path and
  all builds pass, but Josh's "haven't seen it work in months" on mobile was not reproduced
  or confirmed fixed. Do this first next session.
- [ ] **Debt rows have no sign convention.** The `Family` $100 row is really a *receivable*
  — Josh said "they owe me $100" — but it renders as a debt because `{ balance }` is
  unsigned everywhere in the debt model (`userProfile.js`, `usePortfolio.js`,
  `server/api/portfolio.js`, `debtPayoff.js`). Showing money owed *to* Josh needs a real
  decision: a sign, a `direction` field, or a separate receivables list.

## Urgent
- [ ] **Dashboard cleanup: two leftover draft submissions (5156cbcb, f88508a7) from retry attempts.** iOS 2.5.6 submitted 2026-08-28 WAITING_FOR_REVIEW (submission e55e6142). The 4 initial stale drafts were deleted, but retrying failed submits before that created 2 new drafts that remain. They are harmless but count toward Apple's concurrency limit (max 5). Dashboard-only cleanup via "Draft Submissions" panel. See [[reference_asc_stray_curvely_submission]] for the full concurrency trap.
- [ ] **Statement upload — two real bugs found and fixed 2026-08-10, awaiting Josh's retry to confirm they were *the* cause.** The 08-06 Blob fix was genuinely incomplete; two independent second bugs existed, both of which produce exactly "the statement never landed":
  1. **Unparseable PDF → 500, upload discarded** (fixed, regression test added). `summarizeStatementBuffer` returned `{ spendingMonth: null }` whenever `pdf-parse` threw, and the upload handler's dedupe then did `spendingMonth.month` on that null → `TypeError` → the outer catch returned a 500 with `statements: []`. The PDF was already written to Blob at that point, so it was orphaned and never recorded in KV. Any statement whose PDF pdf-parse can't read (encrypted, or a newer Wealthsimple template) failed permanently and silently this way. Fixed at the source in `server/api/statements-data.js` — falls back to `summarizeTransactions([], filename)`, so an unreadable statement is still stored and just gets named after its filename. Belt-and-braces `?.` in `server/api/statements.js`. Test: `tests/api/statements.test.js` "still stores a statement whose PDF could not be parsed".
  2. **Advertised 25MB cap the transport cannot carry** (fixed). The PDF travels base64-encoded inside a JSON body to a Vercel *Serverless Function*, whose request-body limit is **4.5MB, enforced by the platform** — the handler never runs, so the client got a bare 413 with no useful message. Base64 inflates 4/3, so the honest PDF ceiling is 3MB, not the 25MB that `server/api/statements.js`, `ios/Views/PortfolioView.swift` and `macos/Views/PortfolioView.swift` all claimed (25MB was Blob's limit, which this path never gets to use). All three now say 3MB and reject oversized files client-side with a real message.
  - **Still needs Josh**: retry the June + July 2026 uploads. If they now land, done. If they're over 3MB, the clear error will say so and the real fix is the upgrade path noted in `statements.js` — client-direct upload to Blob (`@vercel/blob/client` `handleUpload` + a token route), which bypasses the function body entirely. That's a cross-platform client change deserving its own session, not a constant.
- [ ] SnapTrade billing: Josh believes it was paid — not independently re-verified this session (ran out of time/budget). Confirm via SnapTrade dashboard before trusting the "disabled key" urgent item above is stale.

## From Apple Notes (imported 2026-08-08)
- [ ] Follow-up on the above: the fallback is a **publisher favicon, not a true per-article image**. Genuinely per-article imagery needs og:image, which for Google-sourced items means resolving the opaque `CBMi...` redirect *then* fetching the article page — ~2 network round-trips per row, too expensive to do inline in the handler. Only worth building if GDELT stays dead; check whether GDELT recovers first (it is rate-limiting shared Vercel IPs — "Please limit requests to one every 5 seconds"), since a healthy GDELT already supplies real images for free.

## OAuth rollout (2026-08-24)
- [ ] iOS GitHub + Google sign-in: integrate native SDK flows. Web already ships hand-rolled GitHub + Google OAuth (server/api/auth.js:202-329, implemented 2026-07-09), no new web work needed. Existing Sign in with Apple (iOS native) stays as-is.

## App icon
- [ ] `AppIcon-dark.png`/`AppIcon-tinted.png` are byte-identical copies of the light icon, not actually designed — cosmetic, tinted variant won't tint meaningfully.
- [ ] Icon still reads generic/weak overall — a real personality refresh has been repeatedly deferred (imported from App Store.pdf 07-29, reconfirmed 08-04).

## Ship 2.5.4 — DONE
Confirmed 2026-08-06: iOS 2.5.4 is READY_FOR_SALE/live. macOS remains at 2.5.2 (statement-upload fix was iOS-only at the time; macOS parity landed separately 08-04, see above) — bump macOS if the Mac statement UI work should ship as a version.

## Markets news drawer drag — still choppy (3 attempts, all failed)
User confirmed live on-device it's not as fluid as native iOS Stocks, across three separate fix attempts (07-07, 07-07 later, 07-22 — reverted, commit `69f82c6`). Root cause not found. Do NOT attempt a 4th blind fix.
- Attempt 1: moved `.frame(height:)` off per-drag resizing to a fixed max-height + outer clip animation. Real perf issue, not the (or not the only) felt cause.
- Attempt 3: replaced per-drag resize with `.offset(y:)` compositor transform (textbook fix for this SwiftUI pattern) — broke drag hit-testing (touch passed through to the row underneath instead of moving the drawer). Reverted. Suspected cause: the drag handle's `.overlay(alignment: .top)` is attached to the offset-shifted view, whose own layout frame stays fixed size — something in the offset→padding→overlay→clipped chain desyncs the touch target from the rendered position.
- [ ] Before attempting again: (1) get Josh to describe specifically what feels wrong (lag following finger / jank on release / stutter during momentum / frame drops with images loading), (2) profile with Instruments Time Profiler on a real device — none of the 3 attempts have done either. Consider testing the offset approach on an isolated dummy view first, or attaching `DragGesture` to a stable sibling view instead of the offset-shifted card.

## Epiphany Mac merge (ASC)
- [ ] Old orphaned "Epiphany Mac" app record (6782703473, bundle `com.heyitsmejosh.epiphany-macos`) needs Joshua's manual ASC dashboard deletion — no public API to delete an app record (confirmed on Talli's/Voxprint's equivalent orphans too). Do not upload anything further to it. Full merge history/blockers (upload error 90348, three widget compile fixes) preserved in CLAUDE.md.

## Brand & landing page
- [ ] **Brand identity pass (raised by Josh, not started)** — iOS/macOS/web lean entirely on default Apple styling (`Palette.appleBlue`, SF Symbols only), no signature color/typography beyond the landing page's Fraunces headline. Ideas: one signature accent color app-wide (no gradients/purple), reuse Fraunces for in-app section headers, a custom map style/pin set (biggest available differentiation surface now that native POI pins are off). Needs its own dedicated design session.
- [ ] "Coolest app ever" — explore an unnamed app/website's idea and integrate it (from Coolest app ever.pdf). Underspecified — ask Joshua which app/site before scoping.
- [ ] Landing page screenshots must use a real populated account, not a demo account (currently renders an empty portfolio, looks broken on the marketing site).
- [ ] Fresh App Store screenshots (fastlane snapshot erroring, exit 75) — optional, 2.5.1 shots still carry over fine.

## Commodity/crypto detail parity
- [ ] iOS/macOS mirror of web's commodity/crypto stats grid (dayHigh/dayLow/prevClose, high24h/low24h — backend shipped 07-19). Bigger than a mirror pass: no iOS/macOS view renders `CommodityData`/`CryptoData` at all yet (`StockDetailView.swift` is equity-only) — needs a dedicated session to build the detail view first, then add stats fields.
- [ ] Derivable without new backend work: Period High/Low from already-loaded price history; SMA20/EMA50 overlays on the commodity chart (client-side, `StockDetailView` already computes these for equities — reuse). Needs a chart refactor pass.
- [ ] Mirror Yahoo Finance layout: at drawer `.large`, the ticker bar should own ~top 10% of the view — visual-proportion tuning, do live on the sim.

## Trading / brokerage
- [ ] **Evaluate replacing SnapTrade with Interactive Brokers** — SnapTrade is read-only by design (blocks live trading, forced `AutopilotSection()` to be commented out); IBKR Web API would unblock it. Needs scoping: auth model, holdings/positions endpoints, cost, SnapTrade sync-layer reuse. (The SnapTrade billing outage above is a good moment to revisit this.)
- [ ] Live trading blocked on a trade-permissioned brokerage — **needs Joshua**: sign up for Alpaca (paper account, free, fastest path) at alpaca.markets. IBKR only if TSX/Canadian equities needed later. RBC confirmed no public trading API. Once Alpaca keys exist, wire into `broker/morning-run.js`. Researched 2026-07-22: IBKR does not bridge to Wealthsimple; the only way to execute trades *in* a Wealthsimple account is unofficial reverse-engineered wrappers that violate WS's ToS — not viable. Real path is a separate IBKR/Alpaca account, SnapTrade/WS stay read-only for display only.
- [ ] **BLOCKED (Joshua):** "Login with TradingView" to sync watchlist — no public TradingView API for reading a user's watchlist/account. Receiving endpoint already exists (`server/api/broker/webhook.js` accepts `{ticker, action, qty}`, places Alpaca paper orders) — only remaining step needs Joshua's TradingView Pro+ account to configure an outbound webhook alert. Can't self-provision.
- [ ] **Needs Joshua:** re-enable the disabled Trade tab in `FinancePanel.jsx` once he eyeballs a real force-sync confirming holdings/math are clean (phantom-holdings dedupe shipped 07-02).
- [ ] Stocks not syncing properly — "we have no stocks" reported, screenshot shows stale data. Ruled out the known dedupe bug (fix still in place 07-21). `broker/sync.js` has a legitimate 25-min snapshot cache that could look stale under normal use, but confirming an actual sync failure needs live SnapTrade logs/account state — no repro available without Joshua's account.
- [ ] Autopilot trading UI visibility — ambiguous which control this refers to (reconfirmed 07-25: autopilot is fully implemented, paper mode works, only *live* execution is blocked on brokerage permission — nothing is visibly non-functional). Needs Joshua to name the specific control before hiding anything.
- [ ] Autopilot copy ("Pilots"): curated famous-investor model portfolios (congress trades + 13F trackers, read-only vs SnapTrade) with performance-vs-you + new-trade alerts; web first, mirror iOS. Feature notes in wiki `pages/epiphany.md`.
- [ ] `src/App.jsx` `ASSETS` const (~180 tickers, fallback-only) and the Watchlist — both tightly coupled to the 978-line trading simulator, used in 6+ places. Not safe to blind-edit; needs its own dedicated session for both together.

## Other open items
- [ ] Markets-row buy/sell/hold badge on the list view — the "why" panel itself already ships (tap BUY/SELL/HOLD pill on `StockDetail.jsx` for reasons + math rationale). Putting it on each Markets-list row is blocked: `MarketRow` only gets symbol/name/price/changePercent, but `signal()` needs 35+ price points — needs either N per-row history calls or the bulk price-history endpoint already deferred for sparklines. Same blocker, fix together.
- [ ] Portfolio/Settings tab audit — getting cluttered, decide what stays. Calendar view specifically flagged as possibly unnecessary.
- [ ] iOS landscape support — one-line flag, but map/markets/portfolio are portrait-first; enabling without adapting layouts looks broken. Needs a per-screen pass (split layouts, wider charts, map controls). Same applies to other iOS apps. Also: Holdings "Display metric" row needs per-holding day-change data from backend (model only has marketValue + gainLoss).

## From Apple Notes (imported 2026-08-10)
- [ ] App Store splash/screenshot refresh: current screenshots show demo data — portfolio reads $0. Regenerate with realistic seeded portfolio data (fastlane snapshot / appstore-screenshots skill) before next submission.

## [x] Stale marketing screenshots — FIXED 2026-08-10

**Resolution:** The initial investigation tracked the empty-state issue (Portfolio $0.00, "No transaction data", "No budget data") to the demo account lacking KV seed data, and proposed a dead-end fix approach (manually author demo portfolio JSON). The real solution turned out simpler: the snapshot pipeline was logging into the empty demo account, but the repo's gitignored `.env.accounts.local` file already contained real account credentials. Fixed by running fastlane snapshot with `DEV_EMAIL`/`DEV_PASSWORD` pointing to Joshua's real account. Uncovered two pipeline bugs in the process: (1) `ios/fastlane/Snapfile` was missing `-skipPackagePluginValidation`, causing the SwiftLint SPM build-tool plugin to fail headlessly and timeout (~15s failures, ~8 silent retries per full run); (2) PreviewScreenshot.swift launched the app three times (Portfolio, Settings, Settings again), and the third launch reliably died with "Simulator device failed to launch" timeout — consolidated Settings into Portfolio launch to reduce to two launches, eliminating the timeout. Result: four refreshed screenshots deployed live showing real portfolio data ($162.37, actual holdings, spending chart). Settings screenshot deliberately omitted to keep personal email off the public landing page. Unreferenced PNG duplicates deleted from public/screenshots/. Commit f6b08f8.

## From Apple Notes (imported 2026-08-11)
- [ ] **Needs Joshua: re-upload the June 2026 statement.** Consequence of the month-labelling
  bug above — because July was mislabelled "Jun", the upload handler's dedupe treated it as a
  duplicate of June and *replaced* the June record in KV. The parser fix stops it recurring and
  `refreshStoredStatements` self-heals stored records below `SUMMARY_VERSION` (4), but it cannot
  recover a record that was overwritten. If the June PDF still exists in Blob it may survive as
  an orphan; otherwise just re-upload June, then July, and confirm both now appear as separate
  months.
- [ ] iOS: fix "Login with …" (social sign-in buttons) — **blocked, not a code bug.** `server/api/auth.js` already has complete hand-rolled Google (`:202-268`) and Facebook (`:270-329`) flows; `GOOGLE_CLIENT_ID`/`SECRET` are present but empty and `FACEBOOK_CLIENT_ID`/`SECRET` are unset. Needs Joshua to register the apps in Google Cloud Console / Meta for Developers, then set the Vercel env vars. No code change unblocks this.
- [ ] Web landing page needs a light mode (looks great otherwise) — note `CLAUDE.md`'s standing rule "Web: dark only (Gotham brand, hardcoded dark surfaces)"; this item contradicts it, so confirm the rule is being retired before implementing.
- [ ] Mac app: thorough end-to-end test pass

> Resume note (2026-08-11), **updated 2026-08-13**: the `wip: partial work from /work notes ingest` commit (`2a46fe9`) has now been reviewed and verified — 413 tests pass, iOS and macOS both BUILD SUCCEEDED. Five of the items above are genuinely done and checked off. The "unpushed" claim in the original note was already stale: `2a46fe9` and `d98e8ce` are both on `origin/main`. Safe to build on.

## Design debt — standing colour rule violations
- [ ] Stock view: add live mode (seconds-level timeframe, not just minute)
- [ ] Make the "Buy/sell/hold" button clickable → opens a drawer of sources
- [ ] Add themes (dark mode etc.) to the stocks view
- [ ] Analyze drawer video at ~/Documents/Misc/epiphany.mp4 for the drawer UX spec
- [ ] Analyze project from CLAUDE.md + README.md, then refresh the app icon based on that analysis

### From Notes (2026-08-14)
- [ ] **Widget support on iOS and macOS.** Both platforms, one pass.

## Stashed 2026-08-15

Batch of 6 was dispatched; items 1–2 shipped (see checked lines above), 3–6 stopped at 69%
session usage rather than half-built. All four are still open exactly as written above —
this section only records what was learned while scoping them, so the next pass doesn't
re-derive it.

- [ ] **Period High/Low + SMA20/EMA50 on the commodity chart** (roadmap line ~48). Confirmed
  still the right shape: purely client-side off already-loaded history, no backend work.
  `StockDetailView` already computes SMA/EMA for equities — the job is reusing that path for
  commodities, which the existing line correctly calls a chart refactor. Note the EMA
  indicator toggle changed colour in the palette pass (`Palette.slate` now, was
  `Palette.purple`) — match new overlays to the current tokens, don't reintroduce a literal.
- [ ] **Buy/sell/hold button → drawer of sources** (roadmap line ~92). The "why" panel it
  should reuse already ships on `StockDetail.jsx` (tap the BUY/SELL/HOLD pill → reasons +
  math rationale from WHITEPAPER.md). This is a wiring job, not a new panel.
- [ ] **Markets-row buy/sell/hold badge** (roadmap line ~62). Re-read the existing note before
  attempting: it is *blocked*, not merely unstarted. `MarketRow` only receives
  symbol/name/price/changePercent but `signal()` needs 35+ price points, so it needs either
  N per-row history calls or the bulk price-history endpoint already deferred for sparklines.
  Same blocker as the sparkline item — fix them together or not at all.
- [ ] **Themes for the stocks view** (roadmap line ~93). Native only. `CLAUDE.md`'s standing
  rule is "Web: dark only (Gotham brand, hardcoded dark surfaces)", so this must not turn
  into relighting the web app. Native `Palette` is already fully adaptive light/dark, so the
  real question is what a "theme" adds beyond system appearance — needs Joshua's intent
  before building.

## Ingested 2026-08-18
- [ ] Renew Yelp (API key/subscription lapsed or expiring) — venue reviews depend on it.
- [ ] Add Google reviews (and other review sources) alongside Yelp.

## Braindump 2026-08-19
- [ ] Predictions feature: integrate or build prediction markets in the spirit of Wealthsimple Predict / Polymarket / Kalshi. Decide integrate-vs-build; check each for a public API.
- [ ] Social layer copying Loopt (friend map / presence). Reference: https://youtu.be/KhhId_WG7RA?si=c0cu-aQHq087KJeF

## Landing page: live demo background (2026-08-19)
Splash/hero background is a static image preview of the app. Replace with a live,
non-interactive demo of the real app rendering behind the hero (pointer-events:none,
demo/mock data, no auth). After sign-up, the same view becomes the real interactive
app and the marketing chrome (Log in / Get Epiphany / Get started) hides.
Scope: large UI change — do in a dedicated session.

## Ingested 2026-08-22
- [ ] Add a police scanner feature.
- [ ] Build upon the ontology / people index feature.
- [ ] Add Moderna and Pfizer to the stock list, plus any other suggestions. "Theoretically an infinite list that the user can organize and categorize themselves" — i.e. make the stock list user-extensible and user-categorizable rather than a fixed set.
- [ ] Portfolio syncing is laggy and unreliable — "It's working but not reliably, or very fast. I deposited into my chequing account, Epiphany took days to reflect it." Investigate sync freshness/latency end to end.

## From Apple Notes (imported 2026-08-25)

- [ ] Mobile web UI/UX is spotty overall — general pass needed.

- [ ] `/api/macro` returns an empty set on Cloudflare Workers. FRED sits behind Akamai, which refuses Workers egress IPs — every series comes back 520 at the edge, while the identical fetch succeeds from Vercel and from a laptop. Browser User-Agent, Referer and Accept-Language were all tried and none help, so it is the egress IP and not the request shape. Fix is either a reachable macro source or populating KV from something that can reach FRED. Already fixed alongside it: the handler used to cache the empty result for a full hour, serving the outage from memory in 1ms.
- [ ] Move the cron jobs off Vercel. `broker/morning-run` places real trades, so Cloudflare crons stay disarmed in `wrangler.jsonc` while Vercel still runs them on schedule — arming both would double-trade. Web traffic is already fully on Cloudflare; this is the last piece of that migration.
- [ ] Ship the macOS avatar fix. `macos/Models/AppState.swift` decodes inline data: URL avatars now, but macOS is still live on 2.5.2 and the change is unshipped.
- [ ] `/api/cron` hits the Workers subrequest cap. The first Cloudflare-run cron
  (2026-08-26 08:00 UTC) completed 200, but logged `[KV] set error: Too many
  subrequests by single Worker invocation` twice, so part of the cache write was
  dropped. The handler fans out to 111 stock symbols plus markets and commodities,
  each its own fetch, then writes several KV keys — that is well past the
  per-invocation subrequest limit. It never showed on Vercel, which has no such
  cap. Fix is to batch the Yahoo fetches or split the run across the three cron
  slots; raising the limit is a plan change, not a config flag. Also visible in
  the same run and probably older: `Cron crypto fetch failed: HTTP 403`.

## From Apple Notes (imported 2026-08-27)
- [ ] **Map layers are empty because Overpass refuses Cloudflare Workers.** `wrangler tail` on `/api/incidents` shows `overpass-api.de: HTTP 521` — the same egress-IP class of failure as FRED/Akamai and CoinGecko. `/api/incidents` and `/api/local-events` both depend on it, so the map has no places, infrastructure or venues. Mirror failover is now in place (`server/api/_overpass.js`) but **every** global mirror fails from Workers: `overpass-api.de: HTTP 521; overpass.kumi.systems: HTTP 502/abort; overpass.private.coffee: abort`. All four work from a laptop. Real fixes: proxy the call through the still-live Vercel deployment, or populate KV on a cron from something that can reach Overpass. Note `overpass.osm.ch` is a Switzerland-only extract — it answers 200 with zero elements worldwide, so it must never be in the mirror list. `maps.mail.ru/osm/tools/overpass` does work and has global data, but routing user-location queries through it is Joshua's call, not a default.
- [ ] Remaining empty map layers, measured 2026-08-27 for downtown Vancouver: `/api/events` 502 (GDELT unavailable, no cache), `/api/flights` returns 0 (see the dedicated entry below — NOT a 400, and not the query shape), `traffic`/`emergency`/`weather-alerts`/`aqi`/`earthquakes` all 0. `crime` returning 0 is expected — it only covers 9 US cities, so it can never populate for Vancouver. Working: `news` (69 articles), `wildfires` (3).
- [ ] **`/api/flights` is blocked by Cloudflare Workers egress IPs, same class as Overpass/FRED. Re-diagnosed 2026-08-29 — the previous note was wrong twice over.** It does not return 400 and the query shape is fine: the handler returns HTTP 200 with `meta.status: "error"` and an empty `states` array, and `wrangler tail` shows the real cause is the upstream refusing the subrequest. `parseBbox` is innocent — the web/iOS/macOS clients all clamp to a 2 deg span already and a hand-built Vancouver bbox parses correctly.
  Three independent free ADS-B sources were tested, all on a cold bbox with this app's near-zero traffic, so request volume is not the cause:
  - `api.adsb.lol` -> **429** from the Worker, 200 from a laptop.
  - `opendata.adsb.fi` -> **403** from the Worker, 200 from a laptop. Ruled out User-Agent as the cause: the custom UA returns 200 from a laptop too.
  - `api.airplanes.live` -> **403 everywhere**, with a body asking you to email contact@airplanes.live describing the project. That is the one path that could be unblocked by a human.
  A two-source fallback (adsb.fi primary, adsb.lol fallback) was implemented and deployed to test the theory, then **reverted** once adsb.fi also 403'd — keeping it only added a second failing round trip to every request. Do not re-attempt a new-source fallback without first proving that source answers *from a Worker*.
  Fix is the same infrastructure decision blocking `/api/macro` and `/api/incidents`, not a code change: an egress path that is not a Cloudflare datacenter IP. Note the roadmap's old "proxy through the still-live Vercel deployment" escape hatch is **dead** — the Vercel to Cloudflare migration is complete and no projects remain there. A Workers cron populating KV does not help either; it runs on the same egress IPs. Remaining options: Cloudflare Browser Rendering, an external host, or emailing airplanes.live for access. **Joshua's call.**
- [ ] "One big dot for the entire city" on web: not yet root-caused. With almost every layer empty, the surviving markers cluster into a single badge (`clusterPoints` in `src/components/LiveMapBackdrop.jsx`, radius 60 at initial zoom 10.6). Re-check after the Overpass layers are actually returning data — this may just be the symptom of having ~one populated layer.
- [ ] Loading glitch in the top App Store bar on web.
- [ ] SnapTrade brokerage connection error persists even though the $1 bill was paid this month.
- [ ] Bump landing page links and GitHub links to current.
- [ ] Decide: is the app icon green or blue? Pick one and make it consistent.
- [ ] People indexer does not work. Expand it and add AI support (Qwen etc).
- [ ] Housekeeping: build `202608271355` (2.5.6) was uploaded by mistake on 2026-08-27 — a duplicate of work already done. The build actually in review is **2.5.5 / `202608271349`**, which does include the dead-button removal (`03c89b3`). `ios/project.yml` now reads 2.5.6, so the next build is correctly numbered; the orphaned 202608271355 build can be ignored or deleted in ASC. Note `44cfa65` (broker webhook auth) landed AFTER that build, so it ships server-side only until the next binary.

### Open — security

- **Rotate the two dashboard-gated secrets** (2026-08-27 security sweep). Fresh
  `WEBHOOK_SECRET` + `CRON_SECRET` were already regenerated locally in
  `.env.tui.local` and need pushing to Vercel prod (my broker/webhook + autopilot
  cron endpoints now 503 until the secret is set in prod). Still to do by hand,
  because no API mints these headlessly:
  - `STRIPE_SECRET_KEY` (roll `sk_live_` at dashboard.stripe.com/apikeys)
  - `SUPABASE_SERVICE_ROLE_KEY` (Supabase → Settings → API; rotating invalidates all tokens)
  Run `scripts/rotate-keys.sh` to open all tabs, then `scripts/sync-vercel-env.sh`.

## From Notes (imported 2026-08-27)
- [ ] **Epiphany 2.5.5 iOS REJECTED — reason now READ (submission `1afd5ca2-4103-4da7-914f-fca3f2051915`, read 2026-08-28). TWO guidelines cited, neither resolved.**
      - **2.1(a) — "error shown when attempting to sign in with Apple"**, reviewed on iPad Air 11-inch (M3), iPadOS 26.6. The reviewer screenshot shows **"Sign-Up Not Completed" rendered inside Apple's OWN Sign in with Apple sheet** while creating an account for `ar_user1144@icloud.com`. It never reaches our backend, so `_apple-jwt.js` is definitively not implicated — that earlier audit was correct.
      - **The entitlement hypothesis is RULED OUT.** Verified end to end 2026-08-28: `ios/project.yml` declares `com.apple.developer.applesignin` under `entitlements.properties` (fix `39d7102`, 2026-07-27) and it survives `xcodegen generate`; `ios/Epiphany.entitlements` has it; the archive that produced the reviewed build (`.asc/artifacts/Epiphany.xcarchive`, CFBundleVersion `202608271349`, 2.5.5) is **signed with it**; its embedded profile grants it; the other distribution-signed IPA from the same day (`202608271355`) retains it through export, so export is not stripping it; App ID `com.heyitsmejosh.epiphany` (`8QHAV87C9U`) has `APPLE_ID_AUTH`/`PRIMARY_APP_CONSENT` and no competing App ID claims Apple auth; client code is stock `SignInWithAppleButton`.
      - **Leading remaining hypothesis — iPad.** The binary is `UIDeviceFamily = [1]` (iPhone-only) yet review ran on iPad, and Apple's letter adds "apps that may be downloaded onto iPad devices should function as expected for iPad users." Next step: run 2.5.5 on an iPad in iPhone-compatibility mode and attempt Sign in with Apple. Do NOT resubmit until it reproduces. Builds `202608271349` and `202608271355` are both VALID and attachable.
      - **2.1(b) — Information Needed (business model), 4 questions.** Draft answers + evidence in `notes/2-1-b-business-model-reply.md`. **Surfaces a real Guideline 3.1.1 exposure needing Joshua's decision before replying:** Autopilot live trading, Daily Brief and the People graph are gated by `isPro`, obtainable only via a one-time **Stripe** payment on the web, and `ios/API/EpiphanyAPI.swift` calls every one of those gated endpoints. `asc iap list --app 6779522175` returns **zero** IAPs, and `ios/Services/StoreKitManager.swift` (product `com.heyitsmejosh.epiphany.paid`) is dead code referenced nowhere. The iOS app therefore unlocks paid features bought outside IAP.
- [ ] Widgets receive no data: `widgets-ios/Models/WidgetAPI.swift` reads `UserDefaults(suiteName: "group.com.heyitsmejosh.epiphany")`, but the **main app declares no app-groups entitlement** (only the widget target does) and no main-app code writes that suite. Found while inspecting the signed archive; unrelated to the rejection.

## Stashed 2026-08-28
- [ ] Verify the deploy state before replying to Apple's 2.1(b) query. The answer to question 4 in `notes/2-1-b-business-model-reply.md` ("none") is only true while this build is live — check with `npx vercel inspect https://epiphany.heyitsmejosh.com` and confirm `created` is newer than the gates.js commit. Do NOT verify by curling `/api/daily-brief` or `/api/people` unauthenticated: both return 402 under old and new code, so that probe proves nothing.

## Migrate off Vercel to Cloudflare (scoped 2026-08-28)

Everything else in the codebase is on Cloudflare; epiphany and talli are the last two on Vercel, and talli genuinely cannot move (Express monolith with headless Chrome and Python shells). Epiphany can. The trigger: a paused Vercel project silently blocked every deploy for two days while production served a stale build, and the CLI never surfaced it — a failure mode that does not exist on Cloudflare Pages. See `reference_vercel_paused_project` in memory.

**Do this AFTER the Guideline 4.3(a) appeal clears.** Do not move the most complex app in the codebase while a submission is in review.

- [ ] **Spike first, before committing to the migration: does `pdf-parse` run on the Workers runtime?** It powers bank-statement parsing in `server/api/statements.js` and is the one dependency that could turn a small job into a large one. Needs `nodejs_compat`. If it cannot work, the fallback is keeping statement parsing on a separate Node host or moving it client-side, which changes the shape of the whole migration — so settle this before anything else.
- [ ] Port Vercel Blob to R2. The lock-in surface is only three files: `server/api/_blob.js`, `server/api/statements.js`, `server/api/cron.js`. Statements must stay private — `putStatementBlob` requires non-public access, and a public store was a real incident on 2026-08-06 (a Vercel store's access mode is fixed at creation; R2 is private by default, which is safer). Note the current 3MB effective upload cap exists because the PDF is sent base64 in a JSON body through a Vercel Function's 4.5MB limit; R2 direct upload removes that constraint, so the cap can go away rather than be ported.
- [ ] Everything else is already portable: KV is Upstash (external, not `@vercel/kv`), there is one function (`api/gateway.js`) and no crons in `vercel.json`.
- [ ] Move env vars to Cloudflare (`wrangler pages secret put`), re-point the Stripe webhook endpoint, and verify the SnapTrade and broker paths still authenticate.
- [ ] Flip DNS last, and confirm the new deploy serves before removing the Vercel project.
