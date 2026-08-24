# Epiphany Roadmap

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
- [ ] **Statement upload — two real bugs found and fixed 2026-08-10, awaiting Josh's retry to confirm they were *the* cause.** The 08-06 Blob fix was genuinely incomplete; two independent second bugs existed, both of which produce exactly "the statement never landed":
  1. **Unparseable PDF → 500, upload discarded** (fixed, regression test added). `summarizeStatementBuffer` returned `{ spendingMonth: null }` whenever `pdf-parse` threw, and the upload handler's dedupe then did `spendingMonth.month` on that null → `TypeError` → the outer catch returned a 500 with `statements: []`. The PDF was already written to Blob at that point, so it was orphaned and never recorded in KV. Any statement whose PDF pdf-parse can't read (encrypted, or a newer Wealthsimple template) failed permanently and silently this way. Fixed at the source in `server/api/statements-data.js` — falls back to `summarizeTransactions([], filename)`, so an unreadable statement is still stored and just gets named after its filename. Belt-and-braces `?.` in `server/api/statements.js`. Test: `tests/api/statements.test.js` "still stores a statement whose PDF could not be parsed".
  2. **Advertised 25MB cap the transport cannot carry** (fixed). The PDF travels base64-encoded inside a JSON body to a Vercel *Serverless Function*, whose request-body limit is **4.5MB, enforced by the platform** — the handler never runs, so the client got a bare 413 with no useful message. Base64 inflates 4/3, so the honest PDF ceiling is 3MB, not the 25MB that `server/api/statements.js`, `ios/Views/PortfolioView.swift` and `macos/Views/PortfolioView.swift` all claimed (25MB was Blob's limit, which this path never gets to use). All three now say 3MB and reject oversized files client-side with a real message.
  - **Still needs Josh**: retry the June + July 2026 uploads. If they now land, done. If they're over 3MB, the clear error will say so and the real fix is the upgrade path noted in `statements.js` — client-direct upload to Blob (`@vercel/blob/client` `handleUpload` + a token route), which bypasses the function body entirely. That's a cross-platform client change deserving its own session, not a constant.
- [ ] SnapTrade billing: Josh believes it was paid — not independently re-verified this session (ran out of time/budget). Confirm via SnapTrade dashboard before trusting the "disabled key" urgent item above is stale.
- [ ] **SnapTrade production key billing failed — deadline 2026-08-06 (today).** SnapTrade emailed 2026-08-03: payment for July 31 did not process (org Maybulb, key MAYBULB-LKHSV, $1.00 USD due). If unpaid, the key is disabled, killing all live holdings/account sync. Pay/update billing via the SnapTrade dashboard link in the email (billing@snaptrade.com). **Check current status — deadline may have already passed.**

## From Apple Notes (imported 2026-08-08)
- [ ] Follow-up on the above: the fallback is a **publisher favicon, not a true per-article image**. Genuinely per-article imagery needs og:image, which for Google-sourced items means resolving the opaque `CBMi...` redirect *then* fetching the article page — ~2 network round-trips per row, too expensive to do inline in the handler. Only worth building if GDELT stays dead; check whether GDELT recovers first (it is rate-limiting shared Vercel IPs — "Please limit requests to one every 5 seconds"), since a healthy GDELT already supplies real images for free.

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
- [ ] Add VIX to the stock list.
- [ ] Portfolio syncing is laggy and unreliable — "It's working but not reliably, or very fast. I deposited into my chequing account, Epiphany took days to reflect it." Investigate sync freshness/latency end to end.

## Ingested 2026-08-24

- [ ] **Hero animation pass** (Notes 2026-08-24). Reference: bookrank's hero animation — same style/vibe. Subject here is **the situation map — the actual map**. Login/registration/authentication required to actually interact with the map; otherwise features are gated. (Josh: "might have already noted all of this in wiki" — dedupe against `wiki/pages/epiphany.md` before building.)
- [ ] Confirm all major banks are present in the stocks list (Notes 2026-08-24).
- [x] **Hero: animate the situation map.** DONE (verified live 2026-08-24: `lp-hero-bg` + `lp-hero-drift` 50s drift + `lp-hero-fade` scrim + reduced-motion guard all present in the deployed CSS bundle). Was already built; the roadmap entry was stale. Originally deferred 2026-08-24 when the other six apps got their
      hero treatment. Use the existing animated SVG map from the 2026-07-28 landing restyle as
      the backdrop, following the pattern now shipped on wordroot/curvely/wiretext/newsline
      (absolute layer behind `.hero .container`, `.hero::after` scrim for headline contrast,
      `prefers-reduced-motion` guard, fails soft).
- [ ] **Gate map interaction behind auth** (the second half of the same note). Josh: "login/
      registration/authentication to actually interact with the map. Otherwise, features gated."
      This is a product feature, not a hero animation — deliberately kept out of the hero work
      and left for its own session. Epiphany already has hand-rolled Google/Facebook OAuth server
      code waiting on credentials (`server/api/auth.js:202-329`), so decide whether this rides on
      that or on the existing native Apple sign-in before scoping.
