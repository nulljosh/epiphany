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

    /// This year's spending per category across statement months, biggest first, leaving out uncategorized.
    /// Mirrors yearToDate in moneyGlance.js.
    static func yearToDate(_ months: [FinanceData.SpendingMonth], year: Int = Calendar.current.component(.year, from: .now), top n: Int = 3) -> (months: Int, rows: [(name: String, amount: Double)]) {
        let these = months.filter { $0.sortKey.hasPrefix("\(year)-") }
        var sums: [String: Double] = [:]
        for m in these { for (k, v) in m.categories where v > 0 && k != "uncategorized" { sums[k, default: 0] += v } }
        return (these.count, sums.sorted { $0.value > $1.value }.prefix(n).map { (name: $0.key, amount: $0.value) })
    }
}

/// "So far this year": the biggest category this year, then the next two.
struct YearToDateCard: View {
    let months: [FinanceData.SpendingMonth]

    var body: some View {
        let ytd = TopSpending.yearToDate(months)
        if let first = ytd.rows.first {
            VStack(alignment: .leading, spacing: 6) {
                Text("So Far This Year").font(.headline)
                Text("\(CurrencyFormatter.formatPrice(first.amount)) on \(Self.label(first.name)) across \(ytd.months) \(ytd.months == 1 ? "statement" : "statements")")
                    .font(.subheadline.weight(.semibold))
                ForEach(ytd.rows.dropFirst(), id: \.name) { r in
                    HStack {
                        Text(Self.label(r.name))
                        Spacer()
                        Text(CurrencyFormatter.formatPrice(r.amount)).monospacedDigit()
                    }
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                }
            }
            .padding()
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 12))
        }
    }

    private static func label(_ name: String) -> String { name.replacingOccurrences(of: "_", with: " ").capitalized }
}

/// "Top spending" for one statement month: one stacked bar and a legend with each share, with arrows to step back
/// through older months. `months` is newest first.
struct TopSpendingBar: View {
    let months: [FinanceData.SpendingMonth]
    @State private var index = 0

    var body: some View {
        if !months.isEmpty {
            let month = months[min(index, months.count - 1)]
            let rows = TopSpending.rows(month.categories)
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Text("Top Spending, \(month.month)").font(.headline)
                    Spacer()
                    Button { index += 1 } label: { Image(systemName: "chevron.left") }
                        .disabled(index >= months.count - 1).accessibilityLabel("Older month")
                    Button { index -= 1 } label: { Image(systemName: "chevron.right") }
                        .disabled(index == 0).accessibilityLabel("Newer month")
                }
                .buttonStyle(.borderless)
                if rows.isEmpty {
                    Text("No spending this month").font(.caption).foregroundStyle(.secondary)
                } else {
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
            }
            .padding()
            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 12))
        }
    }
}
