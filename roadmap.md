# Epiphany Roadmap

## Urgent
- [ ] **SnapTrade production key billing failed — deadline 2026-08-06 (today).** SnapTrade emailed 2026-08-03: payment for July 31 did not process (org Maybulb, key MAYBULB-LKHSV, $1.00 USD due). If unpaid, the key is disabled, killing all live holdings/account sync. Pay/update billing via the SnapTrade dashboard link in the email (billing@snaptrade.com). **Check current status — deadline may have already passed.**

## Statement upload (current state, consolidated 2026-08-07)
- [x] iOS statement-upload bug — fixed 2026-07-28 (`97e612e`, 4 converging bugs: wrong state array read, no-op success path, `.constant()` error binding swallowing the alert, hard-bail on security-scoped resource access).
- [x] macOS statement upload UI added 2026-08-04 (`a013c90`) — was previously missing entirely (web/iOS could upload, Mac could only read).
- [x] Storage migrated off Upstash KV base64 to Vercel Blob (private access) 2026-08-04 (`0fec55c`) — size guard raised 4MB→25MB across all platforms, legacy KV statements still readable via fallback.
- [x] **Deploy wiring verified 2026-08-07** — push-to-deploy IS working despite the missing `.vercel/project.json`: every commit including current HEAD has a matching Vercel production deployment (checked via Vercel API), and `0fec55c` is an ancestor of the deployed HEAD. Not the cause of "still broken."
- [x] **Root cause found + fixed 2026-08-07** — the Vercel Blob store was provisioned **public** by default (access mode is immutable at creation, no API/CLI to flip it) — `putStatementBlob` correctly requires `access:'private'`, so all uploads failed with "Cannot use private access on a public store." Created a new private Blob store and repointed code to use `EPIPHANY2_READ_WRITE_TOKEN` (commit `75df240`). All platform uploads now working.

## App icon
- [x] Transparency bug fixed 2026-08-04 — `AppIcon.png`/`AppIcon-dark.png` had real alpha in the rounded-corner cutouts, which silently fails ASC uploads (ITMS 90717, `asc builds upload` reports success anyway — verify with `asc builds uploads list`). Flattened onto the design's own `#111814` background. **Check other repos' icons for the same defect — whole class of silent ship failure.**
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
- [x] Map search bar autocomplete — DONE 2026-08-04 (`a013c90`): `MapSearchCompleter` (MKLocalSearchCompleter) added to iOS + macOS, suggestions biased to visible region, tap-to-fly. Web already had this via debounced Nominatim.
