import SwiftUI
import LocalAuthentication

@MainActor
@Observable
final class AppState {
    var authAPI: AuthAPI = EpiphanyAPI.shared
    let biometricAuth = BiometricAuthService()
    var user: User?
    var isLoggedIn: Bool { user != nil }
    var showLogin = false
    var stocks: [Stock] = []
    var portfolio: Portfolio?
    var watchlist: [WatchlistItem] = []
    var alerts: [PriceAlert] = []

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
    var stocksFetchedAt: Date?
    var portfolioFetchedAt: Date?
    var isStockDataStale: Bool {
        guard let t = stocksFetchedAt else { return false }
        return Date().timeIntervalSince(t) > 300
    }
    var dailyBrief: DailyBrief?
    var tallyPayment: TallyPaymentInfo?
    var tallyConnected: Bool = TallyService.loadCredentials() != nil
    var avatarImageData: Data?
    var sparklineCache: [String: [Double]] = [:]

    private static let avatarFileURL: URL = {
        FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("monica_avatar.jpg")
    }()

    private static let avatarTimestampKey = "epiphany_avatar_updated_at"

    func loadAvatar() {
        let storedTs = UserDefaults.standard.integer(forKey: Self.avatarTimestampKey)
        let currentTs = user?.avatarUpdatedAt ?? 0
        if storedTs == currentTs && currentTs > 0,
           let data = try? Data(contentsOf: Self.avatarFileURL),
           UIImage(data: data) != nil {
            avatarImageData = data
            return
        }
        guard let urlString = user?.avatarUrl else { return }
        let cacheBusted = urlString + "?v=\(currentTs)"
        guard let url = URL(string: cacheBusted) else { return }
        Task { @MainActor in
            guard let (data, _) = try? await URLSession.shared.data(from: url) else { return }
            if UIImage(data: data) != nil {
                avatarImageData = data
                try? data.write(to: Self.avatarFileURL)
                UserDefaults.standard.set(currentTs, forKey: Self.avatarTimestampKey)
            } else if let rasterized = await SVGRasterizer.rasterize(data),
                      let jpegData = rasterized.jpegData(compressionQuality: 0.85) {
                avatarImageData = jpegData
                try? jpegData.write(to: Self.avatarFileURL)
                UserDefaults.standard.set(currentTs, forKey: Self.avatarTimestampKey)
            }
        }
    }

