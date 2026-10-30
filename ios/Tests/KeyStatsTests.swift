import XCTest
@testable import Epiphany

final class KeyStatsTests: XCTestCase {
    func testAppleStocksOrderSkipsMissing() {
        let s = Stock(symbol: "AAPL", name: "Apple", price: 200, volume: 1_000, high52: 250, low52: 150,
                      marketCap: 3e12, peRatio: 30, open: 198, prevClose: 199, dayHigh: 201, dayLow: 197)
        XCTAssertEqual(KeyStats.rows(s).map(\.label).prefix(9),
                       ["Open", "High", "Low", "Prev Close", "Volume", "P/E", "Mkt Cap", "52W H", "52W L"])
        XCTAssertFalse(KeyStats.rows(s).contains { $0.label == "Bid" })
    }
}
