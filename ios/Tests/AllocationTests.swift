import XCTest
@testable import Epiphany

final class AllocationTests: XCTestCase {
    private func h(_ s: String) -> Portfolio.Holding { .init(symbol: s, shares: 1, avgCost: 1, currentPrice: 1) }

    func testChipsMatchTheWeb() {
        let holdings = [h("AAPL"), h("SHOP.TO"), h("BTC-USD")]
        XCTAssertEqual(Allocation.filterNames(holdings), ["All", "Stocks", "Crypto", "CAD", "USD"])
        XCTAssertEqual(Allocation.filterNames([h("AAPL"), h("MSFT")]), ["All"])
        XCTAssertEqual(holdings.filter { Allocation.passes($0.symbol, "CAD") }.map(\.symbol), ["SHOP.TO"])
        XCTAssertEqual(holdings.filter { Allocation.passes($0.symbol, "Stocks") }.map(\.symbol), ["AAPL", "SHOP.TO"])
    }

    func testYearlyDividends() {
        let ko = Portfolio.Holding(symbol: "KO", shares: 10, avgCost: 50, currentPrice: 100)
        let stocks = [Stock(symbol: "KO", name: "Coca-Cola", price: 100, yield: 3)]
        XCTAssertEqual(Allocation.yearlyDividends([ko, h("BTC-USD")], stocks: stocks), 30, accuracy: 0.001)
        XCTAssertEqual(Allocation.yearlyDividends([ko], stocks: []), 0)
    }

    func testUnrealizedGainSkipsHoldingsWithoutCost() {
        let a = Portfolio.Holding(symbol: "A", shares: 2, avgCost: 50, currentPrice: 60)
        let b = Portfolio.Holding(symbol: "B", shares: 1, avgCost: 100, currentPrice: 90)
        let broker = Portfolio.Holding(symbol: "C", shares: 5, avgCost: 0, currentPrice: 10)
        let u = Allocation.unrealizedGain([a, b, broker])
        XCTAssertEqual(u?.gain ?? 0, 10, accuracy: 0.001)
        XCTAssertEqual(u?.percent ?? 0, 5, accuracy: 0.001)
        XCTAssertNil(Allocation.unrealizedGain([broker]))
    }
}
