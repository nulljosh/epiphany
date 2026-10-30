import XCTest
@testable import Epiphany

final class GreetingTests: XCTestCase {
    func testGreetingAndSince() {
        XCTAssertEqual([8, 14, 21, 2].map { Greeting.text(hour: $0) }, ["Good morning", "Good afternoon", "Good evening", "Good evening"])
        let now = Date(timeIntervalSince1970: 1_800_000_000)
        let s = Greeting.since(prevValue: 100, prevAt: now.addingTimeInterval(-30 * 3600), value: 112.4, now: now)
        XCTAssertEqual(s?.when, "yesterday")
        XCTAssertEqual(s?.diff ?? 0, 12.4, accuracy: 0.001)
        XCTAssertNil(Greeting.since(prevValue: 100, prevAt: now.addingTimeInterval(-600), value: 90, now: now))
    }
}
