import XCTest
@testable import Epiphany

final class SectorHeatTests: XCTestCase {
    func testAveragesEachSectorAndSkipsFunds() {
        let stocks = [Stock(symbol: "AAPL", name: "Apple", price: 1, changePercent: 2),
                      Stock(symbol: "MSFT", name: "Microsoft", price: 1, changePercent: -1),
                      Stock(symbol: "JPM", name: "JPMorgan", price: 1, changePercent: -0.5),
                      Stock(symbol: "SPY", name: "S&P 500", price: 1, changePercent: 1)]
        XCTAssertEqual(SectorHeat.moves(stocks), [.init(sector: "Tech", change: 0.5, count: 2),
                                                  .init(sector: "Financials", change: -0.5, count: 1)])
        XCTAssertEqual(SectorHeat.alpha(-6), 0.82, accuracy: 0.001)
    }

    func testHoldingsBySectorBiggestFirst() {
        let h = [("AAPL", 300.0), ("MSFT", 100), ("JPM", 200), ("BTC-USD", 250), ("ZZZZ", 150), ("NVDA", 0)]
            .map { Portfolio.Holding(symbol: $0.0, shares: 1, avgCost: 0, currentPrice: $0.1) }
        let slices = SectorHeat.holdings(h)
        XCTAssertEqual(slices.map(\.sector), ["Tech", "Crypto", "Financials", "Other"])
        XCTAssertEqual(slices[0], SectorHeat.Slice(sector: "Tech", value: 400, share: 0.4))
    }

    func testByCountry() {
        let h = [("AAPL", 600.0), ("TD.TO", 300), ("BTC-USD", 100)].map { Portfolio.Holding(symbol: $0.0, shares: 1, avgCost: 0, currentPrice: $0.1) }
        XCTAssertEqual(SectorHeat.byCountry(h), [.init(sector: "US", value: 600, share: 0.6), .init(sector: "Canada", value: 300, share: 0.3), .init(sector: "Crypto", value: 100, share: 0.1)])
    }
}
