import SwiftUI

/// Statement rows nothing could categorize. Picking a category teaches that merchant for every statement
/// (the server learns a rule); "Mark all reviewed" waves the rest through. Hidden when the queue is empty.
struct ReviewQueueCard: View {
    @Environment(AppState.self) private var appState

    static let categories = ["food", "groceries", "coffee", "pharmacy", "shopping", "tech", "apps", "transit", "gas",
                             "pets", "fitness", "entertainment", "auto", "services", "transfers", "alcohol", "cannabis",
                             "housing", "utilities", "health", "insurance", "subscriptions", "other"]

    var body: some View {
        let queue = appState.statements.flatMap { s in s.transactions.filter(\.needsReview).map { (s, $0) } }
        if !queue.isEmpty {
            VStack(alignment: .leading, spacing: 0) {
                HStack {
                    Text("\(queue.count) to review").font(.headline)
                    Spacer()
                    Button("Mark all reviewed") { update { try await EpiphanyAPI.shared.markStatementsReviewed() } }
                        .buttonStyle(.borderless)
                        .font(.subheadline)
                }
                .padding(.bottom, 8)
                ForEach(queue.prefix(5), id: \.1.id) { statement, txn in
                    Divider()
                    HStack(spacing: 8) {
                        Text(txn.description).font(.subheadline).lineLimit(1)
                        Spacer(minLength: 8)
                        Text(CurrencyFormatter.formatPrice(abs(txn.amount)))
                            .font(.subheadline.monospacedDigit())
                            .foregroundStyle(.secondary)
                        ForEach(Self.suggestions(for: txn, in: appState.statements.flatMap(\.transactions)), id: \.self) { category in
                            Button(category.capitalized) {
                                update { try await EpiphanyAPI.shared.editStatementTransaction(id: statement.id, transactionId: txn.id, category: category) }
                            }
                            .buttonStyle(.bordered)
                            .controlSize(.small)
                        }
                        Menu("Category") {
                            ForEach(Self.categories, id: \.self) { category in
                                Button(category.capitalized) {
                                    update { try await EpiphanyAPI.shared.editStatementTransaction(id: statement.id, transactionId: txn.id, category: category) }
                                }
                            }
                        }
                        .fixedSize()
                    }
                    .padding(.vertical, 8)
                }
                Text("A category you pick applies to that merchant in every statement.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .padding(.top, 4)
            }
            .padding(16)
            .background(Color.primary.opacity(0.04), in: RoundedRectangle(cornerRadius: 12))
        }
    }

    /// Two categories for a row nothing could categorize: what rows with a shared merchant word use most, topped up
    /// with the most used overall. Mirrors suggestCategories in src/utils/reviewSuggest.js.
    static func suggestions(for txn: Transaction, in all: [Transaction]) -> [String] {
        let noise: Set<String> = ["the", "and", "inc", "ltd", "pos", "purchase", "visa", "debit", "credit", "www", "com", "card", "payment", "store"]
        func words(_ s: String) -> Set<String> {
            let parts: [Substring] = s.lowercased().split(whereSeparator: { (c: Character) -> Bool in !(c.isASCII && c.isLetter) })
            var out = Set<String>()
            for p in parts where p.count >= 3 && !noise.contains(String(p)) { out.insert(String(p)) }
            return out
        }
        func ranked(_ cats: [String]) -> [String] {
            var counts: [String: Int] = [:]
            for c in cats { counts[c, default: 0] += 1 }
            let pairs: [(String, Int)] = counts.map { ($0.key, $0.value) }
            return pairs.sorted { a, b in a.1 != b.1 ? a.1 > b.1 : a.0 < b.0 }.map { $0.0 }
        }
        let known = all.compactMap { t -> (Set<String>, String)? in
            guard let c = t.category, !c.isEmpty, c != "uncategorized" else { return nil }
            return (words(t.description), c)
        }
        let mine = words(txn.description)
        var out = Array(ranked(known.filter { !$0.0.isDisjoint(with: mine) }.map(\.1)).prefix(2))
        for c in ranked(known.map(\.1)) where out.count < 2 && !out.contains(c) { out.append(c) }
        return out
    }

    private func update(_ call: @escaping () async throws -> [Statement]) {
        Task { if let updated = try? await call() { appState.statements = updated } }
    }
}
