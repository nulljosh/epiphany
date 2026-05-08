import XCTest
@testable import Epiphany

final class IndicatorTests: XCTestCase {

    private func makePoints(_ values: [Double]) -> [(Date, Double)] {
        values.enumerated().map { i, v in
            (Date(timeIntervalSince1970: Double(i) * 86400), v)
        }
    }

    // MARK: - SMA

    func testSMABasicCalculation() {
        let prices = makePoints([10, 20, 30, 40, 50])
        let sma = Indicators.sma(prices: prices, period: 3)

        XCTAssertEqual(sma.count, 3)
        XCTAssertEqual(sma[0].value, 20.0, accuracy: 0.001) // (10+20+30)/3
        XCTAssertEqual(sma[1].value, 30.0, accuracy: 0.001) // (20+30+40)/3
        XCTAssertEqual(sma[2].value, 40.0, accuracy: 0.001) // (30+40+50)/3
    }

    func testSMAReturnsEmptyWhenNotEnoughData() {
        let prices = makePoints([10, 20])
        let sma = Indicators.sma(prices: prices, period: 5)
        XCTAssertTrue(sma.isEmpty)
    }

    func testSMAPeriodOne() {
        let prices = makePoints([10, 20, 30])
        let sma = Indicators.sma(prices: prices, period: 1)
        XCTAssertEqual(sma.count, 3)
        XCTAssertEqual(sma[0].value, 10.0, accuracy: 0.001)
        XCTAssertEqual(sma[1].value, 20.0, accuracy: 0.001)
        XCTAssertEqual(sma[2].value, 30.0, accuracy: 0.001)
    }

    func testSMADatesMatchInput() {
        let prices = makePoints([10, 20, 30, 40])
        let sma = Indicators.sma(prices: prices, period: 2)
        XCTAssertEqual(sma[0].date, prices[1].0)
        XCTAssertEqual(sma[1].date, prices[2].0)
        XCTAssertEqual(sma[2].date, prices[3].0)
    }

    func testSMAWithFlatPrices() {
        let prices = makePoints([100, 100, 100, 100, 100])
        let sma = Indicators.sma(prices: prices, period: 3)
        for point in sma {
            XCTAssertEqual(point.value, 100.0, accuracy: 0.001)
        }
    }

    // MARK: - EMA

    func testEMABasicCalculation() {
        let prices = makePoints([10, 20, 30, 40, 50])
        let ema = Indicators.ema(prices: prices, period: 3)

        // Seed = SMA(first 3) = 20
        // k = 2/(3+1) = 0.5
        // EMA[3] = 40 * 0.5 + 20 * 0.5 = 30
        // EMA[4] = 50 * 0.5 + 30 * 0.5 = 40
        XCTAssertEqual(ema.count, 3)
        XCTAssertEqual(ema[0].value, 20.0, accuracy: 0.001) // seed
        XCTAssertEqual(ema[1].value, 30.0, accuracy: 0.001)
        XCTAssertEqual(ema[2].value, 40.0, accuracy: 0.001)
    }

    func testEMAReturnsEmptyWhenNotEnoughData() {
        let prices = makePoints([10, 20])
        let ema = Indicators.ema(prices: prices, period: 5)
        XCTAssertTrue(ema.isEmpty)
    }

    func testEMAWithFlatPrices() {
        let prices = makePoints([50, 50, 50, 50, 50])
        let ema = Indicators.ema(prices: prices, period: 3)
        for point in ema {
            XCTAssertEqual(point.value, 50.0, accuracy: 0.001)
        }
    }

    func testEMAReactsToSpike() {
        let prices = makePoints([10, 10, 10, 100, 10])
        let ema = Indicators.ema(prices: prices, period: 3)

        // Seed = 10, k = 0.5
        // After spike: 100*0.5 + 10*0.5 = 55
        // After drop: 10*0.5 + 55*0.5 = 32.5
        XCTAssertEqual(ema[0].value, 10.0, accuracy: 0.001)
        XCTAssertEqual(ema[1].value, 55.0, accuracy: 0.001)
        XCTAssertEqual(ema[2].value, 32.5, accuracy: 0.001)
    }
}
