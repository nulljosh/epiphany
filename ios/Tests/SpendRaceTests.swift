import XCTest
@testable import Epiphany

final class SpendRaceTests: XCTestCase {
    func testRunsUpByDay() throws {
        let json = #"[{"filename":"a","transactions":[{"date":"2026-07-01","description":"a","amount":-10,"category":"food"},{"date":"2026-07-03","description":"b","amount":-20,"category":"rent"},{"date":"2026-08-02","description":"c","amount":-7,"category":"food"},{"date":"2026-08-03","description":"d","amount":-8,"category":"food"},{"date":"2026-08-05","description":"x","amount":-99},{"date":"2026-08-04","description":"e","amount":500}]}]"#
        let r = SpendRace.build(try JSONDecoder().decode([Statement].self, from: Data(json.utf8)))
        XCTAssertEqual(r?.month, "2026-08")
        XCTAssertEqual(r?.cur, [0, 7, 15])
        XCTAssertEqual(Array(r!.before.prefix(3)), [10, 10, 30])
    }
}
