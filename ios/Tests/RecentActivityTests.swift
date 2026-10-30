import XCTest
@testable import Epiphany

final class RecentActivityTests: XCTestCase {
    func testNewestFirst() throws {
        let json = #"[{"filename":"a","transactions":[{"date":"2026-08-01","description":"A","amount":-5},{"date":"2026-08-20","description":"B","amount":100}]},{"filename":"b","transactions":[{"date":"2026-08-10","description":"C","amount":-9}]}]"#
        let statements = try JSONDecoder().decode([Statement].self, from: Data(json.utf8))
        XCTAssertEqual(RecentActivity.latest(statements, count: 2).map(\.description), ["B", "C"])
    }

    func testEarnedThisYear() throws {
        let json = #"[{"filename":"a","transactions":[{"date":"2026-03-01","description":"Dividend AAPL","amount":2.5},{"date":"2026-06-01","description":"DIV XEQT","amount":1.5},{"date":"2026-08-31","description":"Interest earned","amount":0.12},{"date":"2025-12-31","description":"Interest earned","amount":9},{"date":"2026-05-01","description":"Interest charge","amount":-3},{"date":"2026-05-02","description":"Diversity fund","amount":5}]}]"#
        let e = RecentActivity.earned(try JSONDecoder().decode([Statement].self, from: Data(json.utf8)), year: 2026)
        XCTAssertEqual(e.dividends, 4)
        XCTAssertEqual(e.interest, 0.12, accuracy: 0.0001)
    }

    func testMerchantKeyMatchesServer() {
        XCTAssertEqual(MerchantKey.of("SPOTIFY #789 STOCKHOLM SE"), "spotify stockholm")
        XCTAssertEqual(MerchantKey.of("PRE AUTHORIZED DEBIT TO ABC CLUB FITNESS"), "abc club")
    }

    func testBiggest() throws {
        let json = #"[{"filename":"a","transactions":[{"date":"2026-07-01","description":"R","amount":-900,"category":"rent"},{"date":"2026-08-01","description":"R","amount":-450,"category":"rent"},{"date":"2026-08-09","description":"F","amount":-60,"category":"food"},{"date":"2026-08-10","description":"X","amount":-999}]}]"#
        XCTAssertEqual(RecentActivity.biggest(try JSONDecoder().decode([Statement].self, from: Data(json.utf8)))?.amount, -450)
    }
}
