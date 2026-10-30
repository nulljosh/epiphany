import XCTest
@testable import Epiphany

final class EarningsHistoryTests: XCTestCase {
    func testVerdict() throws {
        let json = #"[{"quarter":"Q2 2026","actual":2.02,"estimate":1.89,"surprise":6.74},{"quarter":"Q1 2026","actual":2.1,"estimate":2.2,"surprise":-4.5},{"quarter":"Q4 2025","actual":1,"estimate":1,"surprise":null}]"#
        let q = try JSONDecoder().decode([EarningsQuarter].self, from: Data(json.utf8))
        XCTAssertEqual(q.map(\.verdict), ["Beat 6.7%", "Missed 4.5%", "Beat"])
    }
}
