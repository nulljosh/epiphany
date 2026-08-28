# Guideline 2.1(b) — Information Needed: business model reply

STATUS: DRAFT. Not sent. Submission `1afd5ca2-4103-4da7-914f-fca3f2051915`, Epiphany 2.5.5 iOS.

Everything below is derived from the code as it actually is on 2026-08-28, not from
intent. Verify before sending — handing App Review an inaccurate description of your own
business model is worse than answering slowly.

## READ THIS FIRST — there is a real 3.1.1 exposure here

Apple's question 4 ("what paid content or features are unlocked within the app that do
not use In-App Purchase") is not a formality in this case. The honest answer is
"Autopilot live trading, Daily Brief, and the People graph", and they are unlocked by a
payment taken outside In-App Purchase.

The verified chain:

- `server/api/gates.js` grants Pro from `user.tier` or an active Stripe subscription
  keyed on `stripe_customer_id`. That is the only entitlement source.
- `server/api/stripe.js` creates a Stripe Checkout session (`mode: 'payment'`, one-time)
  on the **web** app. There is no Apple payment path into it.
- These endpoints refuse non-Pro callers with 402: `broker/autopilot.js`,
  `broker/morning-run.js`, `broker/trade.js`, `daily-brief.js`, `people.js`,
  `people-index.js`, `people-crossref.js`, `people-import.js`.
- **The iOS app calls all of them** — `/api/daily-brief`, `/api/broker/autopilot`,
  `/api/broker/trade`, `/api/people`, `/api/people-index` are all in
  `ios/API/EpiphanyAPI.swift`.
- `asc iap list --app 6779522175` returns **zero** In-App Purchases on the record.
- `ios/Services/StoreKitManager.swift` exists and declares product
  `com.heyitsmejosh.epiphany.paid`, but it is **dead code — referenced nowhere in the
  app**, and that product does not exist in App Store Connect. The iOS app ships no
  paywall, no purchase UI, and no working IAP.

So a user who pays $1 on the website gets features unlocked inside the iOS app, with
Apple taking no part in the transaction. That is what 3.1.1 prohibits for digital
content consumed in the app.

**DECIDED 2026-08-28: option 2.** Option 1 is blocked upstream on the unsigned Paid Apps
Agreement, and even unblocked it needs a fresh submission during the 4.3(a) freeze. Option 2
forfeits no actual revenue -- the record carries zero IAPs, so Apple revenue is already
impossible -- and it is one env var to reverse. Implemented in `server/api/gates.js`:
`isProByEmail` grants Pro to any signed-in user unless `EPIPHANY_REQUIRE_PRO=true`. The dead
`ios/Services/StoreKitManager.swift` was deleted so the binary carries no reference to a
StoreKit product that does not exist on the record.

The options as assessed:

1. **Add a real IAP** for the Pro unlock and use it as the iOS purchase path (keep Stripe
   for web only). Blocked upstream on the Paid Apps Agreement + bank account, which is
   already the known blocker on all Apple revenue.
2. **Ungate on iOS** — let the iOS build treat every signed-in user as Pro, so the app
   sells nothing and unlocks nothing. Truthful, ships immediately, forfeits iOS revenue.
   This is the same shape as the fix already used in voxprint, where the StoreKit paywall
   is hardcoded open for exactly this reason.
3. Remove the gated features from the iOS build entirely.

Do not answer question 4 with "none" — the code contradicts it, and the reviewer can
reach the 402 from the app.

## Draft answers (accurate as written, pending the decision above)

**1. Who are the users that will use the paid content, subscriptions, features, and
services in the app?**

> Individual retail users managing their own personal finances. There is no enterprise,
> education, or bulk-licensing tier, and no organizational accounts. Every account is a
> single self-registered consumer account.

**2. Where can users purchase the content, subscriptions, features, and services that can
be accessed in the app?**

> Nothing is sold in the iOS app. It contains no purchase interface, no paywall, and no
> link to any external purchase page. Every feature in the iOS build is available to any
> signed-in user at no charge.

**3. What specific types of previously purchased content, subscriptions, features, and
services can a user access in the app?**

> Account-level feature access, not content. A user whose account is marked Pro can use
> Autopilot (automated trading against their own connected brokerage), the Daily Brief
> summary, and the People graph. Nothing is downloaded, licensed, or delivered as media —
> the entitlement only changes which of our own API endpoints answer for that account.

**4. What paid content, subscriptions, or features are unlocked within the app that do
not use In-App Purchase?**

> None. The iOS app unlocks no paid content, subscriptions or features. Every feature is
> free to all signed-in users, and the app contains no purchase path of any kind.

## Free vs paid, as the code actually behaves

Free for every signed-in user: the map and all data layers, the situation monitor, market
quotes and stock detail, weather/earthquakes/wildfires/news, portfolio and holdings view,
brokerage read-only sync.

Pro-gated (402 without it): Autopilot live trading, Daily Brief, People graph and its
import/cross-reference endpoints.

Note the `epiphany/CLAUDE.md` "Free vs Premium" table is out of date — it lists
"Portfolio + watchlist" and "Ontology writes + batch" as Premium. Neither is gated in
code. Do not quote that table to Apple.
