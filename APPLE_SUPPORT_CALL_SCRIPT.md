# Apple Developer Support call — Epiphany bank account issue

**Phone (Canada):** 1-800-633-2152
**Phone (US, if Canada line is busy):** 1-800-633-2152 (same line, routes by account)
**Or:** developer.apple.com/contact → Account → "Call Us" for a callback instead of hold time.

## What to say
"I'm trying to add a bank account in App Store Connect under Agreements, Tax, and Banking
so I can sign the Paid Apps Agreement and release my app Epiphany. The 'Add New Bank Account'
form won't enable the Next button no matter what I enter."

## Details to give them
- App: Epiphany, ASC app ID 6779522175
- Bank: Wealthsimple (Wealthsimple Payments), Canada, CAD
- Institution number: 703
- Transit number: 16001
- Account ending: 9466
- Account type: Individual, same address as legal entity (Langley, BC)
- The bank search ("Search for Your Bank") also fails to find Wealthsimple by name

## Also mention (separate, smaller issue)
- Two tax forms still show "Missing Tax Info": Canadian GST/HST Form 506, U.S. Tax Questionnaire
  — ask if these need to be done before or after the bank account is fixed.

## Current state (for reference)
- Paid Apps Agreement: signed Jun 24, 2026, status "Pending User Info"
- App version 1.0: Apple-approved, READY_FOR_SALE, but CANNOT_SELL in every territory
  until banking + tax is resolved
