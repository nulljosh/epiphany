import SwiftUI

/// The newest few transactions across statements. Mirrors recentActivity in moneyGlance.js.
enum RecentActivity {
    static func latest(_ statements: [Statement], count n: Int = 5) -> [Transaction] {
        Array(statements.flatMap(\.transactions).sorted { $0.date > $1.date }.prefix(n))
    }

    /// Dividends and interest paid to you this year, from statement descriptions. Mirrors earnedThisYear in moneyGlance.js.
    static func earned(_ statements: [Statement], year: Int = Calendar.current.component(.year, from: .now)) -> (dividends: Double, interest: Double) {
        var out = (dividends: 0.0, interest: 0.0)
        for t in statements.flatMap(\.transactions) where t.amount > 0 && t.date.hasPrefix("\(year)-") {
            if t.description.range(of: #"\bdiv(idend)?s?\b"#, options: [.regularExpression, .caseInsensitive]) != nil { out.dividends += t.amount }
            else if t.description.range(of: #"\binterest\b"#, options: [.regularExpression, .caseInsensitive]) != nil { out.interest += t.amount }
        }
        return out
    }
}

/// "Earned this year": dividends and interest paid in, from statements. Nothing when both are zero.
struct EarnedThisYearCard: View {
    let statements: [Statement]

    var body: some View {
        let e = RecentActivity.earned(statements)
        if e.dividends > 0 || e.interest > 0 {
            VStack(alignment: .leading, spacing: 8) {
                Text("Earned This Year").font(.headline)
                ForEach([("Dividends", e.dividends), ("Interest", e.interest)].filter { $0.1 > 0 }, id: \.0) { label, v in
                    HStack {
                        Text(label).font(.subheadline)
                        Spacer()
                        Text("+" + CurrencyFormatter.formatPrice(v)).font(.subheadline.weight(.semibold).monospacedDigit()).foregroundStyle(Palette.successGreen)
                    }
                }
            }
            .padding()
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 12))
        }
    }
}

/// "Recent activity": the last few transactions, money in green. Nothing without statements.
struct RecentActivityCard: View {
    let statements: [Statement]

    var body: some View {
        let txns = RecentActivity.latest(statements)
        if !txns.isEmpty {
            VStack(alignment: .leading, spacing: 10) {
                Text("Recent Activity").font(.headline)
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
