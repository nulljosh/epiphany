# App Store Submission — Epiphany iOS

Target: $2.99 paid app (no IAP code), TestFlight first. Status as of 2026-06-14.

## Approved 2026-06-23
v1.0 passed App Store review, live within 24h: https://apps.apple.com/app/epiphany/id6779522175
**SnapTrade phantom holdings/bad math bug was NOT fixed before this ship** — still needs a post-launch fix since real users will hit it.

## Ready
- Bundle `com.heyitsmejosh.epiphany`, team `QMM486NPYC`, v2.0.5, automatic signing
- Icons (light/dark/tinted 1024), launch screen, all privacy usage strings, no ATS exceptions
- Privacy policy live at https://epiphany.heyitsmejosh.com/privacy
- Web-upgrade links removed from iOS Settings (guideline 3.1.1)

## One-time (App Store Connect → Business)
1. Accept the **Paid Applications agreement**
2. Fill in **banking + tax** info (required before a paid app can ship)

## Per-release
1. My Apps → "+" → New App: iOS, name "Epiphany" (fallback: "Epiphany Intelligence"),
   bundle `com.heyitsmejosh.epiphany`, SKU `epiphany-ios`, price **$2.99 (Tier 3)**
2. Xcode: Any iOS Device (arm64) → Product → Archive → Distribute → App Store Connect
3. TestFlight: install via internal testing, smoke-test login/map/markets/portfolio
4. Listing: screenshots from iPhone 17 Pro simulator (⌘S; 1320×2868), description below,
   keywords, support URL https://epiphany.heyitsmejosh.com,
   privacy URL https://epiphany.heyitsmejosh.com/privacy
5. App Privacy questionnaire — declare, all "linked to you", none used for tracking:
   - Contact Info → Email Address (account)
   - Location → Coarse Location (map features)
   - Financial Info → Other Financial Info (portfolio, brokerage holdings)
   - User Content → Photos (avatar, optional)
6. App Review Information: **demo account email+password** (login is required),
   note: "Brokerage linking is optional; trading executes only in the user's own
   linked brokerage via SnapTrade, read-only without explicit enrollment.
   Location is used only to center the live map."
7. Submit. Expect 24–48h.

## Listing copy (no performance/return claims — guideline 2.3.1, securities rules)

**Subtitle**: Markets, maps, and money in one view

**Description draft**:
Epiphany is a personal intelligence dashboard. One app for the state of your world:
live markets, your portfolio, and what's happening around you.

- SITUATION — A live map of your area: earthquakes, flights overhead, traffic,
  weather alerts, wildfires, air quality, local events and places.
- MARKETS — Stocks, crypto, and commodities with pro-grade charts (Heikin Ashi,
  candles, baselines), technical indicators, and related news.
- PORTFOLIO — Net worth, holdings, budget, debt payoff, and goals. Link your own
  brokerage (read-only by default) to sync holdings automatically.
- AUTOPILOT — Optional automated trading through your own linked brokerage using
  technical signals. You set the cap; you can turn it off anytime.

**Keywords**: stocks,portfolio,markets,finance,budget,net worth,charts,crypto,map,tracker

## Review risk + fallback
Guideline 3.2.1 (financial trading) may trigger questions since trades execute via
SnapTrade. If rejected on this: resubmit with the Autopilot card in display-only
mode on iOS (enrollment stays on web) — small change in AutopilotSection.swift.

## Deferred
- StoreKit 2 subscription ($1.99/mo) replacing the paid-app price — needs App Store
  Server API receipt validation endpoint mapping transactions to `isPro`.

## App Store Screenshots

Updated 2026-06-14. Five 1320×2868 screenshots:

1. **Situation** — Live MapKit map with 8 toggleable data layers (earthquakes, flights, weather, incidents, crime, events, traffic, wildfires). Category chips for venues (Restaurant, Gas, Groceries, Coffee, Parks, Shopping).
2. **Markets** — Markets list filtered by asset type (All, Stocks, Commodities, Crypto). Live ticker bar at top showing real-time quotes (UST100.23, FCX, COPX, JPM). Fear & Greed sentiment (34/Fear) with 34Y indicator. News, Macro, Alerts feed segmentation.
3. **Stock Detail** — Deep dive sheet: SPCX chart (Heikin Ashi + technical indicators SMA 20/EMA 50, Candles, Hollow, Bars, Line, Step, Area options), fundamentals (Prev Close, Day Range, 52-week Range, Market Cap, P/E, Dividend), Buy/Sell order buttons.
4. **Portfolio** — Net worth ($144.62, +$0.74 YoY). Holdings breakdown by account (TFSA $0.01, Trade $136.94). Spending forecast ($1,652 this month; next month $1,354–$1,893). Allocation pie chart (income/savings/goals).
5. **Settings** — User profile (Joshua Trommel, jtrommele@gmail.com, Free tier). Brokerage (Wealthsimple linked, Re-sync/Disconnect options). Autopilot (BETA, hourly trading, currently unavailable/Retry). Account (Change Name). Security section.

