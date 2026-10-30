import XCTest
@testable import Epiphany

final class LeftThisMonthTests: XCTestCase {
    func testMoneyInMinusOutAndNamesAnOlderMonth() {
        let now = Calendar.current.date(from: DateComponents(year: 2026, month: 10, day: 29))!
        let left = MoneyGlance.left([CashflowMonth(month: "2026-09", in: 1, out: 1),
                                     CashflowMonth(month: "2026-10", in: 3000, out: 2200)], now: now)
        XCTAssertEqual(left?.title, "Left this month")
        XCTAssertEqual(left?.left, 800)
        XCTAssertEqual(MoneyGlance.left([CashflowMonth(month: "2026-09", in: 100, out: 250)], now: now)?.title, "Left in September")
        XCTAssertNil(MoneyGlance.left([], now: now))
    }

    func testDateOnlyIsLocalCalendarDay() {
        let d = ISO8601DateFormatter.dateOnly("2026-09-01")!
        let c = Calendar.current.dateComponents([.month, .day], from: d)
        XCTAssertEqual(c.month, 9)
        XCTAssertEqual(c.day, 1)
    }
}
