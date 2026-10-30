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
}
