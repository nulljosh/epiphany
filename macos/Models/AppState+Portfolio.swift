import SwiftUI
import WidgetKit

extension AppState {
    /// Opening the app only reads the server's last broker snapshot, so ask for a new one once the
    /// screen has numbers. The server caches 25 minutes; reload only when it really fetched.
    func refreshBrokerSnapshot() async {
        guard financeData?.brokerStatus != nil,
              let sync = try? await EpiphanyAPI.shared.syncBroker(), sync.linked == true, sync.cached != true,
              let fresh = try? await EpiphanyAPI.shared.fetchFinanceData() else { return }
        financeData = fresh
        portfolio = Portfolio(financeData: fresh, stocks: stocks)
    }

    /// Widgets cannot use the app's session, so hand them the two budget numbers via the App Group.
    func publishBudgetSnapshot() {
        guard let defaults = UserDefaults(suiteName: "group.com.heyitsmejosh.epiphany") else { return }
        let income = financeData?.budget?.totalMonthlyIncome ?? 0
        let latest = statements.compactMap(\.spendingMonth).max { $0.sortKey < $1.sortKey }
        defaults.set(["income": income, "spent": latest?.total ?? 0, "month": latest?.month ?? ""], forKey: "widget_budget")
        WidgetCenter.shared.reloadTimelines(ofKind: "BudgetWidget")
    }
}
