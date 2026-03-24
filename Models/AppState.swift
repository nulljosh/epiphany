import SwiftUI
import LocalAuthentication

@MainActor
@Observable
final class AppState {
    let biometricAuth = BiometricAuthService()
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
    var financeData: FinanceData?
    var statements: [Statement] = []
    var isLoading = false
    var isAuthenticating = false
    var error: String?
    var tallyPayment: TallyPaymentInfo?
    var tallyConnected: Bool = TallyService.loadCredentials() != nil

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

    var activeAlerts: [PriceAlert] {
        alerts.filter { !$0.triggered }
    }

    var triggeredAlerts: [PriceAlert] {
        alerts.filter(\.triggered)
    }

    // MARK: - Error Handling

    func handleError(_ error: Error) {
        if let apiError = error as? APIError, case .unauthorized = apiError {
            user = nil
            showLogin = true
            self.error = nil
            return
        }
        self.error = error.localizedDescription
    }

    // MARK: - Auth

    func checkSession() async {
        do {
            user = try await OpticonAPI.shared.me()
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
            user = try await OpticonAPI.shared.login(email: creds.email, password: creds.password)
            error = nil
        } catch {
            user = nil
        }
    }

    func login(email: String, password: String) async {
        await authenticate { try await OpticonAPI.shared.login(email: email, password: password) }
    }

    func register(email: String, password: String) async {
        await authenticate { try await OpticonAPI.shared.register(email: email, password: password) }
    }

    func signInWithApple(identityToken: String, email: String?, fullName: String?) async {
        await authenticate { try await OpticonAPI.shared.signInWithApple(identityToken: identityToken, email: email, fullName: fullName) }
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
            try await biometricAuth.authenticate(localizedReason: "Sign in to Opticon")
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

    func logout() async {
        try? await OpticonAPI.shared.logout()
        biometricAuth.clearCredentials()
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
            user = try await OpticonAPI.shared.changeEmail(newEmail: newEmail, password: password)
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
            try await OpticonAPI.shared.changePassword(currentPassword: currentPassword, newPassword: newPassword)
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
            try await OpticonAPI.shared.deleteAccount(password: password)
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
            stocks = try await OpticonAPI.shared.fetchStocks()
            if let financeData {
                portfolio = Portfolio(financeData: financeData, stocks: stocks)
            }
            if !stocks.isEmpty { error = nil }
        } catch {
            handleError(error)
        }
    }

    func loadCommodities(force: Bool = false) async {
        do {
            commodities = try await OpticonAPI.shared.fetchCommodities()
        } catch {
            handleError(error)
        }
    }

    func loadCrypto(force: Bool = false) async {
        do {
            crypto = try await OpticonAPI.shared.fetchCrypto()
        } catch {
            handleError(error)
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
            tallyError = "Could not reach Tally"
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

    func loadPortfolio() async {
        guard isLoggedIn else { return }
        if let financeData {
            portfolio = Portfolio(financeData: financeData, stocks: stocks)
        }
    }

    func loadFinanceData() async {
        guard isLoggedIn else { return }
        do {
            financeData = try await OpticonAPI.shared.fetchFinanceData()
            if let financeData {
                portfolio = Portfolio(financeData: financeData, stocks: stocks)
            }
        } catch {
            handleError(error)
        }
    }

    func saveFinanceData() async {
        guard let financeData else { return }
        do {
            try await OpticonAPI.shared.updateFinanceData(financeData)
        } catch {
            print("[AppState] Failed to save finance data: \(error)")
        }
    }

    func deleteSpendingMonth(_ month: String) async {
        guard var data = financeData else { return }
        data.spending.removeAll { $0.month == month }
        financeData = data
        await saveFinanceData()
    }

    func loadStatements() async {
        guard isLoggedIn else { return }
        do {
            statements = try await OpticonAPI.shared.fetchStatements()
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
            watchlist = try await OpticonAPI.shared.fetchWatchlist()
        } catch {
            handleError(error)
        }
    }

    func addWatchlistSymbol(_ symbol: String) async {
        guard isLoggedIn else { return }
        do {
            let item = try await OpticonAPI.shared.addToWatchlist(symbol: symbol)
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
            try await OpticonAPI.shared.removeFromWatchlist(symbol: symbol)
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
            alerts = try await OpticonAPI.shared.fetchAlerts()
        } catch {
            handleError(error)
        }
    }

    func createAlert(symbol: String, targetPrice: Double, direction: PriceAlert.Direction) async {
        guard isLoggedIn else { return }
        do {
            let alert = try await OpticonAPI.shared.createAlert(
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
            try await OpticonAPI.shared.deleteAlert(id: id)
            alerts.removeAll { $0.id == id }
        } catch {
            handleError(error)
        }
    }

    // MARK: - Prediction Markets

    func loadMarkets() async {
        do {
            markets = try await OpticonAPI.shared.fetchMarkets()
        } catch {
            handleError(error)
        }
    }
}
