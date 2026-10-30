import SwiftUI

/// The newest few transactions across statements. Mirrors recentActivity in moneyGlance.js.
enum RecentActivity {
    static func latest(_ statements: [Statement], count n: Int = 5) -> [Transaction] {
        Array(statements.flatMap(\.transactions).sorted { $0.date > $1.date }.prefix(n))
    }
}

/// "Recent activity": the last few transactions, money in green. Nothing without statements.
struct RecentActivityCard: View {
    let statements: [Statement]

    var body: some View {
        let txns = RecentActivity.latest(statements)
        if !txns.isEmpty {
            VStack(alignment: .leading, spacing: 10) {
                Text("RECENT ACTIVITY").font(.caption2.weight(.bold)).foregroundStyle(.secondary).tracking(1.0)
                ForEach(Array(txns.enumerated()), id: \.offset) { _, t in
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(t.description).font(.subheadline.weight(.semibold)).lineLimit(1)
                            Text((ISO8601DateFormatter.dateOnly(t.date)?.formatted(.dateTime.month(.abbreviated).day()) ?? t.date)
                                 + (t.category.flatMap { $0 == "uncategorized" ? nil : " · " + $0.replacingOccurrences(of: "_", with: " ").capitalized } ?? ""))
                                .font(.caption).foregroundStyle(.secondary)
                        }
                        Spacer(minLength: 12)
                        Text(CurrencyFormatter.formatSignedPrice(t.amount))
                            .font(.subheadline.weight(.semibold).monospacedDigit())
                            .foregroundStyle(t.amount >= 0 ? Palette.successGreen : Color.primary)
                    }
                }
            }
            .padding()
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 12))
        }
    }
}
