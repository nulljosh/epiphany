import XCTest
@testable import EpiphanyMac

@MainActor
final class AppStateTests: XCTestCase {
    var appState: AppState!
    var mockAPI: MockEpiphanyAPI!

    override func setUp() {
        super.setUp()
        appState = AppState()
        mockAPI = MockEpiphanyAPI()
    }

    override func tearDown() {
        appState = nil
        mockAPI = nil
        UserDefaults.standard.removeObject(forKey: "epiphany_broker_linked")
        UserDefaults.standard.removeObject(forKey: "epiphany_broker_name")
        UserDefaults.standard.removeObject(forKey: "localFavorites")
        super.tearDown()
    }

    // MARK: - Authentication State Tests

    func testInitialAuthenticationState() {
        XCTAssertFalse(appState.isLoggedIn)
        XCTAssertNil(appState.user)
        XCTAssertFalse(appState.isAuthenticating)
        XCTAssertNil(appState.error)
    }

    func testLoginSuccessUpdatesUserState() async {
        let mockUser = User(
            id: "user-1",
            email: "test@example.com",
            name: "Test User",
            avatar: nil,
            verified: true,
            tier: "free",
            createdAt: Date()
        )
        mockAPI.mockLoginResult = mockUser

        await appState.login(email: "test@example.com", password: "password123")

        XCTAssertTrue(appState.isLoggedIn)
        XCTAssertEqual(appState.user?.email, "test@example.com")
        XCTAssertEqual(appState.user?.id, "user-1")
        XCTAssertFalse(appState.isAuthenticating)
        XCTAssertNil(appState.error)
    }

    func testLoginFailureSetsErrorMessage() async {
        mockAPI.mockLoginError = APIError.unauthorized

        await appState.login(email: "test@example.com", password: "wrong")

        XCTAssertFalse(appState.isLoggedIn)
        XCTAssertNil(appState.user)
        XCTAssertFalse(appState.isAuthenticating)
        XCTAssertNotNil(appState.error)
    }

    func testRegisterCreatesNewAccount() async {
        let mockUser = User(
            id: "user-2",
            email: "newuser@example.com",
            name: nil,
            avatar: nil,
            verified: false,
            tier: "free",
            createdAt: Date()
        )
        mockAPI.mockRegisterResult = mockUser

        await appState.register(email: "newuser@example.com", password: "newpass123")

        XCTAssertTrue(appState.isLoggedIn)
        XCTAssertEqual(appState.user?.email, "newuser@example.com")
        XCTAssertFalse(appState.user?.verified ?? true)
    }

    func testLogoutClearsAllData() async {
        appState.user = User(
            id: "user-1",
            email: "test@example.com",
            name: "Test",
            avatar: nil,
            verified: true,
            tier: "free",
            createdAt: Date()
        )
        appState.portfolio = Portfolio(netWorth: 10000, cashBalance: 5000)
        appState.watchlist = [WatchlistItem(id: "w1", symbol: "AAPL")]
        appState.stocks = [Stock(symbol: "AAPL", price: 150)]
        appState.error = "Some error"

        await appState.logout()

        XCTAssertFalse(appState.isLoggedIn)
        XCTAssertNil(appState.user)
        XCTAssertNil(appState.portfolio)
        XCTAssertTrue(appState.watchlist.isEmpty)
        XCTAssertTrue(appState.stocks.isEmpty)
        XCTAssertNil(appState.error)
    }

    // MARK: - Account Management Tests

    func testChangeEmailUpdatesUserState() async {
        let updatedUser = User(
            id: "user-1",
            email: "newemail@example.com",
            name: "Test User",
            avatar: nil,
            verified: true,
            tier: "free",
            createdAt: Date()
        )
        mockAPI.mockChangeEmailResult = updatedUser
        appState.user = User(
            id: "user-1",
            email: "old@example.com",
            name: "Test User",
            avatar: nil,
            verified: true,
            tier: "free",
            createdAt: Date()
        )

        let success = await appState.changeEmail(to: "newemail@example.com", password: "password123")

        XCTAssertTrue(success)
        XCTAssertEqual(appState.user?.email, "newemail@example.com")
        XCTAssertNil(appState.error)
    }

    func testChangeEmailFailureWithWrongPassword() async {
        mockAPI.mockChangeEmailError = APIError.unauthorized
        appState.user = User(
            id: "user-1",
            email: "test@example.com",
            name: "Test User",
            avatar: nil,
            verified: true,
            tier: "free",
            createdAt: Date()
        )

        let success = await appState.changeEmail(to: "new@example.com", password: "wrong")

        XCTAssertFalse(success)
        XCTAssertNotNil(appState.error)
    }

