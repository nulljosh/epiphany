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

    func testYearToDate() throws {
        let json = #"[{"month":"Dec","sortKey":"2025-12","total":999,"categories":{"food":999}},{"month":"Jul","sortKey":"2026-07","total":6800,"categories":{"food":300,"rent":1500,"uncategorized":5000}},{"month":"Aug","sortKey":"2026-08","total":250,"categories":{"food":200,"fun":50}}]"#
        let months = try JSONDecoder().decode([FinanceData.SpendingMonth].self, from: Data(json.utf8))
        let ytd = TopSpending.yearToDate(months, year: 2026)
        XCTAssertEqual(ytd.months, 2)
        XCTAssertEqual(ytd.rows.map(\.name), ["rent", "food", "fun"])
        XCTAssertEqual(ytd.rows.map(\.amount), [1500, 500, 50])
    }
}
