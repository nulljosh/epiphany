import XCTest
@testable import Epiphany

final class CashProjectionTests: XCTestCase {
    private func r(_ date: String, _ amount: Double, _ cadence: String) -> RecurringCharge {
        RecurringCharge(merchant: "m", name: "m", amount: amount, cadence: cadence, nextDate: date, priceDelta: 0)
    }

    func testBillsAndPaydaysLandOnTheirDays() {
        let today = Calendar.current.date(from: DateComponents(year: 2026, month: 10, day: 29))!
        let p = CashProjection.project(start: 1000, bills: [r("2026-09-05", 900, "monthly")],
                                       income: [r("2026-10-30", 500, "biweekly")], today: today)
        XCTAssertEqual(p.points.count, 31)
        XCTAssertEqual(p.points[1].balance, 1500)
        XCTAssertEqual(p.points[7].balance, 600)
        XCTAssertEqual(p.points[15].balance, 1100)
        XCTAssertEqual(p.points[30].balance, 1600)
        XCTAssertEqual(p.low, .init(day: 7, balance: 600))
        XCTAssertEqual(p.events, 4)
    }

    func testRestOfMonthSkipsToday() {
        let today = Calendar.current.date(from: DateComponents(year: 2026, month: 10, day: 20, hour: 12))!
        let rest = CashProjection.restOfMonth(bills: [r("2026-10-25", 100, "monthly"), r("2026-10-20", 50, "monthly"), r("2026-11-02", 9, "monthly")],
                                              income: [r("2026-10-16", 1000, "biweekly")], today: today)
        XCTAssertEqual(rest.in, 1000)
        XCTAssertEqual(rest.out, 100)
        XCTAssertEqual(rest.left, 900)
    }
}
