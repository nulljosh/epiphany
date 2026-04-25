import SwiftUI
import LocalAuthentication

@MainActor
@Observable
final class AppState {
    let biometricAuth = BiometricAuthService()
    private let defaults = UserDefaults.standard
    var user: User?
    var isLoggedIn: Bool { user != nil }
    var showLogin = false
    var stocks: [Stock] = []
    var portfolio: Portfolio?
    var watchlist: [WatchlistItem] = []
    var alerts: [PriceAlert] = []
    var markets: [PredictionMarket] = []
    var commodities: [CommodityData] = []
    var crypto: [CryptoData] = []
    var fearGreedScore: Int?
    var fearGreedRating: String?
    var financeData: FinanceData?
    var statements: [Statement] = []
    var isLoading = false
    var isAuthenticating = false
    var error: String?
    var financeDataLoaded = false
    var dailyBrief: DailyBrief?
    var avatarImageData: Data?

    private static let avatarFileURL: URL = {
        FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("monica_avatar.jpg")
    }()

    func loadAvatar() {
        if let data = try? Data(contentsOf: Self.avatarFileURL) {
            avatarImageData = data
            return
        }
        guard let urlString = user?.avatarUrl else { return }
        let cacheBusted = urlString + "?v=\(user?.avatarUpdatedAt ?? 1)"
        guard let url = URL(string: cacheBusted) else { return }
        Task { @MainActor in
            if let (data, _) = try? await URLSession.shared.data(from: url) {
                avatarImageData = data
                try? data.write(to: Self.avatarFileURL)
            }
        }
    }

    func saveAvatarData(_ data: Data) {
        avatarImageData = data
        try? data.write(to: Self.avatarFileURL)
    }

    var situationEarthquakesEnabled: Bool {
        get { boolPreference(for: "settings.situation.earthquakes", default: true) }
        set { defaults.set(newValue, forKey: "settings.situation.earthquakes") }
    }

    var situationFlightsEnabled: Bool {
        get { boolPreference(for: "settings.situation.flights", default: true) }
        set { defaults.set(newValue, forKey: "settings.situation.flights") }
    }

    var situationIncidentsEnabled: Bool {
        get { boolPreference(for: "settings.situation.incidents", default: true) }
        set { defaults.set(newValue, forKey: "settings.situation.incidents") }
    }

    var situationWeatherEnabled: Bool {
        get { boolPreference(for: "settings.situation.weather", default: true) }
        set { defaults.set(newValue, forKey: "settings.situation.weather") }
    }

    var situationCrimeEnabled: Bool {
        get { boolPreference(for: "settings.situation.crime", default: true) }
        set { defaults.set(newValue, forKey: "settings.situation.crime") }
    }

    var situationLocalEventsEnabled: Bool {
        get { boolPreference(for: "settings.situation.localEvents", default: true) }
        set { defaults.set(newValue, forKey: "settings.situation.localEvents") }
    }

    var situationTrafficEnabled: Bool {
        get { boolPreference(for: "settings.situation.traffic", default: true) }
        set { defaults.set(newValue, forKey: "settings.situation.traffic") }
    }

    var situationWildfiresEnabled: Bool {
        get { boolPreference(for: "settings.situation.wildfires", default: true) }
        set { defaults.set(newValue, forKey: "settings.situation.wildfires") }
    }

    var savedCredentials: (email: String, password: String)? {
        biometricAuth.loadSavedCredentials()
    }

    var watchlistSymbols: Set<String> {
        Set(watchlist.map(\.symbol))
    }

    var watchlistStocks: [Stock] {
        stocks.filter { watchlistSymbols.contains($0.symbol) }
    }

    var nonWatchlistStocks: [Stock] {
        stocks.filter { !watchlistSymbols.contains($0.symbol) }
    }

    var activeAlerts: [PriceAlert] {
        alerts.filter { !$0.triggered }
    }

    var triggeredAlerts: [PriceAlert] {
        alerts.filter(\.triggered)
    }

    // MARK: - Auth

