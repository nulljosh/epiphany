import Foundation
import Testing
@testable import Opticon

@Suite struct PortfolioTests {
    @Test func portfolioFromFinanceData() {
        let financeData = FinanceData(
            holdings: [
                .init(symbol: "AAPL", shares: 10, costBasis: 150, currency: "USD"),
                .init(symbol: "GOOGL", shares: 5, costBasis: 100, currency: "USD")
            ],
            accounts: [],
            budget: nil,
            debt: [],
            goals: [],
            spending: []
        )
        let stocks = [
            Stock(symbol: "AAPL", name: "Apple", price: 180, change: 2, changePercent: 1.12),
            Stock(symbol: "GOOGL", name: "Alphabet", price: 140, change: -1, changePercent: -0.71)
        ]

        let portfolio = Portfolio(financeData: financeData, stocks: stocks)

        #expect(portfolio.holdings.count == 2)
        #expect(portfolio.totalValue == (10 * 180) + (5 * 140))

        let appleHolding = portfolio.holdings.first { $0.symbol == "AAPL" }!
        #expect(appleHolding.marketValue == 1800)
        #expect(appleHolding.gainLoss == (180 - 150) * 10)
    }

    @Test func portfolioUseCostBasisWhenNoStockMatch() {
        let financeData = FinanceData(
            holdings: [.init(symbol: "XYZ", shares: 3, costBasis: 50, currency: "USD")],
            accounts: [],
            budget: nil,
            debt: [],
            goals: [],
            spending: []
        )

        let portfolio = Portfolio(financeData: financeData, stocks: [])
        #expect(portfolio.holdings.first?.currentPrice == 50)
        #expect(portfolio.totalValue == 150)
    }
}

@Suite struct SpendingForecastTests {
    @Test func needsAtLeastThreeMonths() {
        let twoMonths = [
            FinanceData.SpendingMonth(month: "Jan 2026", sortKey: "2026-01", total: 1000, categories: [:]),
            FinanceData.SpendingMonth(month: "Feb 2026", sortKey: "2026-02", total: 1200, categories: [:])
        ]
        #expect(SpendingForecastBuilder.build(from: twoMonths) == nil)
    }

    @Test func buildsWithThreeMonths() {
        let months = [
            FinanceData.SpendingMonth(month: "Jan 2026", sortKey: "2026-01", total: 1000, categories: [:]),
            FinanceData.SpendingMonth(month: "Feb 2026", sortKey: "2026-02", total: 1200, categories: [:]),
            FinanceData.SpendingMonth(month: "Mar 2026", sortKey: "2026-03", total: 1100, categories: [:])
        ]
        let forecast = SpendingForecastBuilder.build(from: months)
        #expect(forecast != nil)
        #expect(forecast!.points.count == months.count)
        #expect(forecast!.summary.expectedNextMonth > 0)
        #expect(forecast!.summary.rangeLow <= forecast!.summary.expectedNextMonth)
        #expect(forecast!.summary.rangeHigh >= forecast!.summary.expectedNextMonth)
    }

    @Test func forecastIsDeterministic() {
        let months = [
            FinanceData.SpendingMonth(month: "Jan 2026", sortKey: "2026-01", total: 800, categories: [:]),
            FinanceData.SpendingMonth(month: "Feb 2026", sortKey: "2026-02", total: 950, categories: [:]),
            FinanceData.SpendingMonth(month: "Mar 2026", sortKey: "2026-03", total: 900, categories: [:])
        ]
        let a = SpendingForecastBuilder.build(from: months)!
        let b = SpendingForecastBuilder.build(from: months)!
        #expect(a.summary.expectedNextMonth == b.summary.expectedNextMonth)
    }
}

@Suite struct StockDecodingTests {
    @Test func decodesFromJSON() throws {
        let json = """
        {
            "symbol": "MSFT",
            "name": "Microsoft",
            "price": 420.50,
            "change": 3.20,
            "changesPercentage": 0.77,
            "volume": 25400000,
            "yearHigh": 450.00,
            "yearLow": 310.00
        }
        """.data(using: .utf8)!

        let stock = try JSONDecoder().decode(Stock.self, from: json)
        #expect(stock.symbol == "MSFT")
        #expect(stock.price == 420.50)
        #expect(stock.changePercent == 0.77)
        #expect(stock.formattedVolume == "25.4M")
    }

    @Test func decodesWithMissingOptionalFields() throws {
        let json = """
        {"symbol": "TEST", "price": 10.0}
        """.data(using: .utf8)!

        let stock = try JSONDecoder().decode(Stock.self, from: json)
        #expect(stock.symbol == "TEST")
        #expect(stock.name == "TEST")
        #expect(stock.change == 0)
        #expect(stock.volume == 0)
    }

    @Test func formattedVolumeRanges() {
        #expect(Stock(symbol: "A", name: "A", price: 1, volume: 1_500_000_000).formattedVolume == "1.5B")
        #expect(Stock(symbol: "A", name: "A", price: 1, volume: 5_200_000).formattedVolume == "5.2M")
        #expect(Stock(symbol: "A", name: "A", price: 1, volume: 42_000).formattedVolume == "42K")
        #expect(Stock(symbol: "A", name: "A", price: 1, volume: 500).formattedVolume == "500")
    }
}
