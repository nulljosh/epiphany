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

    private func update(_ call: @escaping () async throws -> [Statement]) {
        Task { if let updated = try? await call() { appState.statements = updated } }
    }
}
