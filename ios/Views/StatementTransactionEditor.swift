import Charts
import SwiftUI

private let editableCategories = [
    "food", "groceries", "coffee", "pharmacy", "shopping", "tech", "apps",
    "transit", "gas", "pets", "laundry",
    "fitness", "entertainment", "auto", "services", "transfers", "vape",
    "alcohol", "cannabis", "housing", "utilities", "health", "insurance",
    "subscriptions", "other", "uncategorized",
].sorted()

struct StatementTransactionsView: View {
    let statement: Statement
    var onUpdate: ([Statement]) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var transactions: [Transaction]
    @State private var editingTransaction: Transaction?
    @State private var isSaving = false
    @State private var error: String?

    init(statement: Statement, onUpdate: @escaping ([Statement]) -> Void) {
        self.statement = statement
        self.onUpdate = onUpdate
        _transactions = State(initialValue: statement.transactions)
    }

    var body: some View {
        NavigationStack {
            List(transactions) { txn in
                Button {
                    editingTransaction = txn
                } label: {
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(txn.description)
                                .font(.body)
                                .foregroundStyle(.primary)
                                .lineLimit(1)
                            Text(txn.category ?? "uncategorized")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        Spacer()
                        Text(txn.amount, format: .currency(code: Locale.current.currency?.identifier ?? "USD"))
                            .font(.body.weight(.medium))
                            .monospacedDigit()
                            .foregroundStyle(.primary)
                    }
                }
            }
            .navigationTitle(statement.spendingMonth?.month ?? "Transactions")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Done") { dismiss() }
                }
            }
            .overlay {
                if isSaving {
                    ProgressView()
                }
            }
            .alert("Error", isPresented: .constant(error != nil), actions: {
                Button("OK") { error = nil }
            }, message: {
                if let error { Text(error) }
            })
            .sheet(item: $editingTransaction) { txn in
                NavigationStack {
                    List(editableCategories, id: \.self) { category in
                        Button {
                            Task { await updateCategory(for: txn, category: category) }
                        } label: {
                            HStack {
                                Text(category.capitalized)
                                    .foregroundStyle(.primary)
                                Spacer()
                                if txn.category == category {
                                    Image(systemName: "checkmark")
                                        .foregroundStyle(.tint)
                                }
                            }
                        }
                    }
                    .navigationTitle("Category")
                    .navigationBarTitleDisplayMode(.inline)
                }
                .presentationDetents([.medium, .large])
            }
        }
    }

    private func updateCategory(for txn: Transaction, category: String) async {
        editingTransaction = nil
        isSaving = true
        defer { isSaving = false }
        do {
            let updatedStatements = try await EpiphanyAPI.shared.editStatementTransaction(
                id: statement.id,
                transactionId: txn.id,
                category: category
            )
            if let updated = updatedStatements.first(where: { $0.id == statement.id }) {
                transactions = updated.transactions
            }
            onUpdate(updatedStatements)
        } catch {
            self.error = error.localizedDescription
        }
    }
}

struct TappablePieChart: View {
    let categories: [(name: String, total: Double)]
    @Binding var selectedCategory: String?

    var body: some View {
        Chart {
            ForEach(categories, id: \.name) { cat in
                SectorMark(
                    angle: .value("Amount", cat.total),
                    innerRadius: .ratio(0.6),
                    outerRadius: .ratio(selectedCategory == cat.name ? 1.0 : 0.9)
                )
                .foregroundStyle(categoryColors[cat.name.lowercased()] ?? Color.gray)
                .opacity(selectedCategory == nil || selectedCategory == cat.name ? 1 : 0.4)
            }
        }
        .overlay {
            GeometryReader { geo in
                Color.clear
                    .contentShape(Circle())
                    .onTapGesture { location in
                        let center = CGPoint(x: geo.size.width / 2, y: geo.size.height / 2)
                        let dx = location.x - center.x
                        let dy = location.y - center.y
                        let dist = sqrt(dx * dx + dy * dy)
                        let radius = min(geo.size.width, geo.size.height) / 2
                        guard dist > radius * 0.6, dist < radius * 1.0 else { return }
                        var angle = atan2(dx, -dy)
                        if angle < 0 { angle += 2 * .pi }
                        let fraction = angle / (2 * .pi)
                        let total = categories.reduce(0.0) { $0 + $1.total }
                        guard total > 0 else { return }
                        let target = fraction * total
                        var cumulative = 0.0
                        for cat in categories {
                            cumulative += cat.total
                            if target <= cumulative {
                                withAnimation(.spring(response: 0.35, dampingFraction: 0.7)) {
                                    selectedCategory = selectedCategory == cat.name ? nil : cat.name
                                }
                                Haptics.selection()
                                return
                            }
                        }
                    }
            }
        }
    }
}
