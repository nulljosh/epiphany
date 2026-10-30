import SwiftUI

/// One month's spending as its top categories plus Other, with shares. Mirrors topSpending in moneyGlance.js.
enum TopSpending {
    struct Row: Equatable { let name: String; let amount: Double; let share: Double }
    static let colors: [Color] = [Palette.appleBlue, Palette.successGreen, Palette.warningAmber, Palette.dangerRed, Color(white: 0.56)]

    static func rows(_ categories: [String: Double], top n: Int = 4) -> [Row] {
        let sorted = categories.filter { $0.value > 0 }.sorted { $0.value > $1.value }
        let total = sorted.reduce(0) { $0 + $1.value }
        guard total > 0 else { return [] }
        var rows = sorted.prefix(n).map { (name: $0.key, amount: $0.value) }
        let rest = sorted.dropFirst(n).reduce(0) { $0 + $1.value }
        if rest > 0 { rows.append((name: "other", amount: rest)) }
        return rows.map { Row(name: $0.name, amount: $0.amount, share: $0.amount / total) }
    }
}

/// "Top spending" for the newest month: one stacked bar and a legend with each share. Nothing with one category or none.
struct TopSpendingBar: View {
    let month: FinanceData.SpendingMonth

    var body: some View {
        let rows = TopSpending.rows(month.categories)
        if rows.count > 1 {
            VStack(alignment: .leading, spacing: 12) {
                Text("Top spending, \(month.month)").font(.headline)
                GeometryReader { g in
                    HStack(spacing: 2) {
                        ForEach(Array(rows.enumerated()), id: \.offset) { i, r in
                            TopSpending.colors[i].frame(width: max(0, (g.size.width - CGFloat(rows.count - 1) * 2) * r.share))
                        }
                    }
                }
                .frame(height: 14)
                .clipShape(Capsule())
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], alignment: .leading, spacing: 8) {
                    ForEach(Array(rows.enumerated()), id: \.offset) { i, r in
                        HStack(spacing: 6) {
                            RoundedRectangle(cornerRadius: 2).fill(TopSpending.colors[i]).frame(width: 8, height: 8)
                            Text(r.name.replacingOccurrences(of: "_", with: " ").capitalized)
                            Spacer()
                            Text("\(Int((r.share * 100).rounded()))%").foregroundStyle(.secondary).monospacedDigit()
                        }
                        .font(.caption)
                    }
                }
            }
            .padding()
            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 12))
        }
    }
}