    func checkSession() async {
        do {
            user = try await EpiphanyAPI.shared.me()
        } catch {
            user = nil
        }
    }

    func restoreAuthentication() async {
        await checkSession()
        guard user == nil, let creds = biometricAuth.loadSavedCredentials() else { return }

        isAuthenticating = true
        defer { isAuthenticating = false }

        do {
            user = try await EpiphanyAPI.shared.login(email: creds.email, password: creds.password)
            error = nil
        } catch {
            user = nil
        }
    }

    func login(email: String, password: String) async {
        await authenticate(email: email, password: password) {
            try await EpiphanyAPI.shared.login(email: email, password: password)
        }
    }

    func register(email: String, password: String) async {
        await authenticate(email: email, password: password) {
            try await EpiphanyAPI.shared.register(email: email, password: password)
        }
    }

    func saveBiometricCredentials(email: String, password: String) {
        biometricAuth.saveCredentials(email: email, password: password)
    }

    func biometricBiometryType() -> LABiometryType {
        biometricAuth.availableBiometryType()
    }

    func hasSavedBiometricCredentials() -> Bool {
        biometricAuth.hasSavedCredentials()
    }

    func biometricLogin() async {
        error = nil
        do {
            try await biometricAuth.authenticate(localizedReason: "Sign in to Epiphany")
            guard let creds = biometricAuth.loadSavedCredentials() else {
                error = "No saved credentials found"
                return
            }
            await login(email: creds.email, password: creds.password)
        } catch {
            self.error = error.localizedDescription
        }
    }

    private func authenticate(
        email: String,
        password: String,
        _ request: () async throws -> User
    ) async {
        isAuthenticating = true
        error = nil
        do {
            user = try await request()
            biometricAuth.saveCredentials(email: email, password: password)
            showLogin = false
        } catch {
            self.error = error.localizedDescription
        }
        isAuthenticating = false
    }

    func logout() async {
        try? await EpiphanyAPI.shared.logout()
        user = nil
        portfolio = nil
        watchlist = []
        alerts = []
        stocks = []
        error = nil
        markets = []
        commodities = []
        crypto = []
        financeData = nil
        statements = []
    }

    func changeEmail(to newEmail: String, password: String) async -> Bool {
        error = nil
        do {
            user = try await EpiphanyAPI.shared.changeEmail(newEmail: newEmail, password: password)
            biometricAuth.saveCredentials(email: newEmail, password: password)
            return true
        } catch {
            self.error = error.localizedDescription
            return false
        }
    }

    func changePassword(currentPassword: String, newPassword: String) async -> Bool {
        error = nil
        do {
            try await EpiphanyAPI.shared.changePassword(currentPassword: currentPassword, newPassword: newPassword)
            if let email = user?.email {
                biometricAuth.saveCredentials(email: email, password: newPassword)
            }
            return true
        } catch {
            self.error = error.localizedDescription
            return false
        }
    }

    func deleteAccount(password: String) async -> Bool {
        error = nil
        do {
            try await EpiphanyAPI.shared.deleteAccount(password: password)
            biometricAuth.clearCredentials()
            user = nil
            portfolio = nil
            watchlist = []
            alerts = []
            financeData = nil
            statements = []
            return true
        } catch {
            self.error = error.localizedDescription
            return false
        }
    }

    // MARK: - Stocks

    func loadStocks(force: Bool = false) async {
        if isLoading && !force { return }
        isLoading = true
        defer { isLoading = false }
        do {
            stocks = try await EpiphanyAPI.shared.fetchStocks()
            if let financeData {
                portfolio = Portfolio(financeData: financeData, stocks: stocks)
            }
            if !stocks.isEmpty { error = nil }
        } catch {
            self.error = error.localizedDescription
        }
    }

    func loadCommodities(force: Bool = false) async {
        do {
            commodities = try await EpiphanyAPI.shared.fetchCommodities()
        } catch {
            self.error = error.localizedDescription
        }
    }

