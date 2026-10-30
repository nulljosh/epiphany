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

    func testBillsByMonthRollsForward() {
        let today = Calendar.current.date(from: DateComponents(year: 2026, month: 10, day: 20, hour: 12))!
        let g = CashProjection.billsByMonth([r("2026-08-01", 1500, "monthly"), r("2026-10-25", 40, "monthly")], today: today)
        XCTAssertEqual(g.map(\.month), ["2026-10", "2026-11", "2026-12"])
        XCTAssertEqual(g.map(\.total), [40, 1540, 1500])
    }

    func testDueLabel() {
        let cal = Calendar.current
        let today = cal.date(from: DateComponents(year: 2026, month: 10, day: 30, hour: 15))!
        let d = { (m: Int, day: Int) in cal.date(from: DateComponents(year: 2026, month: m, day: day))! }
        XCTAssertEqual([d(10, 30), d(10, 31), d(11, 2)].map { CashProjection.dueLabel($0, today: today) }, ["Due today", "Due tomorrow", "Due in 3 days"])
    }
}
