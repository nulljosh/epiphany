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

    func testFixedPlansCountDownByMonth() throws {
        let now = Calendar(identifier: .gregorian).date(from: DateComponents(year: 2026, month: 11, day: 15))!
        let phone = FinanceData.DebtItem(name: "Phone", balance: 1000, rate: 0, minPayment: 50, since: "2026-08").paidDown(now: now)
        XCTAssertEqual(phone.balance, 850)
        XCTAssertEqual(phone.since, "2026-11")
        XCTAssertEqual(FinanceData.DebtItem(name: "Card", balance: 1000, rate: 12, minPayment: 100, since: "2026-10").paidDown(now: now).balance, 910)
        XCTAssertEqual(FinanceData.DebtItem(name: "Loan", balance: 500, rate: 0, minPayment: 0, since: "2026-01").paidDown(now: now).balance, 500)
        let pay = CashProjection.monthlyPay([RecurringCharge(merchant: "pay", name: "Payroll", amount: 1200, cadence: "biweekly", nextDate: "2026-11-20", priceDelta: 0)])
        XCTAssertEqual(pay, 2600, accuracy: 0.01)
    }
}
