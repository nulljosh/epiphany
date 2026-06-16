import XCTest
@testable import Epiphany

final class HeikinAshiTests: XCTestCase {

    private func makeOHLC(_ data: [(o: Double, h: Double, l: Double, c: Double)]) -> [StockDetailView.OHLCPoint] {
        data.enumerated().map { i, d in
            StockDetailView.OHLCPoint(
                id: i,
                date: Date(timeIntervalSince1970: Double(i) * 86400),
                open: d.o, high: d.h, low: d.l, close: d.c
            )
        }
    }

    func testFirstCandleComputation() {
        // HA_Close = (10+15+8+12)/4 = 11.25
        // HA_Open = (10+12)/2 = 11
        // HA_High = max(15, 11, 11.25) = 15
        // HA_Low = min(8, 11, 11.25) = 8
        let raw = makeOHLC([(o: 10, h: 15, l: 8, c: 12)])
        let ha = StockDetailView.computeHeikinAshi(raw)

        XCTAssertEqual(ha.count, 1)
        XCTAssertEqual(ha[0].close, 11.25, accuracy: 0.001)
        XCTAssertEqual(ha[0].open, 11.0, accuracy: 0.001)
        XCTAssertEqual(ha[0].high, 15.0, accuracy: 0.001)
        XCTAssertEqual(ha[0].low, 8.0, accuracy: 0.001)
    }

    func testSecondCandleChainsFromFirst() {
        let raw = makeOHLC([
            (o: 10, h: 15, l: 8, c: 12),
            (o: 13, h: 16, l: 11, c: 14),
        ])
        let ha = StockDetailView.computeHeikinAshi(raw)

        XCTAssertEqual(ha.count, 2)
        // Second HA_Open = (11 + 11.25) / 2 = 11.125
        XCTAssertEqual(ha[1].open, 11.125, accuracy: 0.001)
        // Second HA_Close = (13+16+11+14)/4 = 13.5
        XCTAssertEqual(ha[1].close, 13.5, accuracy: 0.001)
        XCTAssertEqual(ha[1].high, 16.0, accuracy: 0.001)
        XCTAssertEqual(ha[1].low, 11.0, accuracy: 0.001)
    }

    func testHighAlwaysAboveOpenAndClose() {
        let raw = makeOHLC([
            (o: 100, h: 110, l: 90, c: 105),
            (o: 106, h: 112, l: 95, c: 98),
            (o: 97, h: 103, l: 92, c: 100),
            (o: 101, h: 108, l: 96, c: 104),
        ])
        let ha = StockDetailView.computeHeikinAshi(raw)

        for c in ha {
            XCTAssertGreaterThanOrEqual(c.high, c.open)
            XCTAssertGreaterThanOrEqual(c.high, c.close)
            XCTAssertLessThanOrEqual(c.low, c.open)
            XCTAssertLessThanOrEqual(c.low, c.close)
        }
    }

    func testFlatPriceProducesFlat() {
        let raw = makeOHLC([
            (o: 50, h: 50, l: 50, c: 50),
            (o: 50, h: 50, l: 50, c: 50),
        ])
        let ha = StockDetailView.computeHeikinAshi(raw)

        for c in ha {
            XCTAssertEqual(c.open, 50.0, accuracy: 0.001)
            XCTAssertEqual(c.close, 50.0, accuracy: 0.001)
        }
    }

    func testEmptyInputReturnsEmpty() {
        let ha = StockDetailView.computeHeikinAshi([])
        XCTAssertTrue(ha.isEmpty)
    }

    func testDatesPreserved() {
        let raw = makeOHLC([
            (o: 10, h: 15, l: 8, c: 12),
            (o: 13, h: 16, l: 11, c: 14),
            (o: 15, h: 18, l: 13, c: 17),
        ])
        let ha = StockDetailView.computeHeikinAshi(raw)

        for (i, c) in ha.enumerated() {
            XCTAssertEqual(c.date, raw[i].date)
        }
    }
}
