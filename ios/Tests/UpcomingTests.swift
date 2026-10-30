import XCTest
@testable import Epiphany

final class UpcomingTests: XCTestCase {
    func testFollowedEventsInWindowSoonestFirst() {
        let cal = Calendar.current
        let now = cal.date(from: DateComponents(year: 2026, month: 10, day: 29, hour: 12))!
        func ts(_ d: Int) -> Double { cal.date(from: DateComponents(year: 2026, month: 10, day: d, hour: 9))!.timeIntervalSince1970 }
        var aapl = Stock(symbol: "AAPL", name: "Apple", price: 1, change: 0, changePercent: 0)
        aapl.nextEarnings = ts(33); aapl.dividendDate = ts(31)
        var msft = Stock(symbol: "MSFT", name: "Microsoft", price: 1, change: 0, changePercent: 0)
        msft.nextEarnings = ts(29)
        var td = Stock(symbol: "TD", name: "TD", price: 1, change: 0, changePercent: 0)
        td.dividendDate = ts(60)
        let got = Upcoming.events([aapl, msft, td], following: ["AAPL", "MSFT", "TD"], now: now).map { "\($0.symbol) \($0.kind)" }
        XCTAssertEqual(got, ["MSFT Earnings", "AAPL Dividend", "AAPL Earnings"])
    }
}
