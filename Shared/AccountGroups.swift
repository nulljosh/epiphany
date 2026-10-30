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

/// "Accounts" with a header and total per type. Tap an account to see what's in it: holdings and uninvested cash.
struct AccountGroupsList: View {
    let accounts: [FinanceData.Account]
    var holdings: [FinanceData.Holding] = []
    var stocks: [Stock] = []
    @State private var open: String?

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
                        let inside = holdings.filter { $0.account == account.name && $0.shares > 0 }
                        let canOpen = !inside.isEmpty || account.cash != nil
                        Button {
                            if canOpen { withAnimation(.snappy) { open = open == account.name ? nil : account.name } }
                        } label: {
                            HStack {
                                if canOpen {
                                    Image(systemName: "chevron.right").font(.caption2.weight(.bold)).foregroundStyle(.secondary)
                                        .rotationEffect(.degrees(open == account.name ? 90 : 0))
                                }
                                Text(account.displayName).font(.callout.weight(.semibold))
                                Spacer(minLength: 12)
                                Text(CurrencyFormatter.formatPrice(account.balance)).font(.callout.weight(.semibold)).monospacedDigit()
                            }
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .accessibilityHint(canOpen ? "Shows what's in this account" : "")
                        if open == account.name {
                            VStack(alignment: .leading, spacing: 4) {
                                ForEach(inside, id: \.symbol) { h in
                                    let price = stocks.first { $0.symbol == h.symbol }?.price ?? (h.marketValue.map { $0 / h.shares } ?? 0)
                                    HStack {
                                        Text("\(h.symbol) · \(h.shares.formatted(.number.precision(.fractionLength(0...6)))) shares")
                                        Spacer()
                                        Text(CurrencyFormatter.formatPrice(price * h.shares)).monospacedDigit()
                                    }
                                }
                                if let cash = account.cash {
                                    HStack { Text("Cash"); Spacer(); Text(CurrencyFormatter.formatPrice(cash)).monospacedDigit() }
                                }
                            }
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                            .padding(.leading, 18)
                        }
                    }
                }
            }
        }
    }
}
