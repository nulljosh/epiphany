// TODO: rewrite against current AppState API (loadPortfolio/markets removed)
#if false
import XCTest
@testable import Monica

@MainActor
final class AppStateTests: XCTestCase {

    // MARK: - Computed Properties

    func testIsLoggedIn() {
        let state = AppState()
        XCTAssertFalse(state.isLoggedIn)

        state.user = User(id: nil, email: "test@example.com", tier: nil, verified: nil, stripeCustomerId: nil, avatarUrl: nil, avatarUpdatedAt: nil)
        XCTAssertTrue(state.isLoggedIn)
    }

    func testWatchlistSymbols() {
        let state = AppState()
        XCTAssertTrue(state.watchlistSymbols.isEmpty)

        state.watchlist = [
            WatchlistItem(id: "1", userEmail: nil, symbol: "AAPL", addedAt: nil),
            WatchlistItem(id: "2", userEmail: nil, symbol: "NVDA", addedAt: nil),
        ]
        XCTAssertEqual(state.watchlistSymbols, Set(["AAPL", "NVDA"]))
    }

    func testWatchlistStocksFiltering() {
        let state = AppState()
        state.stocks = [
            Stock(symbol: "AAPL", name: "Apple", price: 264),
            Stock(symbol: "MSFT", name: "Microsoft", price: 397),
            Stock(symbol: "NVDA", name: "NVIDIA", price: 189),
        ]
        state.watchlist = [
            WatchlistItem(id: "1", userEmail: nil, symbol: "AAPL", addedAt: nil),
        ]

        XCTAssertEqual(state.watchlistStocks.count, 1)
        XCTAssertEqual(state.watchlistStocks[0].symbol, "AAPL")
        XCTAssertEqual(state.nonWatchlistStocks.count, 2)
    }

    func testIsInWatchlist() {
        let state = AppState()
        state.watchlist = [
            WatchlistItem(id: "1", userEmail: nil, symbol: "AAPL", addedAt: nil),
        ]

        XCTAssertTrue(state.isInWatchlist("AAPL"))
        XCTAssertFalse(state.isInWatchlist("MSFT"))
    }

    func testActiveAndTriggeredAlerts() {
        let state = AppState()
        state.alerts = [
            PriceAlert(id: "1", userEmail: nil, symbol: "AAPL", targetPrice: 250, direction: .above, triggered: false, createdAt: nil),
            PriceAlert(id: "2", userEmail: nil, symbol: "NVDA", targetPrice: 150, direction: .below, triggered: true, createdAt: nil),
            PriceAlert(id: "3", userEmail: nil, symbol: "MSFT", targetPrice: 400, direction: .above, triggered: false, createdAt: nil),
        ]

        XCTAssertEqual(state.activeAlerts.count, 2)
        XCTAssertEqual(state.triggeredAlerts.count, 1)
        XCTAssertEqual(state.triggeredAlerts[0].symbol, "NVDA")
    }

    // MARK: - Auth Guards

    func testLogoutClearsAllData() async {
        let state = AppState()
        state.user = User(id: nil, email: "test@example.com", tier: "pro", verified: nil, stripeCustomerId: nil, avatarUrl: nil, avatarUpdatedAt: nil)
        state.portfolio = Portfolio(totalValue: 10000, dayChange: 100, dayChangePercent: 1.0, holdings: [])
        state.watchlist = [WatchlistItem(id: "1", userEmail: nil, symbol: "AAPL", addedAt: nil)]
        state.alerts = [PriceAlert(id: "1", userEmail: nil, symbol: "AAPL", targetPrice: 250, direction: .above, triggered: false, createdAt: nil)]

        // Note: actual logout will fail network call in tests but state should still clear
        await state.logout()

        XCTAssertNil(state.user)
        XCTAssertNil(state.portfolio)
        XCTAssertTrue(state.watchlist.isEmpty)
        XCTAssertTrue(state.alerts.isEmpty)
        XCTAssertFalse(state.isLoggedIn)
    }

    func testLoadPortfolioGuardsAuth() async {
        let state = AppState()
        state.user = nil

        await state.loadPortfolio()
        XCTAssertNil(state.portfolio)
    }

    func testLoadWatchlistGuardsAuth() async {
        let state = AppState()
        state.user = nil

        await state.loadWatchlist()
        XCTAssertTrue(state.watchlist.isEmpty)
    }

    func testLoadAlertsGuardsAuth() async {
        let state = AppState()
        state.user = nil

        await state.loadAlerts()
        XCTAssertTrue(state.alerts.isEmpty)
    }

    func testAddWatchlistGuardsAuth() async {
        let state = AppState()
        state.user = nil

        await state.addWatchlistSymbol("AAPL")
        XCTAssertTrue(state.watchlist.isEmpty)
    }

    func testRemoveWatchlistGuardsAuth() async {
        let state = AppState()
        state.user = nil
        state.watchlist = [WatchlistItem(id: "1", userEmail: nil, symbol: "AAPL", addedAt: nil)]

        await state.removeWatchlistSymbol("AAPL")
        // Should not remove because not logged in (network call will fail)
        XCTAssertEqual(state.watchlist.count, 1)
    }

    func testCreateAlertGuardsAuth() async {
        let state = AppState()
        state.user = nil

        await state.createAlert(symbol: "AAPL", targetPrice: 250, direction: .above)
        XCTAssertTrue(state.alerts.isEmpty)
    }

    func testDeleteAlertGuardsAuth() async {
        let state = AppState()
        state.user = nil
        state.alerts = [PriceAlert(id: "1", userEmail: nil, symbol: "AAPL", targetPrice: 250, direction: .above, triggered: false, createdAt: nil)]

        await state.deleteAlert("1")
        XCTAssertEqual(state.alerts.count, 1)
    }

    // MARK: - Initial State

    func testInitialState() {
        let state = AppState()
        XCTAssertNil(state.user)
        XCTAssertFalse(state.isLoggedIn)
        XCTAssertFalse(state.showLogin)
        XCTAssertTrue(state.stocks.isEmpty)
        XCTAssertNil(state.portfolio)
        XCTAssertTrue(state.watchlist.isEmpty)
        XCTAssertTrue(state.alerts.isEmpty)
        XCTAssertTrue(state.markets.isEmpty)
        XCTAssertFalse(state.isLoading)
        XCTAssertNil(state.error)
    }
}
#endif
