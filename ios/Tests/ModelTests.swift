import XCTest
@testable import Epiphany

final class StockModelTests: XCTestCase {

    func testStockDecodesFromFMPResponse() throws {
        let json = """
        {
            "symbol": "AAPL",
            "name": "Apple Inc.",
            "price": 264.58,
            "change": -0.85,
            "changePercent": -0.32,
            "volume": 45000000,
            "fiftyTwoWeekHigh": 280.00,
            "fiftyTwoWeekLow": 164.08,
            "open": 265.10,
            "prevClose": 265.43,
            "high": 266.00,
            "low": 263.50,
            "marketCap": 4100000000000,
            "peRatio": 33.5,
            "eps": 7.90
        }
        """.data(using: .utf8)!

        let stock = try JSONDecoder().decode(Stock.self, from: json)
        XCTAssertEqual(stock.symbol, "AAPL")
        XCTAssertEqual(stock.name, "Apple Inc.")
        XCTAssertEqual(stock.price, 264.58)
        XCTAssertEqual(stock.change, -0.85)
        XCTAssertEqual(stock.changePercent, -0.32)
        XCTAssertEqual(stock.volume, 45000000)
        XCTAssertEqual(stock.high52, 280.00)
        XCTAssertEqual(stock.low52, 164.08)
        XCTAssertEqual(stock.open, 265.10)
        XCTAssertEqual(stock.prevClose, 265.43)
        XCTAssertEqual(stock.dayHigh, 266.00)
        XCTAssertEqual(stock.dayLow, 263.50)
        XCTAssertEqual(stock.marketCap, 4100000000000)
        XCTAssertEqual(stock.peRatio, 33.5)
        XCTAssertEqual(stock.eps, 7.90)
        XCTAssertEqual(stock.id, "AAPL")
    }

    func testStockDecodesWithMissingOptionalFields() throws {
        let json = """
        {
            "symbol": "XYZ",
            "price": 72.40
        }
        """.data(using: .utf8)!

        let stock = try JSONDecoder().decode(Stock.self, from: json)
        XCTAssertEqual(stock.symbol, "XYZ")
        XCTAssertEqual(stock.name, "XYZ")
        XCTAssertEqual(stock.price, 72.40)
        XCTAssertEqual(stock.change, 0)
        XCTAssertEqual(stock.changePercent, 0)
        XCTAssertEqual(stock.volume, 0)
        XCTAssertEqual(stock.high52, 0)
        XCTAssertEqual(stock.low52, 0)
    }

    func testStockHashable() {
        let a = Stock(symbol: "AAPL", name: "Apple", price: 100)
        let b = Stock(symbol: "AAPL", name: "Apple", price: 100)
        XCTAssertEqual(a, b)

        var set = Set<Stock>()
        set.insert(a)
        set.insert(b)
        XCTAssertEqual(set.count, 1)
    }

    func testStockDecodeFailsWithMissingSymbol() {
        let json = """
        {"price": 100.0}
        """.data(using: .utf8)!

        XCTAssertThrowsError(try JSONDecoder().decode(Stock.self, from: json))
    }

    func testStockDecodeFailsWithMissingPrice() {
        let json = """
        {"symbol": "AAPL"}
        """.data(using: .utf8)!

        XCTAssertThrowsError(try JSONDecoder().decode(Stock.self, from: json))
    }

    func testStockDecodeFailsWithInvalidJSON() {
        let json = "not json".data(using: .utf8)!
        XCTAssertThrowsError(try JSONDecoder().decode(Stock.self, from: json))
    }

    func testEmptyStockArrayDecodes() throws {
        let json = "[]".data(using: .utf8)!
        let stocks = try JSONDecoder().decode([Stock].self, from: json)
        XCTAssertTrue(stocks.isEmpty)
    }
}

final class WatchlistItemModelTests: XCTestCase {

