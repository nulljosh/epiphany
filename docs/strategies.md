<!-- HIDDEN: Arby content folded into opticon. Uncomment when ready to surface as a strategies tab.

# Strategies Reference

Consolidated from `~/Documents/Code/arby/README.md`, `~/Documents/Code/arby/index.html`, and `~/Documents/Code/arby/CLAUDE.md`.

## Project Overview

Financial arbitrage strategies and money-making ideas. This is a documentation/research reference, not a running application.

## Scope

- Credit card churning strategies
- Bank account bonus playbook
- Cashback stacking methods
- Retail arbitrage approach
- Credit building roadmap (authorized user method)

## Strategy Flow

```mermaid
graph TD
    Start[Starting Point] --> CheckCredit{Have Good Credit?}

    CheckCredit -->|No| BuildCredit[Build Credit First]
    CheckCredit -->|Yes| Advanced[Advanced Strategies]

    BuildCredit --> AuthUser[Authorized User on Family Card<br/>+30-80 pts, zero risk to them]
    BuildCredit --> SecuredCard[Secured Credit Card]
    BuildCredit --> CreditBuilder[Credit Builder Loan]

    AuthUser --> FastTrack[Fastest Path to Good Credit]
    SecuredCard --> WaitTime[Wait 6-12 Months]
    CreditBuilder --> WaitTime
    FastTrack --> CheckCredit
    WaitTime --> CheckCredit

    Advanced --> LowRisk[Low Risk / Quick Wins]
    Advanced --> MedRisk[Medium Risk / Higher Returns]
    Advanced --> HighRisk[Advanced / Careful Execution]

    LowRisk --> BankBonus[Bank Account Bonuses<br/>$200-500 per account]
    LowRisk --> Cashback[Cashback Stacking<br/>5-10% effective rate]
    LowRisk --> GiftCards[Discounted Gift Cards<br/>10-20% savings]

    MedRisk --> Churning[Credit Card Churning<br/>50k-100k points per card]
    MedRisk --> BalanceTransfer[0% APR Balance Transfer<br/>Save on interest]
    MedRisk --> Warranty[Extended Warranty Benefits<br/>Free protection]

    HighRisk --> Manufactured[Manufactured Spending<br/>High reward, high risk]
    HighRisk --> RetailArb[Retail Arbitrage<br/>$500-2000/mo part-time]

    BankBonus --> Profit[Profit]
    Cashback --> Profit
    GiftCards --> Profit
    Churning --> Profit
    BalanceTransfer --> Profit
    Warranty --> Profit
    Manufactured --> Profit
    RetailArb --> Profit

    style Start fill:#e1f5ff
    style Profit fill:#c8e6c9
    style BuildCredit fill:#fff9c4
    style Advanced fill:#f3e5f5
    style HighRisk fill:#ffccbc
    style AuthUser fill:#c8e6c9
    style FastTrack fill:#c8e6c9
```

## Decision Tree: Which Strategy Is Right For You?

```mermaid
graph LR
    Q1{Credit Score?} -->|Below 600| Build[Focus on Credit Building]
    Q1 -->|600-700| Medium[Bank Bonuses + Cashback]
    Q1 -->|Above 700| All[All Strategies Available]

    Q2{Time Available?} -->|1-2 hrs/week| Passive[Passive: Cashback + Bank Bonuses]
    Q2 -->|5-10 hrs/week| Active[Active: Add Churning]
    Q2 -->|15+ hrs/week| FullTime[Full-Time: Retail Arbitrage]

    Q3{Risk Tolerance?} -->|Low| Safe[Bank Bonuses + Cashback Only]
    Q3 -->|Medium| Balanced[Add Churning + 0% APR]
    Q3 -->|High| Aggressive[All Strategies Including MS]

    style Build fill:#ffccbc
    style Passive fill:#c8e6c9
    style Safe fill:#c8e6c9
```

## Credit Card Arbitrage

### Basic Concept

Use someone with good credit, get cashback, pay immediately, and split value created by rewards (typically 1-5%).

### Reality Check

Routing all purchases through someone else's card for cashback splitting is usually not worth the coordination overhead. Example from source: at `$500/month`, returns are around `$5-25` before any split.

### When It Works

Use selectively for high-category spend you were already going to make (for example, 5% grocery category spend).

### The Real Play: Authorized User

