import SwiftUI

/// Bill history grid: the last `n` statement months and, per bill, whether it was paid in each.
/// The months end at the newest month any bill was paid, since statements lag the clock. Mirrors billHistory in moneyGlance.js.
enum BillHistory {
    struct Row: Equatable { let name: String; let amount: Double; let paid: [Bool] }

    static func grid(_ recurring: [RecurringCharge], months n: Int = 6) -> (months: [String], rows: [Row]) {
        guard let newest = recurring.flatMap({ $0.months ?? [] }).max(),
              let end = ISO8601DateFormatter.dateOnly(newest + "-01") else { return ([], []) }
        let months = (0..<n).reversed().compactMap { back in
            Calendar.current.date(byAdding: .month, value: -back, to: end).map { d in
                String(format: "%04d-%02d", Calendar.current.component(.year, from: d), Calendar.current.component(.month, from: d))
            }
        }
        let rows = recurring.compactMap { r -> Row? in
            guard let paid = r.months, !paid.isEmpty else { return nil }
            return Row(name: r.merchant, amount: r.amount, paid: months.map(paid.contains))
        }
        return (months, rows)
    }
}

/// A row of paid months per recurring bill, newest statement month on the right. Nothing without bills.
struct BillHistoryCard: View {
    let recurring: [RecurringCharge]

    var body: some View {
        let g = BillHistory.grid(recurring)
        if !g.rows.isEmpty {
            VStack(alignment: .leading, spacing: 8) {
                Text("Bill history").font(.headline)
                Grid(alignment: .leading, horizontalSpacing: 6, verticalSpacing: 8) {
                    GridRow {
                        Color.clear.frame(height: 1)
                        ForEach(g.months, id: \.self) { m in
                            Text(ISO8601DateFormatter.dateOnly(m + "-01")?.formatted(.dateTime.month(.narrow)) ?? "")
                                .font(.caption2).foregroundStyle(.secondary).frame(width: 22)
                        }
                    }
                    ForEach(g.rows, id: \.name) { r in
                        GridRow {
                            Text(r.name.capitalized).font(.subheadline.weight(.semibold)).lineLimit(1)
                                .frame(maxWidth: .infinity, alignment: .leading)
                            ForEach(Array(r.paid.enumerated()), id: \.offset) { _, paid in
                                RoundedRectangle(cornerRadius: 6)
                                    .fill(paid ? Palette.successGreen : Color.primary.opacity(0.08))
                                    .frame(width: 22, height: 22)
                                    .accessibilityLabel(paid ? "Paid" : "Not seen")
                            }
                        }
                    }
                }
            }
            .padding()
            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 12))
        }
    }
}
