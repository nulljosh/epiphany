import XCTest
@testable import Epiphany

final class DividendCalendarTests: XCTestCase {
    func testQuarterlyPayerAcrossTheYear() {
        let cal = Calendar.current
        let now = cal.date(from: DateComponents(year: 2026, month: 10, day: 30))!
        let pay = cal.date(from: DateComponents(year: 2026, month: 11, day: 15))!
        var td = Stock(symbol: "TD", name: "TD", price: 100, yield: 4)
        td.dividendDate = pay.timeIntervalSince1970
        let aapl = Stock(symbol: "AAPL", name: "Apple", price: 100, yield: 0.4)
        let holdings = [Portfolio.Holding(symbol: "TD", shares: 40, avgCost: 0, currentPrice: 100),
                        Portfolio.Holding(symbol: "AAPL", shares: 10, avgCost: 0, currentPrice: 100)]
        let d = DividendCalendar.build(holdings, stocks: [td, aapl], now: now)
        XCTAssertEqual(d.calendar.count, 12)
        XCTAssertEqual(d.calendar.filter { $0.amount > 0 }.map { cal.component(.month, from: $0.month) }, [11, 2, 5, 8])
        XCTAssertEqual(d.calendar[1].amount, 40)
        XCTAssertEqual(d.next, [.init(symbol: "TD", date: pay, amount: 40)])
    }
}