This is framed as the highest-leverage move versus cashback splitting:

- Primary cardholder's full payment history can be added to your credit report
- Potential score boost of roughly `+30-80` points (with established on-time history)
- You do not need to hold or use the physical card
- Primary cardholder retains control and can remove you anytime
- Claimed as zero score risk to the primary cardholder in the source docs

Suggested pitch from source material:

> You don't give me a card. You don't give me access. Nothing changes for you. You just call the bank and add my name. That's it. It helps me build credit and costs you nothing.

## Verified Money-Making Strategies

### 1. Bank Account Bonuses (Low Risk)

- Open checking accounts with signup bonuses (`$200-500`)
- Meet requirements (direct deposit, minimum balance, etc.)
- Close after ~6 months
- Repeat where viable
- Risk: frequency can impact ChexSystems profile

### 2. Cashback Stacking (Low Risk)

- Stack platform cashback with card rewards
- Example: Rakuten `5%` + card `1.5%` = `6.5%`
- Common platforms: Rakuten, Honey, TopCashback

### 3. Credit Card Churning (Medium Risk)

- Open cards for signup bonuses (`50k-100k` points)
- Meet minimum spend
- Redeem points for travel/cashback
- Cancel/downgrade before annual fee cycle as appropriate
- Warning: temporary credit-score impact and high discipline required

### 4. Discounted Gift Cards (Low Risk)

- Buy gift cards at `10-20%` off face value
- Use for planned recurring purchases
- Platforms: Raise, CardCash, Gift Card Granny
- Risk is lower when buying from verified sellers

### 5. Extended Warranty (Low Risk)

- Many cards extend manufacturer warranty automatically
- Useful for electronics/appliances
- Potential savings: roughly `$50-200+` on warranty-related costs

### 6. Manufactured Spending (High Risk)

- Example loop: buy money orders with card, deposit funds, pay card off
- Goal: generate points/cashback without net consumption
- Warning: issuer and bank crackdowns; elevated risk of account shutdown

### 7. Retail Arbitrage (Medium Risk)

- Buy clearance/underpriced inventory and resell on Amazon/eBay/marketplaces
- Requires sourcing, storage, shipping, and time
- Source estimate: `$500-2000/month` part-time potential

### 8. 0% APR Balance Transfer (Low Risk)

- Transfer high-interest balances to `0% APR` card (`12-21` months)
- Execute payoff during promo window
- Main watch-out: transfer fee (`3-5%`)

## Credit Building (Start Here First)

If credit is thin or poor, sequence here before advanced card strategies.

### 1. Secured Credit Card

- Deposit: typically `$200-500`
- Credit limit mirrors deposit
- Use lightly and pay in full
- Potential graduation to unsecured after `6-12` months

### 2. Authorized User on Good Account

- Join a parent/spouse/partner card with strong history
- Full account history may report to your profile
- Intended outcome: immediate credit-age and score lift (`+30-80` points in source)
- Physical card access not required
- Primary user can remove you at any time

### 3. Credit Builder Loan

- Make installment payments into secured savings
- Funds returned at term end (often ~12 months)
- Builds payment history

### 4. Rent/Utility Reporting

- Use services such as Experian Boost for alternative tradeline reporting
- Often free or low-cost

## Legacy Strategy Note

### Credit Card Price Protection (Legacy)

- Some cards historically reimbursed price drops within `60-120` days
- Source notes many issuers ended this benefit around `2018-2020`

## Tools & Resources

- Credit monitoring: Credit Karma, Experian (free tiers)
- Cashback: Rakuten, Honey, TopCashback
- Gift cards: Raise, CardCash, Gift Card Granny
- Bank bonus tracking: Doctor of Credit
- Community research: `r/churning`
- Reselling platforms/tools: Amazon Seller app, eBay, Facebook Marketplace

## Warnings

- Do not increase spending only to chase rewards
- Do not carry revolving card balances (interest can erase gains)
- Do not submit too many new card applications at once
- Do not close cards immediately after receiving bonuses
- Do not attempt manufactured spending without clear risk controls

## Status

- Verified by source project as of `2026-02-10`
- Source project state: idea/research stage
- No build/runtime step required in original `arby` project

## Disclaimer

This is not financial advice. Perform your own due diligence and validate current terms before executing any strategy.

-->
