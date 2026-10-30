import AppIntents

/// "What's my portfolio worth": the total the Portfolio tab heads with, for Siri, Shortcuts and Spotlight.
/// Runs in the app's process, so it rides the same signed-in session cookie as everything else.
struct PortfolioValueIntent: AppIntent {
    static let title: LocalizedStringResource = "Portfolio Value"
    static let description = IntentDescription("Says what your Epiphany portfolio is worth right now.")

    enum Failure: Error, CustomLocalizedStringResourceConvertible {
        case signedOut
        var localizedStringResource: LocalizedStringResource { "Open Epiphany and sign in first." }
    }

    @MainActor
    func perform() async throws -> some IntentResult & ReturnsValue<Double> & ProvidesDialog {
        guard let finance = try? await EpiphanyAPI.shared.fetchFinanceData() else { throw Failure.signedOut }
        // ponytail: no live quotes here, so holdings without an account balance use their stored value.
        let value = Portfolio(financeData: finance, stocks: []).totalValue
        return .result(value: value, dialog: "Your portfolio is worth \(CurrencyFormatter.formatPrice(value)).")
    }
}

struct EpiphanyShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: PortfolioValueIntent(),
            phrases: ["What's my portfolio worth in \(.applicationName)",
                      "\(.applicationName) portfolio value",
                      "How much is my \(.applicationName) portfolio"],
            shortTitle: "Portfolio Value",
            systemImageName: "briefcase"
        )
    }
}