    func testWatchlistItemDecodes() throws {
        let json = """
        {
            "id": "abc-123",
            "user_email": "test@example.com",
            "symbol": "NVDA",
            "added_at": "2026-02-26T10:30:00Z"
        }
        """.data(using: .utf8)!

        let item = try JSONDecoder().decode(WatchlistItem.self, from: json)
        XCTAssertEqual(item.id, "abc-123")
        XCTAssertEqual(item.userEmail, "test@example.com")
        XCTAssertEqual(item.symbol, "NVDA")
        XCTAssertEqual(item.addedAt, "2026-02-26T10:30:00Z")
    }

    func testWatchlistItemDecodesWithMinimalFields() throws {
        let json = """
        {"id": "x", "symbol": "AAPL"}
        """.data(using: .utf8)!

        let item = try JSONDecoder().decode(WatchlistItem.self, from: json)
        XCTAssertEqual(item.symbol, "AAPL")
        XCTAssertNil(item.userEmail)
        XCTAssertNil(item.addedAt)
    }

    func testWatchlistItemId() throws {
        let json = """
        {"id": "test-id", "symbol": "TSLA"}
        """.data(using: .utf8)!

        let item = try JSONDecoder().decode(WatchlistItem.self, from: json)
        XCTAssertEqual(item.id, "test-id")
    }
}

final class PriceAlertModelTests: XCTestCase {

    func testAlertDecodes() throws {
        let json = """
        {
            "id": "alert-1",
            "user_email": "test@example.com",
            "symbol": "AAPL",
            "target_price": 250.50,
            "direction": "above",
            "triggered": false,
            "created_at": "2026-02-26T10:30:00Z"
        }
        """.data(using: .utf8)!

        let alert = try JSONDecoder().decode(PriceAlert.self, from: json)
        XCTAssertEqual(alert.id, "alert-1")
        XCTAssertEqual(alert.symbol, "AAPL")
        XCTAssertEqual(alert.targetPrice, 250.50)
        XCTAssertEqual(alert.direction, .above)
        XCTAssertFalse(alert.triggered)
    }

    func testAlertDecodesBelow() throws {
        let json = """
        {
            "id": "alert-2",
            "symbol": "NVDA",
            "target_price": 150.00,
            "direction": "below",
            "triggered": true
        }
        """.data(using: .utf8)!

        let alert = try JSONDecoder().decode(PriceAlert.self, from: json)
        XCTAssertEqual(alert.direction, .below)
        XCTAssertTrue(alert.triggered)
    }

    func testAlertDecodeFailsWithInvalidDirection() {
        let json = """
        {
            "id": "x",
            "symbol": "AAPL",
            "target_price": 100,
            "direction": "sideways",
            "triggered": false
        }
        """.data(using: .utf8)!

        XCTAssertThrowsError(try JSONDecoder().decode(PriceAlert.self, from: json))
    }

    func testAlertDecodeFailsWithMissingTargetPrice() {
        let json = """
        {
            "id": "x",
            "symbol": "AAPL",
            "direction": "above",
            "triggered": false
        }
        """.data(using: .utf8)!

        XCTAssertThrowsError(try JSONDecoder().decode(PriceAlert.self, from: json))
    }
}

final class PortfolioModelTests: XCTestCase {

    func testPortfolioDecodes() throws {
        let json = """
        {
            "totalValue": 15000.50,
            "dayChange": 125.30,
            "dayChangePercent": 0.84,
            "holdings": [
                {
                    "symbol": "AAPL",
                    "shares": 10.5,
                    "avgCost": 150.00,
                    "currentPrice": 264.58
                }
            ]
        }
        """.data(using: .utf8)!

        let portfolio = try JSONDecoder().decode(Portfolio.self, from: json)
        XCTAssertEqual(portfolio.totalValue, 15000.50)
        XCTAssertEqual(portfolio.dayChange, 125.30)
        XCTAssertEqual(portfolio.holdings.count, 1)
        XCTAssertEqual(portfolio.holdings[0].symbol, "AAPL")
    }

