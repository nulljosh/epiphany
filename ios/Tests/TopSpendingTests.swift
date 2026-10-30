import XCTest
@testable import Epiphany

final class TopSpendingTests: XCTestCase {
    func testTopFourPlusOther() {
        let rows = TopSpending.rows(["food": 300, "rent": 500, "fun": 100, "gas": 50, "gym": 30, "tea": 20, "zero": 0])
        XCTAssertEqual(rows.map(\.name), ["rent", "food", "fun", "gas", "other"])
        XCTAssertEqual(rows[0].share, 0.5)
        XCTAssertEqual(rows[4].amount, 50)
        XCTAssertTrue(TopSpending.rows([:]).isEmpty)
    }
}
