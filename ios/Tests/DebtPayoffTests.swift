import XCTest
@testable import Epiphany

final class DebtPayoffTests: XCTestCase {
    func testSmallestFirstWithFinish() {
        let now = Calendar.current.date(from: DateComponents(year: 2026, month: 10, day: 30))!
        let debt = [FinanceData.DebtItem(name: "Card", balance: 1200, rate: 0, minPayment: 100),
                    FinanceData.DebtItem(name: "Phone", balance: 300, rate: 0, minPayment: 100)]
        let p = DebtPayoff.plan(debt, now: now)
        XCTAssertEqual(p.steps.map(\.name), ["Phone", "Card"])
        XCTAssertEqual(p.steps.map(\.cumulative), [3, 15])
        XCTAssertEqual(Calendar.current.dateComponents([.year, .month], from: p.finish!), DateComponents(year: 2028, month: 1))
        XCTAssertTrue(DebtPayoff.plan([.init(name: "X", balance: 10, rate: 0, minPayment: 0)]).unpayable)
        XCTAssertEqual(DebtPayoff.months(balance: 1000, payment: 100, rate: 12), 10.59, accuracy: 0.01)
    }
}