    func testHoldingComputedProperties() throws {
        let json = """
        {
            "symbol": "AAPL",
            "shares": 10,
            "avgCost": 150.00,
            "currentPrice": 200.00
        }
        """.data(using: .utf8)!

        let holding = try JSONDecoder().decode(Portfolio.Holding.self, from: json)
        XCTAssertEqual(holding.marketValue, 2000.00)
        XCTAssertEqual(holding.gainLoss, 500.00)
    }

    func testHoldingNegativeGainLoss() throws {
        let json = """
        {
            "symbol": "TSLA",
            "shares": 5,
            "avgCost": 300.00,
            "currentPrice": 250.00
        }
        """.data(using: .utf8)!

        let holding = try JSONDecoder().decode(Portfolio.Holding.self, from: json)
        XCTAssertEqual(holding.gainLoss, -250.00)
    }

    func testEmptyHoldings() throws {
        let json = """
        {
            "totalValue": 0,
            "dayChange": 0,
            "dayChangePercent": 0,
            "holdings": []
        }
        """.data(using: .utf8)!

        let portfolio = try JSONDecoder().decode(Portfolio.self, from: json)
        XCTAssertTrue(portfolio.holdings.isEmpty)
    }
}

final class UserModelTests: XCTestCase {

    func testUserDecodes() throws {
        let json = """
        {"email": "test@example.com", "tier": "pro"}
        """.data(using: .utf8)!

        let user = try JSONDecoder().decode(User.self, from: json)
        XCTAssertEqual(user.email, "test@example.com")
        XCTAssertEqual(user.tier, "pro")
    }

    func testUserDecodesWithNullTier() throws {
        let json = """
        {"email": "test@example.com", "tier": null}
        """.data(using: .utf8)!

        let user = try JSONDecoder().decode(User.self, from: json)
        XCTAssertEqual(user.email, "test@example.com")
        XCTAssertNil(user.tier)
    }

    func testUserDecodesWithMissingTier() throws {
        let json = """
        {"email": "test@example.com"}
        """.data(using: .utf8)!

        let user = try JSONDecoder().decode(User.self, from: json)
        XCTAssertNil(user.tier)
    }
}

final class PriceHistoryModelTests: XCTestCase {

    func testPriceHistoryDecodes() throws {
        let json = """
        {
            "history": [
                {"date": "2026-01-01", "close": 250.00, "volume": 10000000},
                {"date": "2026-01-02", "close": 252.50, "volume": 12000000}
            ]
        }
        """.data(using: .utf8)!

        let history = try JSONDecoder().decode(PriceHistory.self, from: json)
        XCTAssertEqual(history.history.count, 2)
        XCTAssertEqual(history.history[0].close, 250.00)
    }

    func testDataPointParsedDate() throws {
        let json = """
        {"date": "2026-02-15", "close": 100.0}
        """.data(using: .utf8)!

        let point = try JSONDecoder().decode(PriceHistory.DataPoint.self, from: json)
        XCTAssertNotNil(point.parsedDate)

        let calendar = Calendar.current
        let components = calendar.dateComponents([.year, .month, .day], from: point.parsedDate!)
        XCTAssertEqual(components.year, 2026)
        XCTAssertEqual(components.month, 2)
        XCTAssertEqual(components.day, 15)
    }

    func testDataPointWithoutVolume() throws {
        let json = """
        {"date": "2026-01-01", "close": 100.0}
        """.data(using: .utf8)!

        let point = try JSONDecoder().decode(PriceHistory.DataPoint.self, from: json)
        XCTAssertNil(point.volume)
    }

    func testEmptyHistory() throws {
        let json = """
        {"history": []}
        """.data(using: .utf8)!

        let history = try JSONDecoder().decode(PriceHistory.self, from: json)
        XCTAssertTrue(history.history.isEmpty)
    }
}

