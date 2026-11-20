# Epiphany Money

How Epiphany makes money. The company plan is `REVENUE.md` in the Code root; the ledger is `GTM.md`.

## Price and rail

The download is free. Premium is a $1.00 one-time in-app purchase on iPhone and Mac (ASC 6779522175). Apple keeps 15%, so each App Store sale pays about $0.85. On the web, Premium is $1 once through Stripe, which pays about $0.67 after fees. Stripe cannot unlock in-app features under App Review, so the native apps unlock Premium through StoreKit (`ios/Services/Store.swift`). Both paths set the same `isPro` flag, gated in `server/api/gates.js`.

## What is actually sold

Premium: the People view and the Daily Brief, on top of a free map and portfolio. The brokerage and market data come from outside services, read only through SnapTrade. The risk is those providers' terms and their prices, not copyright.

## Who pays and why

Someone who wants one screen for money, markets and the people in their life, and will pay once to see the extra views. The free tier is the funnel. The dollar covers the parts that cost real money to run.

## Cost to serve

This is the one hero app with real recurring cost. SnapTrade is a paid third-party API, called read only, and skipped when it is not configured. The Worker runs one cron every 15 minutes for the brief and broker snapshots, inside the Workers Free cap of five triggers. The code sets no dollar cap. SnapTrade bills by its own plan.

## Where we are

- 2026-11-02: the store price is verified at $1.00 for Premium.
- Stripe is live on the web (root CLAUDE.md gotchas, undated).
- Repo notes: Stripe and StoreKit both set the same `isPro` flag.
- Revenue: no verified number (the App Store Connect key cannot read sales yet).

## Role in the company plan

Hero candidate. GTM.md names it as one of the three hero apps. It serves Stage 0 of REVENUE.md because it is the one hero with a web checkout and a store unlock, so the first thousand dollars can show up in both places. Stage 1 needs it on the store charts.

## Next

Confirm the StoreKit Premium unlock works on the App Store build, because Stripe cannot unlock in-app features under review.

## Million, billion, trillion

**A million.** Epiphany is the money screen people open every morning, and one dollar opens the parts that matter.

**A billion.** Epiphany is the household money view on every Jaybulb device, with brokerage links kept read only.

**A trillion.** Epiphany shows a person their whole financial life in one place, and it still sells no one's data and no subscription.

## Change it

iOS Premium is an in-app purchase, so its price is set with `asc iap pricing`, not the app price. The app itself stays free to download. Web: the Stripe price ID in the server config. Only with Joshua's yes in chat.

Anyone who got Epiphany while it was free keeps it free.

*ASC 6779522175. Verified 2026-11-02.*
