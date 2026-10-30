import XCTest
@testable import Epiphany

final class BudgetMoveTests: XCTestCase {
    private func line(_ name: String, _ amount: Double) -> FinanceData.Budget.BudgetLine {
        .init(name: name, amount: amount, frequency: "monthly", note: nil)
    }
    private let month = FinanceData.SpendingMonth(month: "Oct", sortKey: "2026-10", total: 670,
                                                  categories: ["food": 500, "shopping": 50, "cannabis": 120])

    func testCoversFromTheLineWithTheMostLeft() {
        var budget = FinanceData.Budget(income: [], expenses: [line("Food", 400), line("Shopping", 200), line("Weed", 150), line("Phone", 80)])
        let plan = budget.coverPlan(for: budget.expenses[0], in: month)
        XCTAssertEqual(plan?.from, 1)
        XCTAssertEqual(plan?.amount, 100)
        XCTAssertNil(budget.coverPlan(for: budget.expenses[1], in: month))
        XCTAssertNil(budget.coverPlan(for: budget.expenses[3], in: month))
        budget.moveMoney(from: 1, to: 0, amount: 100)
        XCTAssertEqual(budget.expenses.map(\.amount), [500, 100, 150, 80])
    }

    func testWebCategoriesSurviveARoundTrip() throws {
        let json = #"{"name":"Fun","amount":100,"frequency":"monthly","categories":["liquor","vape"]}"#
        let decoded = try JSONDecoder().decode(FinanceData.Budget.BudgetLine.self, from: Data(json.utf8))
        XCTAssertEqual(decoded.statementCategories, ["liquor", "vape"])
        let again = try JSONSerialization.jsonObject(with: JSONEncoder().encode(decoded)) as? [String: Any]
        XCTAssertEqual(again?["categories"] as? [String], ["liquor", "vape"])
    }
}
