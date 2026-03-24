import Testing
@testable import Opticon

@Suite(.serialized) struct AppStateTests {
    @Test @MainActor func watchlistStocksFiltering() {
        let state = AppState()
        state.stocks = [
            Stock(symbol: "AAPL", name: "Apple", price: 180),
            Stock(symbol: "GOOGL", name: "Alphabet", price: 140),
            Stock(symbol: "MSFT", name: "Microsoft", price: 420)
        ]
        state.watchlist = [
            WatchlistItem(id: "w1", userEmail: nil, symbol: "AAPL", addedAt: nil),
            WatchlistItem(id: "w2", userEmail: nil, symbol: "MSFT", addedAt: nil)
        ]

        #expect(state.watchlistStocks.count == 2)
        #expect(state.watchlistStocks.map(\.symbol).sorted() == ["AAPL", "MSFT"])
        #expect(state.nonWatchlistStocks.count == 1)
        #expect(state.nonWatchlistStocks.first?.symbol == "GOOGL")
    }

    @Test @MainActor func activeAndTriggeredAlerts() {
        let state = AppState()
        state.alerts = [
            PriceAlert(id: "1", userEmail: nil, symbol: "AAPL", targetPrice: 200, direction: .above, triggered: false, createdAt: nil),
            PriceAlert(id: "2", userEmail: nil, symbol: "GOOGL", targetPrice: 100, direction: .below, triggered: true, createdAt: nil),
            PriceAlert(id: "3", userEmail: nil, symbol: "MSFT", targetPrice: 450, direction: .above, triggered: false, createdAt: nil)
        ]

        #expect(state.activeAlerts.count == 2)
        #expect(state.triggeredAlerts.count == 1)
        #expect(state.triggeredAlerts.first?.symbol == "GOOGL")
    }

    @Test @MainActor func isInWatchlist() {
        let state = AppState()
        state.watchlist = [WatchlistItem(id: "w1", userEmail: nil, symbol: "AAPL", addedAt: nil)]

        #expect(state.isInWatchlist("AAPL") == true)
        #expect(state.isInWatchlist("GOOGL") == false)
    }

    @Test @MainActor func loggedOutByDefault() {
        let state = AppState()
        #expect(state.isLoggedIn == false)
        #expect(state.user == nil)
    }
}
