import Foundation

/// Sample data for App Store screenshots only. The UITEST_DEMO launch argument switches it on, so no login and
/// no real account are involved.
enum DemoData {
    static let user = User(id: "demo", email: "alex@example.com", name: "Alex Morgan", tier: "pro", verified: true,
                           stripeCustomerId: nil, avatarUrl: nil, avatarUpdatedAt: nil)

    static let finance = FinanceData(
        holdings: [
            .init(symbol: "NVDA", shares: 24000, costBasis: 38, account: "Brokerage"),
            .init(symbol: "AAPL", shares: 52000, costBasis: 112, account: "Brokerage"),
            .init(symbol: "MSFT", shares: 18000, costBasis: 205, account: "Brokerage"),
            .init(symbol: "AMZN", shares: 30000, costBasis: 96, account: "Brokerage"),
            .init(symbol: "TSLA", shares: 9000, costBasis: 140, account: "Brokerage"),
            .init(symbol: "GOOGL", shares: 22000, costBasis: 88, account: "Retirement"),
        ],
        accounts: [
            .init(name: "Brokerage", type: "investment", balance: 38_400_000),
            .init(name: "Retirement", type: "investment", balance: 6_200_000),
            .init(name: "Private equity", type: "investment", balance: 4_100_000),
            .init(name: "Checking", type: "cash", balance: 820_000),
        ],
        budget: .init(
            income: [
                .init(name: "Salary", amount: 185_000, frequency: "monthly", note: nil),
                .init(name: "Dividends", amount: 64_000, frequency: "monthly", note: nil),
            ],
            expenses: [
                .init(name: "Mortgage", amount: 28_000, frequency: "monthly", note: nil),
                .init(name: "Travel", amount: 22_000, frequency: "monthly", note: nil),
                .init(name: "Everything else", amount: 31_000, frequency: "monthly", note: nil),
            ]
        )
    )
}
