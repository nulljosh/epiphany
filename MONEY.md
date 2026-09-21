# Epiphany Money

How Epiphany makes money. The fleet-wide ledger is `GTM.md` in the Code root.

## Price

Free download. Premium is $0.99 once on iOS and $1 once on the web.

## Rail

StoreKit non-consumable `com.heyitsmejosh.epiphany.premium` (`ios/Services/Store.swift`) and Stripe Checkout (`server/api/stripe.js`, `stripe-webhook.js`). Both set the same `isPro` flag, gated in `server/api/gates.js`.

## Why

The free tier is the funnel. Premium unlocks People and the Daily Brief.

## Next

This is the one app with real recurring cost: broker polling, the brief cron, KV. It should become $2.99 a month. Do it after the first real sale, and ship the iOS auto-renewable sub in the same release, or everyone just buys the $0.99 lifetime on iOS.

## Change it

Web price is the Stripe price ID in server config. iOS price is `asc iap pricing`. The gate only bites when `EPIPHANY_REQUIRE_PRO=true`.

Anyone who got Epiphany while it was free keeps it free. Only new customers pay.

*ASC 6779522175. Set 2026-09-20.*