final class FinanceDataModelTests: XCTestCase {

    func testAccountTypeLabel() {
        let chequing = FinanceData.Account(name: "Main", type: "chequing", balance: 1000, currency: "CAD")
        XCTAssertEqual(chequing.typeLabel, "Chequing")

        let investment = FinanceData.Account(name: "TFSA", type: "investment", balance: 5000, currency: "CAD")
        XCTAssertEqual(investment.typeLabel, "Investment")

        let gift = FinanceData.Account(name: "Amazon", type: "gift", balance: 50, currency: "USD")
        XCTAssertEqual(gift.typeLabel, "Gift Card")

        let other = FinanceData.Account(name: "Savings", type: "savings", balance: 2000, currency: "CAD")
        XCTAssertEqual(other.typeLabel, "Savings")
    }

    func testBudgetLineMonthlyAmount() {
        let biweekly = FinanceData.Budget.BudgetLine(name: "Salary", amount: 2000, frequency: "biweekly", note: nil)
        XCTAssertEqual(biweekly.monthlyAmount, 2000 * 26 / 12, accuracy: 0.01)

        let weekly = FinanceData.Budget.BudgetLine(name: "Tips", amount: 100, frequency: "weekly", note: nil)
        XCTAssertEqual(weekly.monthlyAmount, 100 * 52 / 12, accuracy: 0.01)

        let yearly = FinanceData.Budget.BudgetLine(name: "Bonus", amount: 12000, frequency: "yearly", note: nil)
        XCTAssertEqual(yearly.monthlyAmount, 1000, accuracy: 0.01)

        let annual = FinanceData.Budget.BudgetLine(name: "Bonus", amount: 6000, frequency: "annual", note: nil)
        XCTAssertEqual(annual.monthlyAmount, 500, accuracy: 0.01)

        let monthly = FinanceData.Budget.BudgetLine(name: "Rent", amount: 1500, frequency: "monthly", note: nil)
        XCTAssertEqual(monthly.monthlyAmount, 1500)
    }

    func testBudgetTotals() {
        let budget = FinanceData.Budget(
            income: [
                FinanceData.Budget.BudgetLine(name: "Job", amount: 4000, frequency: "monthly", note: nil)
            ],
            expenses: [
                FinanceData.Budget.BudgetLine(name: "Rent", amount: 1500, frequency: "monthly", note: nil),
                FinanceData.Budget.BudgetLine(name: "Food", amount: 500, frequency: "monthly", note: nil)
            ]
        )

        XCTAssertEqual(budget.totalMonthlyIncome, 4000)
        XCTAssertEqual(budget.totalMonthlyExpenses, 2000)
        XCTAssertEqual(budget.monthlySurplus, 2000)
    }

    func testGoalProgress() {
        let halfDone = FinanceData.Goal(name: "Car", target: 10000, saved: 5000, priority: "high", deadline: nil, note: nil)
        XCTAssertEqual(halfDone.progress, 0.5, accuracy: 0.001)

        let overSaved = FinanceData.Goal(name: "Bike", target: 500, saved: 600, priority: "low", deadline: nil, note: nil)
        XCTAssertEqual(overSaved.progress, 1.0)

        let zeroTarget = FinanceData.Goal(name: "Free", target: 0, saved: 100, priority: "medium", deadline: nil, note: nil)
        XCTAssertEqual(zeroTarget.progress, 0)
    }

    func testGoalPriorityColor() {
        let high = FinanceData.Goal(name: "A", target: 100, saved: 0, priority: "high", deadline: nil, note: nil)
        XCTAssertEqual(high.priorityColor, "ff3b30")

        let medium = FinanceData.Goal(name: "B", target: 100, saved: 0, priority: "medium", deadline: nil, note: nil)
        XCTAssertEqual(medium.priorityColor, "f5a623")

        let low = FinanceData.Goal(name: "C", target: 100, saved: 0, priority: "low", deadline: nil, note: nil)
        XCTAssertEqual(low.priorityColor, "34c759")

        let unknown = FinanceData.Goal(name: "D", target: 100, saved: 0, priority: "unknown", deadline: nil, note: nil)
        XCTAssertEqual(unknown.priorityColor, "34c759")
    }

