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
- [ ] **`DebtPayoffProjection` prints "Debt-free in now total"** — reads like a string
  formatting bug in `src/utils/debtPayoff.js` when every debt row has `minPayment: 0`.
  Spotted in Josh's screenshot 2026-08-10, not investigated (usage budget).

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
- [x] Avatar regeneration has been broken for weeks (user-reported, live app) — FIXED 2026-08-10. Root cause was **not** in `server/api/avatar.js`: the `BLOB_READ_WRITE_TOKEN` env var was **deleted** from Vercel production/preview on 2026-08-06 during the statement-store swap, so every Blob caller that relies on the SDK's implicit default token started throwing `Vercel Blob: No token found`. That broke three routes at once, not just avatars:
  - `server/api/avatar.js` — `put()` → 500 `Failed to upload avatar (blob store error)` (reproduced live, then verified fixed).
  - `server/api/latest.js` — `list()` → `/api/latest` returned `{"data":null,"error":"Vercel Blob: No token found…"}` (verified fixed, now serves cached data).
  - `server/api/cron.js` — `put()` of the snapshot payload, silently failing on every cron run.
  Only `server/api/statements.js` survived, because it passes `token: EPIPHANY2_READ_WRITE_TOKEN` explicitly (private store, bank statements).
  Fix: re-added `BLOB_READ_WRITE_TOKEN` to Vercel production + preview pointing at the still-live **public** store (`cfi8gknxt1zgf6bn.public.blob.vercel-storage.com`, `vercel_blob_rw_cfi8GKN…`), then `vercel --prod`. No code change needed.
  **Do not delete `BLOB_READ_WRITE_TOKEN` again.** Epiphany deliberately uses two Blob stores: a public one (avatars, cron snapshots, `latest`) on the default token, and a private one (statements) on `EPIPHANY2_READ_WRITE_TOKEN`. The `ponytail:` note in `statements.js:40-43` says to drop the explicit token "once BLOB_READ_WRITE_TOKEN itself is repointed at a private store" — that must not happen while avatars/cron/latest still need public access.
  Also: `.vercel/project.json` was missing (only `repo.json` existed), which made `vercel --prod` fail with "Root Directory must be a relative path"; recreated it with the project/org IDs.
- [ ] Joshua's profile photo was lost during the above verification — the avatar POST handler deletes the old blob before writing the new one, so testing the fix against the real account destroyed the JPEG uploaded 2026-08-06. A generated node-graph avatar is in its place; re-pick the photo from the iOS photo picker if wanted. (Latent issue worth fixing: `avatar.js` deletes the old blob *before* the new `put()` succeeds — an upload failure loses the existing avatar for nothing. Reorder to put-then-delete.)
