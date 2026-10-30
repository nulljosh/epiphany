import XCTest
@testable import Epiphany

final class GrowthTests: XCTestCase {
    func testMatchesMonthlyAnnuityFutureValue() {
        let end = Growth.curve(monthly: 500, years: 30, rate: 7).last!
        XCTAssertEqual(end.contributed, 180_000)
        XCTAssertEqual(end.value, 609_985.5, accuracy: 1)
        XCTAssertEqual(Growth.curve(monthly: 100, years: 2, rate: 0).map(\.value), [0, 1200, 2400])
    }
}