    func saveAvatarData(_ data: Data) {
        avatarImageData = data
        try? data.write(to: Self.avatarFileURL)
        UserDefaults.standard.set(user?.avatarUpdatedAt ?? Int(Date().timeIntervalSince1970), forKey: Self.avatarTimestampKey)
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

    // MARK: - Local Favorites (commodities/crypto)

    private static let localFavoritesKey = "localFavorites"

    var localFavorites: Set<String> = {
        Set(UserDefaults.standard.stringArray(forKey: localFavoritesKey) ?? [])
    }()

    func isLocalFavorite(_ name: String) -> Bool {
        localFavorites.contains(name)
    }

    func toggleLocalFavorite(_ name: String) {
        if localFavorites.contains(name) {
            localFavorites.remove(name)
        } else {
            localFavorites.insert(name)
        }
        UserDefaults.standard.set(Array(localFavorites), forKey: Self.localFavoritesKey)
    }

    // MARK: - Brokerage Persistence

    private static let brokerLinkedKey = "epiphany_broker_linked"
    private static let brokerNameKey = "epiphany_broker_name"

    var brokerLinked: Bool = {
        UserDefaults.standard.bool(forKey: brokerLinkedKey)
    }()

    var brokerName: String = {
        UserDefaults.standard.string(forKey: brokerNameKey) ?? ""
    }()

    func saveBrokerageSelection(linked: Bool, name: String) {
        brokerLinked = linked
        brokerName = name
        UserDefaults.standard.set(linked, forKey: Self.brokerLinkedKey)
        UserDefaults.standard.set(name, forKey: Self.brokerNameKey)
    }

    func clearBrokerageSelection() {
        brokerLinked = false
        brokerName = ""
        UserDefaults.standard.removeObject(forKey: Self.brokerLinkedKey)
        UserDefaults.standard.removeObject(forKey: Self.brokerNameKey)
    }

    func restoreBrokerageSelection() {
        brokerLinked = UserDefaults.standard.bool(forKey: Self.brokerLinkedKey)
        brokerName = UserDefaults.standard.string(forKey: Self.brokerNameKey) ?? ""
    }

    var activeAlerts: [PriceAlert] {
        alerts.filter { !$0.triggered }
    }

    var triggeredAlerts: [PriceAlert] {
        alerts.filter(\.triggered)
    }

    // MARK: - Error Handling

    func handleError(_ error: Error) {
        if let apiError = error as? APIError {
            switch apiError {
            case .unauthorized:
                user = nil
                showLogin = true
                self.error = nil
                return
            case .decodingError:
                // Decode errors are non-actionable for users; log silently
                print("[AppState] decode error: \(error.localizedDescription)")
                return
            default:
                break
            }
        }
        self.error = error.localizedDescription
    }

    // MARK: - Auth

    #if DEBUG
    func autoLoginIfNeeded() {
        guard !isLoggedIn,
              let email = ProcessInfo.processInfo.environment["DEV_EMAIL"],
              let password = ProcessInfo.processInfo.environment["DEV_PASSWORD"]
        else { return }
        Task { await login(email: email, password: password) }
    }
    #endif

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
            user = try await authAPI.login(email: creds.email, password: creds.password)
            error = nil
        } catch {
            user = nil
        }
    }

    func login(email: String, password: String) async {
        await authenticate { try await authAPI.login(email: email, password: password) }
    }

    func register(email: String, password: String) async {
        await authenticate { try await authAPI.register(email: email, password: password) }
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

    private func authenticate(_ request: () async throws -> User) async {
        isAuthenticating = true
        error = nil
        do {
            user = try await request()
            showLogin = false
        } catch {
            self.error = error.localizedDescription
        }
        isAuthenticating = false
    }

    private func clearAllUserData() {
        user = nil
        portfolio = nil
        watchlist = []
        alerts = []
        stocks = []
        error = nil
        commodities = []
        crypto = []
        financeData = nil
        statements = []
        tallyPayment = nil
    }

    func logout() async {
        try? await EpiphanyAPI.shared.logout()
        biometricAuth.clearCredentials()
        clearAllUserData()
    }

    func changeEmail(to newEmail: String, password: String) async -> Bool {
        error = nil
        do {
            user = try await authAPI.changeEmail(newEmail: newEmail, password: password)
            biometricAuth.saveCredentials(email: newEmail, password: password)
            return true
        } catch {
            self.error = error.localizedDescription
            return false
        }
    }

    func changeName(name: String) async -> Bool {
        error = nil
        do {
            user = try await authAPI.changeName(name: name)
            return true
        } catch {
            self.error = error.localizedDescription
            return false
        }
    }

    func changePassword(currentPassword: String, newPassword: String) async -> Bool {
        error = nil
        do {
            try await authAPI.changePassword(currentPassword: currentPassword, newPassword: newPassword)
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
            clearAllUserData()
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
            print("[Portfolio] Loaded \(stocks.count) stocks, financeData exists: \(financeData != nil)")
            if let financeData {
                portfolio = Portfolio(financeData: financeData, stocks: stocks)
                print("[Portfolio] Rebuilt with \(stocks.count) stocks, holdings count: \(portfolio?.holdings.count ?? 0)")
            }
            if !stocks.isEmpty {
                error = nil
                stocksFetchedAt = .now
                Task { await preloadSparklines() }
            }
        } catch {
            handleError(error)
        }
    }

    func preloadSparklines() async {
        let symbols = stocks.map(\.symbol) + commodities.map(\.name) + crypto.map(\.symbol)
        for symbol in symbols {
            guard sparklineCache[symbol] == nil else { continue }
            Task {
                do {
                    let prices = try await EpiphanyAPI.shared.fetchSparklineData(symbol: symbol)
                    self.sparklineCache[symbol] = prices
                } catch {
                    self.sparklineCache[symbol] = []
                }
            }
        }
    }

    func loadCommodities(force: Bool = false) async {
        do {
            commodities = try await EpiphanyAPI.shared.fetchCommodities()
            if !commodities.isEmpty { Task { await preloadSparklines() } }
        } catch {
            handleError(error)
        }
    }

    func loadCrypto(force: Bool = false) async {
        do {
            crypto = try await EpiphanyAPI.shared.fetchCrypto()
            if !crypto.isEmpty { Task { await preloadSparklines() } }
        } catch {
            handleError(error)
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

    // MARK: - Tally

    var tallyError: String?

    func loadTallyData() async {
        guard let creds = TallyService.loadCredentials() else { return }
        do {
            let loggedIn = try await TallyService.login(username: creds.username, password: creds.password)
            guard loggedIn else {
                tallyError = "Tally credentials expired"
                return
            }
            tallyPayment = try await TallyService.fetchPaymentInfo()
            tallyError = nil
        } catch {
            tallyError = error.localizedDescription
        }
    }

    func connectTally(username: String, password: String) async -> String? {
        do {
            let success = try await TallyService.login(username: username, password: password)
            guard success else { return "Invalid credentials" }
            TallyService.saveCredentials(username: username, password: password)
            tallyConnected = true
            tallyPayment = try await TallyService.fetchPaymentInfo()
            tallyError = nil
            return nil
        } catch let err as URLError {
            return "Network error: \(err.localizedDescription)"
        } catch {
            return "Connection failed"
        }
    }

    func disconnectTally() {
        TallyService.clearCredentials()
        tallyPayment = nil
        tallyConnected = false
    }

    // MARK: - Portfolio

    func loadFinanceData() async {
        guard isLoggedIn else { financeDataLoaded = true; return }
        do {
            financeData = try await EpiphanyAPI.shared.fetchFinanceData()
            if let financeData {
                print("[Portfolio] Building from financeData with \(stocks.count) stocks loaded")
                portfolio = Portfolio(financeData: financeData, stocks: stocks)
            }
            financeDataLoaded = true
        } catch {
            financeDataLoaded = true
            handleError(error)
        }
        portfolioFetchedAt = .now
    }

    func saveFinanceData() async {
        guard let financeData else { return }
        do {
            try await EpiphanyAPI.shared.updateFinanceData(financeData)
        } catch {
            handleError(error)
        }
    }

    func deleteSpendingMonth(_ month: String) async {
        guard var data = financeData else { return }
        data.spending.removeAll { $0.month == month }
        financeData = data
        await saveFinanceData()
    }

    func loadDailyBrief() async {
        dailyBrief = try? await EpiphanyAPI.shared.fetchDailyBrief()
    }

    func loadStatements() async {
        guard isLoggedIn else { return }
        do {
            statements = try await EpiphanyAPI.shared.fetchStatements()
            let allTransactions = statements.flatMap(\.transactions)
            if !allTransactions.isEmpty {
                let spendingMonths = statements.compactMap(\.spendingMonth)
                let income = allTransactions.filter { $0.amount > 0 }.reduce(0) { $0 + $1.amount }
                let expenses = allTransactions.filter { $0.amount < 0 }.reduce(0) { $0 + abs($1.amount) }
                let monthCount = max(Double(Set(allTransactions.map { String($0.date.prefix(7)) }).count), 1)
                let avgMonthlyIncome = income / monthCount
                let avgMonthlyExpenses = expenses / monthCount

                let derivedBudget = FinanceData.Budget(
                    income: [FinanceData.Budget.BudgetLine(name: "Monthly Income", amount: avgMonthlyIncome, frequency: "monthly", note: nil)],
                    expenses: [FinanceData.Budget.BudgetLine(name: "Monthly Expenses", amount: avgMonthlyExpenses, frequency: "monthly", note: nil)]
                )

                if financeData != nil {
                    if financeData?.spending.isEmpty == true { financeData?.spending = spendingMonths }
                    if financeData?.budget == nil { financeData?.budget = derivedBudget }
                } else {
                    financeData = FinanceData(budget: derivedBudget, spending: spendingMonths)
                }
                if let financeData {
                    portfolio = Portfolio(financeData: financeData, stocks: stocks)
                }
            }
        } catch {
            handleError(error)
        }
    }

    // MARK: - Watchlist

    func loadWatchlist() async {
        guard isLoggedIn else { return }
        do {
            watchlist = try await EpiphanyAPI.shared.fetchWatchlist()
        } catch {
            handleError(error)
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
            handleError(apiError)
        } catch {
            handleError(error)
        }
    }

    func removeWatchlistSymbol(_ symbol: String) async {
        guard isLoggedIn else { return }
        do {
            try await EpiphanyAPI.shared.removeFromWatchlist(symbol: symbol)
            watchlist.removeAll { $0.symbol == symbol }
        } catch {
            handleError(error)
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
            handleError(error)
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
            handleError(error)
        }
    }

    func deleteAlert(_ id: String) async {
        guard isLoggedIn else { return }
        do {
            try await EpiphanyAPI.shared.deleteAlert(id: id)
            alerts.removeAll { $0.id == id }
        } catch {
            handleError(error)
        }
    }

    // MARK: - Refresh Operations (throwing for .refreshable)

    func refreshPortfolio() async throws {
        async let f: Void = _loadFinanceDataThrowing()
        async let s: Void = _loadStatementsThrowing()
        _ = try await (f, s)
    }

    func refreshMarkets() async throws {
        async let stocks: Void = _loadStocksThrowing(force: true)
        async let commodities: Void = _loadCommoditiesThrowing(force: true)
        async let crypto: Void = _loadCryptoThrowing(force: true)
        _ = try await (stocks, commodities, crypto)
    }

    private func _loadFinanceDataThrowing() async throws {
        guard isLoggedIn else { financeDataLoaded = true; return }
        financeData = try await EpiphanyAPI.shared.fetchFinanceData()
        if let financeData {
            portfolio = Portfolio(financeData: financeData, stocks: stocks)
        }
        financeDataLoaded = true
        portfolioFetchedAt = .now
    }

    private func _loadStatementsThrowing() async throws {
        guard isLoggedIn else { return }
        statements = try await EpiphanyAPI.shared.fetchStatements()
        let allTransactions = statements.flatMap(\.transactions)
        if !allTransactions.isEmpty {
            let spendingMonths = statements.compactMap(\.spendingMonth)
            let income = allTransactions.filter { $0.amount > 0 }.reduce(0) { $0 + $1.amount }
            let expenses = allTransactions.filter { $0.amount < 0 }.reduce(0) { $0 + abs($1.amount) }
            let monthCount = max(Double(Set(allTransactions.map { String($0.date.prefix(7)) }).count), 1)
            let avgMonthlyIncome = income / monthCount
            let avgMonthlyExpenses = expenses / monthCount

            let derivedBudget = FinanceData.Budget(
                income: [FinanceData.Budget.BudgetLine(name: "Monthly Income", amount: avgMonthlyIncome, frequency: "monthly", note: nil)],
                expenses: [FinanceData.Budget.BudgetLine(name: "Monthly Expenses", amount: avgMonthlyExpenses, frequency: "monthly", note: nil)]
            )

            if financeData != nil {
                if financeData?.spending.isEmpty == true { financeData?.spending = spendingMonths }
                if financeData?.budget == nil { financeData?.budget = derivedBudget }
            } else {
                financeData = FinanceData(budget: derivedBudget, spending: spendingMonths)
            }
            if let financeData {
                portfolio = Portfolio(financeData: financeData, stocks: stocks)
            }
        }
    }

    private func _loadStocksThrowing(force: Bool = false) async throws {
        if isLoading && !force { return }
        isLoading = true
        defer { isLoading = false }
        stocks = try await EpiphanyAPI.shared.fetchStocks()
        if let financeData {
            portfolio = Portfolio(financeData: financeData, stocks: stocks)
        }
        if !stocks.isEmpty { error = nil; stocksFetchedAt = .now }
    }

    private func _loadCommoditiesThrowing(force: Bool = false) async throws {
        commodities = try await EpiphanyAPI.shared.fetchCommodities()
    }

    private func _loadCryptoThrowing(force: Bool = false) async throws {
        crypto = try await EpiphanyAPI.shared.fetchCrypto()
    }

}