    func loadCrypto(force: Bool = false) async {
        do {
            crypto = try await EpiphanyAPI.shared.fetchCrypto()
        } catch {
            self.error = error.localizedDescription
        }
    }

    func loadFearGreed() async {
        do {
            let fg = try await EpiphanyAPI.shared.fetchFearGreed()
            fearGreedScore = fg.score
            fearGreedRating = fg.rating
        } catch {
            // Non-critical, silently fail
        }
    }

    // MARK: - Portfolio

    func loadPortfolio() async {
        guard isLoggedIn else { return }
        if let financeData {
            portfolio = Portfolio(financeData: financeData, stocks: stocks)
        }
    }

    func loadFinanceData() async {
        guard isLoggedIn else { financeDataLoaded = true; return }
        do {
            financeData = try await EpiphanyAPI.shared.fetchFinanceData()
            if let financeData {
                portfolio = Portfolio(financeData: financeData, stocks: stocks)
            }
        } catch {
            // Don't surface portfolio errors to user
        }
        financeDataLoaded = true
    }

    func saveFinanceData() async {
        guard let financeData else { return }
        do {
            try await EpiphanyAPI.shared.updateFinanceData(financeData)
        } catch {
            print("[AppState] Failed to save finance data: \(error)")
        }
    }

    func loadDailyBrief() async {
        dailyBrief = try? await EpiphanyAPI.shared.fetchDailyBrief()
    }

    func loadStatements() async {
        guard isLoggedIn else { return }
        do {
            statements = try await EpiphanyAPI.shared.fetchStatements()
        } catch {
            self.error = error.localizedDescription
        }
    }

    // MARK: - Watchlist

    func loadWatchlist() async {
        guard isLoggedIn else { return }
        do {
            watchlist = try await EpiphanyAPI.shared.fetchWatchlist()
        } catch {
            self.error = error.localizedDescription
        }
    }

    func addWatchlistSymbol(_ symbol: String) async {
        guard isLoggedIn else { return }
        do {
            let item = try await EpiphanyAPI.shared.addToWatchlist(symbol: symbol)
            watchlist.append(item)
        } catch let apiError as APIError {
            if case .httpError(409, _) = apiError {
                return // already in watchlist
            }
            self.error = apiError.localizedDescription
        } catch {
            self.error = error.localizedDescription
        }
    }

    func removeWatchlistSymbol(_ symbol: String) async {
        guard isLoggedIn else { return }
        do {
            try await EpiphanyAPI.shared.removeFromWatchlist(symbol: symbol)
            watchlist.removeAll { $0.symbol == symbol }
        } catch {
            self.error = error.localizedDescription
        }
    }

    func isInWatchlist(_ symbol: String) -> Bool {
        watchlistSymbols.contains(symbol)
    }

    // MARK: - Alerts

    func loadAlerts() async {
        guard isLoggedIn else { return }
        do {
            alerts = try await EpiphanyAPI.shared.fetchAlerts()
        } catch {
            self.error = error.localizedDescription
        }
    }

    func createAlert(symbol: String, targetPrice: Double, direction: PriceAlert.Direction) async {
        guard isLoggedIn else { return }
        do {
            let alert = try await EpiphanyAPI.shared.createAlert(
                symbol: symbol,
                targetPrice: targetPrice,
                direction: direction
            )
            alerts.append(alert)
        } catch {
            self.error = error.localizedDescription
        }
    }

    func deleteAlert(_ id: String) async {
        guard isLoggedIn else { return }
        do {
            try await EpiphanyAPI.shared.deleteAlert(id: id)
            alerts.removeAll { $0.id == id }
        } catch {
            self.error = error.localizedDescription
        }
    }

    // MARK: - Prediction Markets

    func loadMarkets() async {
        do {
            markets = try await EpiphanyAPI.shared.fetchMarkets()
        } catch {
            self.error = error.localizedDescription
        }
    }

    private func boolPreference(for key: String, default defaultValue: Bool) -> Bool {
        if defaults.object(forKey: key) == nil {
            return defaultValue
        }
        return defaults.bool(forKey: key)
    }
}
