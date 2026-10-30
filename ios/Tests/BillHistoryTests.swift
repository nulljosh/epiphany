import XCTest
@testable import Epiphany

final class BillHistoryTests: XCTestCase {
    func testEndsAtNewestPaidMonth() {
        func bill(_ m: String, _ months: [String]?) -> RecurringCharge {
            var r = RecurringCharge(merchant: m, name: m, amount: 10, cadence: "monthly", nextDate: "2026-09-01", priceDelta: 0)
            r.months = months
            return r
        }
        let g = BillHistory.grid([bill("rent", ["2026-05", "2026-06", "2026-07", "2026-08"]), bill("gym", ["2026-01", "2026-06", "2026-08"]), bill("odd", nil)], months: 4)
        XCTAssertEqual(g.months, ["2026-05", "2026-06", "2026-07", "2026-08"])
        XCTAssertEqual(g.rows.map(\.paid), [[true, true, true, true], [false, true, false, true]])
        XCTAssertTrue(BillHistory.grid([]).rows.isEmpty)
    }
}
