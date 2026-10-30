import SwiftUI

/// Accounts with money in them, grouped by type with a total each: cash first, then chequing, investment, the rest.
/// Mirrors groupAccounts in allocation.js. Totals add balances as net worth does.
enum AccountGroups {
    struct Group: Identifiable { let type: String; let total: Double; let accounts: [FinanceData.Account]; var id: String { type } }
    private static let order = ["cash", "chequing", "investment"]

    static func groups(_ accounts: [FinanceData.Account]) -> [Group] {
        let byType = Dictionary(grouping: accounts.filter { $0.balance >= 1 }) { $0.type ?? "other" }
        let rank = { (t: String) in order.firstIndex(of: t) ?? order.count }
        return byType.keys.sorted { (rank($0), $0) < (rank($1), $1) }
            .map { Group(type: $0, total: byType[$0]!.reduce(0) { $0 + $1.balance }, accounts: byType[$0]!) }
    }
}

/// "Accounts" with a header and total per type.
struct AccountGroupsList: View {
    let accounts: [FinanceData.Account]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            ForEach(AccountGroups.groups(accounts)) { group in
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Text(group.accounts.first?.typeLabel ?? group.type.capitalized)
                        Spacer()
                        Text(CurrencyFormatter.formatPrice(group.total)).monospacedDigit()
                    }
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                    ForEach(group.accounts) { account in
                        HStack {
                            Text(account.displayName).font(.callout.weight(.semibold))
                            Spacer(minLength: 12)
                            Text(CurrencyFormatter.formatPrice(account.balance)).font(.callout.weight(.semibold)).monospacedDigit()
                        }
                    }
                }
            }
        }
    }
}
