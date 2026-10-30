import XCTest
@testable import Epiphany

final class BudgetRingTests: XCTestCase {
    func testWholeBudgetAgainstMonthSpend() throws {
        let json = #"{"income":[],"expenses":[{"name":"Rent","amount":2000,"frequency":"monthly"},{"name":"Food","amount":1500,"frequency":"monthly"}]}"#
        let budget = try JSONDecoder().decode(FinanceData.Budget.self, from: Data(json.utf8))
        let month = try JSONDecoder().decode(FinanceData.SpendingMonth.self, from: Data(#"{"month":"Aug 2026","sortKey":"2026-08","total":1433,"categories":{}}"#.utf8))
        let r = BudgetRing.left(budget, month: month)
        XCTAssertEqual(r?.budget, 3500)
        XCTAssertEqual(r?.left, 2067)
        XCTAssertNil(BudgetRing.left(budget, month: nil))
    }
}
