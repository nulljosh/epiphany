import XCTest
@testable import Epiphany

final class WatchlistSortTests: XCTestCase {
    func testOrders() {
        let s = [Stock(symbol: "MSFT", name: "M", price: 500, changePercent: -1), Stock(symbol: "AAPL", name: "A", price: 300, changePercent: 2),
                 Stock(symbol: "NVDA", name: "N", price: 200, changePercent: 0.5)]
        XCTAssertEqual(WatchlistSort.manual.apply(s).map(\.symbol), ["MSFT", "AAPL", "NVDA"])
        XCTAssertEqual(WatchlistSort.name.apply(s).map(\.symbol), ["AAPL", "MSFT", "NVDA"])
        XCTAssertEqual(WatchlistSort.price.apply(s).map(\.symbol), ["MSFT", "AAPL", "NVDA"])
        XCTAssertEqual(WatchlistSort.change.apply(s).map(\.symbol), ["AAPL", "NVDA", "MSFT"])
    }
}