    func testFinanceDataDecodesEmptyResponse() throws {
        let json = """
        {"holdings": [], "accounts": [], "debt": [], "goals": [], "spending": []}
        """.data(using: .utf8)!

        let data = try JSONDecoder().decode(FinanceData.self, from: json)
        XCTAssertTrue(data.holdings.isEmpty)
        XCTAssertTrue(data.accounts.isEmpty)
        XCTAssertTrue(data.debt.isEmpty)
        XCTAssertTrue(data.goals.isEmpty)
        XCTAssertTrue(data.spending.isEmpty)
        XCTAssertNil(data.budget)
    }

    func testFinanceDataDecodesPartialResponse() throws {
        let json = """
        {
            "goals": [{"name": "Vacation", "target": 3000, "saved": 1200, "priority": "high"}]
        }
        """.data(using: .utf8)!

        let data = try JSONDecoder().decode(FinanceData.self, from: json)
        XCTAssertTrue(data.holdings.isEmpty)
        XCTAssertTrue(data.accounts.isEmpty)
        XCTAssertEqual(data.goals.count, 1)
        XCTAssertEqual(data.goals[0].name, "Vacation")
    }

    func testFinanceDataDecodesEmptyObject() throws {
        let json = "{}".data(using: .utf8)!

        let data = try JSONDecoder().decode(FinanceData.self, from: json)
        XCTAssertTrue(data.holdings.isEmpty)
        XCTAssertTrue(data.accounts.isEmpty)
        XCTAssertTrue(data.debt.isEmpty)
        XCTAssertTrue(data.goals.isEmpty)
        XCTAssertTrue(data.spending.isEmpty)
    }

    func testSpendingMonthSortedCategories() {
        let month = FinanceData.SpendingMonth(
            month: "Jan 2026",
            sortKey: "2026-01",
            total: 1500,
            categories: ["food": 800, "transport": 200, "rent": 500]
        )

        let sorted = month.sortedCategories
        XCTAssertEqual(sorted.count, 3)
        XCTAssertEqual(sorted[0].key, "food")
        XCTAssertEqual(sorted[0].value, 800)
        XCTAssertEqual(sorted[1].key, "rent")
        XCTAssertEqual(sorted[2].key, "transport")
    }
}

final class APIErrorTests: XCTestCase {

    func testErrorDescriptions() {
        XCTAssertEqual(APIError.invalidURL.errorDescription, "Invalid URL")
        XCTAssertEqual(APIError.unauthorized.errorDescription, "Not authenticated")
        XCTAssertEqual(APIError.httpError(404, "Not Found").errorDescription, "Not Found")
        XCTAssertEqual(APIError.decodingError("bad json").errorDescription, "Decode error: bad json")
        XCTAssertEqual(APIError.networkError("timeout").errorDescription, "Network error: timeout")
    }
}

final class SituationModelTests: XCTestCase {

    func testEarthquakeDecodesLossyPayload() throws {
        let json = """
        {
            "mag": "4.7",
            "lat": "49.28",
            "lon": -123.12,
            "place": "Vancouver Island",
            "time": "2026-03-11T18:30:00Z"
        }
        """.data(using: .utf8)!

        let quake = try JSONDecoder().decode(Earthquake.self, from: json)
        XCTAssertEqual(quake.title, "Vancouver Island")
        XCTAssertEqual(quake.magnitude, 4.7, accuracy: 0.001)
        XCTAssertEqual(quake.latitude, 49.28, accuracy: 0.001)
        XCTAssertEqual(quake.longitude, -123.12, accuracy: 0.001)
        XCTAssertEqual(quake.occurredAt, "2026-03-11T18:30:00Z")
    }

