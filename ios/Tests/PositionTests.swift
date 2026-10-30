import XCTest
@testable import Epiphany

final class PositionTests: XCTestCase {
    func testSumsAcrossAccounts() {
        let h: [FinanceData.Holding] = [.init(symbol: "AAPL", shares: 2, costBasis: 100), .init(symbol: "AAPL", shares: 2, costBasis: 150),
                                        .init(symbol: "MSFT", shares: 9, costBasis: 1)]
        let p = Position.make(h, symbol: "AAPL", price: 200, changePercent: 25)
        XCTAssertEqual(p, Position(shares: 4, value: 800, today: 160, avgCost: 125, gain: 300, gainPercent: 60))
        XCTAssertNil(Position.make(h, symbol: "TSLA", price: 10, changePercent: 0))
    }

    func testNoCostBasisLeavesGainNil() {
        let p = Position.make([.init(symbol: "BTC-USD", shares: 1, costBasis: 0)], symbol: "BTC-USD", price: 10, changePercent: 0)
        XCTAssertEqual(p?.value, 10)
        XCTAssertNil(p?.gain)
    }

    func testValuationLine() {
        XCTAssertEqual(Valuation.line(pe: 40, market: 24.4), "P/E 40.0 is 64% above the S&P 500's 24.4")
        XCTAssertEqual(Valuation.line(pe: 14.4, market: 24.4), "P/E 14.4 is 41% below the S&P 500's 24.4")
        XCTAssertEqual(Valuation.line(pe: 25, market: 24.4), "P/E 25.0 is about level with the S&P 500's 24.4")
        XCTAssertNil(Valuation.line(pe: nil, market: 24.4))
    }
}
