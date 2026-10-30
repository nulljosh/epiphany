import XCTest
@testable import Epiphany

final class RecentActivityTests: XCTestCase {
    func testNewestFirst() throws {
        let json = #"[{"filename":"a","transactions":[{"date":"2026-08-01","description":"A","amount":-5},{"date":"2026-08-20","description":"B","amount":100}]},{"filename":"b","transactions":[{"date":"2026-08-10","description":"C","amount":-9}]}]"#
        let statements = try JSONDecoder().decode([Statement].self, from: Data(json.utf8))
        XCTAssertEqual(RecentActivity.latest(statements, count: 2).map(\.description), ["B", "C"])
    }
}