    func testFlightDecodesFallbackIdentifierAndAltitude() throws {
        let json = """
        {
            "icao24": "abc123",
            "callsign": "JBU204 ",
            "lat": "49.10",
            "lon": "-123.00",
            "altitude": "32000",
            "status": "en route"
        }
        """.data(using: .utf8)!

        let flight = try JSONDecoder().decode(Flight.self, from: json)
        XCTAssertEqual(flight.id, "abc123")
        XCTAssertEqual(flight.callsign, "JBU204 ")
        XCTAssertEqual(flight.latitude, 49.10, accuracy: 0.001)
        XCTAssertEqual(flight.longitude, -123.00, accuracy: 0.001)
        XCTAssertEqual(flight.altitudeFeet, 32000)
        XCTAssertEqual(flight.status, "en route")
    }

    func testIncidentDecodesFallbackFields() throws {
        let json = """
        {
            "type": "Road closure",
            "severity": 2,
            "lat": 49.25,
            "lon": -123.10,
            "description": "Construction blocking one lane",
            "reported_at": "2026-03-11T19:00:00Z"
        }
        """.data(using: .utf8)!

        let incident = try JSONDecoder().decode(Incident.self, from: json)
        XCTAssertEqual(incident.title, "Road Closure")
        XCTAssertEqual(incident.severity, "2.0")
        XCTAssertEqual(incident.summary, "Construction blocking one lane")
        XCTAssertEqual(incident.reportedAt, "2026-03-11T19:00:00Z")
    }

    func testWeatherAlertDecodesFallbackHeadlineAndExpiry() throws {
        let json = """
        {
            "event": "Wind Warning",
            "headline": "Strong gusts expected overnight",
            "expires": "2026-03-12T08:00:00Z"
        }
        """.data(using: .utf8)!

        let alert = try JSONDecoder().decode(WeatherAlert.self, from: json)
        XCTAssertEqual(alert.title, "Wind Warning")
        XCTAssertEqual(alert.summary, "Strong gusts expected overnight")
        XCTAssertEqual(alert.expiresAt, "2026-03-12T08:00:00Z")
    }
}

final class UserAvatarModelTests: XCTestCase {

    func testUserDecodesWithAvatarUrl() throws {
        let json = """
        {
            "id": "abc-123",
            "email": "test@example.com",
            "tier": "pro",
            "verified": true,
            "stripeCustomerId": null,
            "avatarUrl": "https://blob.vercel-storage.com/avatars/abc-123.jpg"
        }
        """.data(using: .utf8)!

        let user = try JSONDecoder().decode(User.self, from: json)
        XCTAssertEqual(user.id, "abc-123")
        XCTAssertEqual(user.email, "test@example.com")
        XCTAssertEqual(user.tier, "pro")
        XCTAssertEqual(user.avatarUrl, "https://blob.vercel-storage.com/avatars/abc-123.jpg")
    }

    func testUserDecodesWithoutAvatarUrl() throws {
        let json = """
        {
            "id": "abc-123",
            "email": "test@example.com",
            "tier": "free",
            "verified": false,
            "stripeCustomerId": null
        }
        """.data(using: .utf8)!

        let user = try JSONDecoder().decode(User.self, from: json)
        XCTAssertEqual(user.email, "test@example.com")
        XCTAssertNil(user.avatarUrl)
    }

    func testUserDecodesWithNullAvatarUrl() throws {
        let json = """
        {
            "id": "abc-123",
            "email": "test@example.com",
            "tier": "free",
            "verified": false,
            "stripeCustomerId": null,
            "avatarUrl": null
        }
        """.data(using: .utf8)!

        let user = try JSONDecoder().decode(User.self, from: json)
        XCTAssertNil(user.avatarUrl)
    }
}