    func testChangePassword() async {
        mockAPI.mockChangePasswordSuccess = true
        appState.user = User(
            id: "user-1",
            email: "test@example.com",
            name: "Test User",
            avatar: nil,
            verified: true,
            tier: "free",
            createdAt: Date()
        )

        let success = await appState.changePassword(currentPassword: "oldpass", newPassword: "newpass")

        XCTAssertTrue(success)
        XCTAssertNil(appState.error)
    }

    func testChangeName() async {
        let updatedUser = User(
            id: "user-1",
            email: "test@example.com",
            name: "New Name",
            avatar: nil,
            verified: true,
            tier: "free",
            createdAt: Date()
        )
        mockAPI.mockChangeNameResult = updatedUser
        appState.user = User(
            id: "user-1",
            email: "test@example.com",
            name: "Old Name",
            avatar: nil,
            verified: true,
            tier: "free",
            createdAt: Date()
        )

        let success = await appState.changeName(name: "New Name")

        XCTAssertTrue(success)
        XCTAssertEqual(appState.user?.name, "New Name")
    }

    // MARK: - Watchlist Tests

    func testWatchlistSymbols() {
        appState.watchlist = [
            WatchlistItem(id: "w1", symbol: "AAPL"),
            WatchlistItem(id: "w2", symbol: "MSFT"),
        ]

        let symbols = appState.watchlistSymbols

        XCTAssertEqual(symbols.count, 2)
        XCTAssertTrue(symbols.contains("AAPL"))
        XCTAssertTrue(symbols.contains("MSFT"))
    }

    func testWatchlistStocks() {
        appState.stocks = [
            Stock(symbol: "AAPL", price: 150),
            Stock(symbol: "MSFT", price: 300),
            Stock(symbol: "GOOGL", price: 2000),
        ]
        appState.watchlist = [
            WatchlistItem(id: "w1", symbol: "AAPL"),
            WatchlistItem(id: "w2", symbol: "MSFT"),
        ]

        let watchlistStocks = appState.watchlistStocks

        XCTAssertEqual(watchlistStocks.count, 2)
        XCTAssertTrue(watchlistStocks.map(\.symbol).contains("AAPL"))
        XCTAssertTrue(watchlistStocks.map(\.symbol).contains("MSFT"))
        XCTAssertFalse(watchlistStocks.map(\.symbol).contains("GOOGL"))
    }

    func testNonWatchlistStocks() {
        appState.stocks = [
            Stock(symbol: "AAPL", price: 150),
            Stock(symbol: "MSFT", price: 300),
            Stock(symbol: "GOOGL", price: 2000),
        ]
        appState.watchlist = [
            WatchlistItem(id: "w1", symbol: "AAPL"),
        ]

        let nonWatchlist = appState.nonWatchlistStocks

        XCTAssertEqual(nonWatchlist.count, 2)
        XCTAssertTrue(nonWatchlist.map(\.symbol).contains("MSFT"))
        XCTAssertTrue(nonWatchlist.map(\.symbol).contains("GOOGL"))
        XCTAssertFalse(nonWatchlist.map(\.symbol).contains("AAPL"))
    }

    // MARK: - Local Favorites Tests

    func testToggleLocalFavorite() {
        appState.toggleLocalFavorite("Gold")
        XCTAssertTrue(appState.isLocalFavorite("Gold"))

        appState.toggleLocalFavorite("Gold")
        XCTAssertFalse(appState.isLocalFavorite("Gold"))
    }

    func testLocalFavoritePersistence() {
        appState.toggleLocalFavorite("Bitcoin")
        appState.toggleLocalFavorite("Ethereum")

        let favorites = UserDefaults.standard.stringArray(forKey: "localFavorites") ?? []
        XCTAssertEqual(Set(favorites), Set(["Bitcoin", "Ethereum"]))
    }

    // MARK: - Brokerage Selection Tests

    func testSaveBrokerageSelection() {
        appState.saveBrokerageSelection(linked: true, name: "Wealthsimple")

        XCTAssertTrue(appState.brokerLinked)
        XCTAssertEqual(appState.brokerName, "Wealthsimple")

        let linkedStored = UserDefaults.standard.bool(forKey: "epiphany_broker_linked")
        let nameStored = UserDefaults.standard.string(forKey: "epiphany_broker_name")
        XCTAssertTrue(linkedStored)
        XCTAssertEqual(nameStored, "Wealthsimple")
    }

    func testClearBrokerageSelection() {
        appState.saveBrokerageSelection(linked: true, name: "Questrade")
        appState.clearBrokerageSelection()

        XCTAssertFalse(appState.brokerLinked)
        XCTAssertEqual(appState.brokerName, "")
    }

    func testRestoreBrokerageSelection() {
        UserDefaults.standard.set(true, forKey: "epiphany_broker_linked")
        UserDefaults.standard.set("Wealthsimple", forKey: "epiphany_broker_name")

        appState.restoreBrokerageSelection()

        XCTAssertTrue(appState.brokerLinked)
        XCTAssertEqual(appState.brokerName, "Wealthsimple")
    }

    // MARK: - Error Handling Tests

    func testHandleUnauthorizedError() {
        appState.user = User(
            id: "user-1",
            email: "test@example.com",
            name: "Test",
            avatar: nil,
            verified: true,
            tier: "free",
            createdAt: Date()
        )

        appState.handleError(APIError.unauthorized)

        XCTAssertNil(appState.user)
        XCTAssertTrue(appState.showLogin)
        XCTAssertNil(appState.error)
    }

    func testHandleGenericError() {
        let customError = NSError(domain: "TestDomain", code: -1, userInfo: [NSLocalizedDescriptionKey: "Test error"])

        appState.handleError(customError)

        XCTAssertNotNil(appState.error)
        XCTAssertEqual(appState.error, "Test error")
    }

    // MARK: - Data Staleness Tests

    func testStockDataStalenessAfter5Minutes() {
        appState.stocksFetchedAt = Date(timeIntervalSinceNow: -400)
        XCTAssertTrue(appState.isStockDataStale)

        appState.stocksFetchedAt = Date(timeIntervalSinceNow: -100)
        XCTAssertFalse(appState.isStockDataStale)
    }

    func testNoStalenessIfNeverFetched() {
        appState.stocksFetchedAt = nil
        XCTAssertFalse(appState.isStockDataStale)
    }

    // MARK: - Alert Filtering Tests

    func testActiveAndTriggeredAlerts() {
        appState.alerts = [
            PriceAlert(id: "a1", symbol: "AAPL", price: 150, triggered: false),
            PriceAlert(id: "a2", symbol: "MSFT", price: 300, triggered: true),
            PriceAlert(id: "a3", symbol: "GOOGL", price: 2000, triggered: false),
        ]

        let active = appState.activeAlerts
        let triggered = appState.triggeredAlerts

        XCTAssertEqual(active.count, 2)
        XCTAssertEqual(triggered.count, 1)
        XCTAssertTrue(active.map(\.symbol).contains("AAPL"))
        XCTAssertTrue(triggered.map(\.symbol).contains("MSFT"))
    }
}

// MARK: - Mock API

class MockEpiphanyAPI {
    var mockLoginResult: User?
    var mockLoginError: APIError?
    var mockRegisterResult: User?
    var mockRegisterError: APIError?
    var mockChangeEmailResult: User?
    var mockChangeEmailError: APIError?
    var mockChangeNameResult: User?
    var mockChangeNameError: APIError?
    var mockChangePasswordSuccess: Bool = false
    var mockChangePasswordError: APIError?

    func login(email: String, password: String) async throws -> User {
        if let error = mockLoginError {
            throw error
        }
        guard let user = mockLoginResult else {
            throw APIError.unauthorized
        }
        return user
    }

    func register(email: String, password: String) async throws -> User {
        if let error = mockRegisterError {
            throw error
        }
        guard let user = mockRegisterResult else {
            throw APIError.serverError
        }
        return user
    }

    func changeEmail(newEmail: String, password: String) async throws -> User {
        if let error = mockChangeEmailError {
            throw error
        }
        guard let user = mockChangeEmailResult else {
            throw APIError.serverError
        }
        return user
    }

    func changeName(name: String) async throws -> User {
        if let error = mockChangeNameError {
            throw error
        }
        guard let user = mockChangeNameResult else {
            throw APIError.serverError
        }
        return user
    }

    func changePassword(currentPassword: String, newPassword: String) async throws {
        if let error = mockChangePasswordError {
            throw error
        }
        if !mockChangePasswordSuccess {
            throw APIError.unauthorized
        }
    }
}
