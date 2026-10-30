import SwiftUI

/// The newest few transactions across statements. Mirrors recentActivity in moneyGlance.js.
enum RecentActivity {
    static func latest(_ statements: [Statement], count n: Int = 5) -> [Transaction] {
        Array(statements.flatMap(\.transactions).sorted { $0.date > $1.date }.prefix(n))
    }

    /// The newest statement month's biggest single expense (debits with a category). Mirrors biggestExpense in moneyGlance.js.
    static func biggest(_ statements: [Statement]) -> Transaction? {
        let debits = statements.flatMap(\.transactions).filter { $0.amount < 0 && !($0.category ?? "").isEmpty && $0.date.count >= 7 }
        guard let month = debits.map({ String($0.date.prefix(7)) }).max() else { return nil }
        return debits.filter { $0.date.hasPrefix(month) }.min { $0.amount < $1.amount }
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

/// The merchant key detectRecurring groups by (server/api/recurring.js). Mirrors recurringKey in moneyGlance.js.
enum MerchantKey {
    static func of(_ description: String) -> String {
        var s = description.uppercased()
        for (pattern, with) in [(#"\d{1,4}[/.-]\d{1,2}(?:[/.-]\d{1,4})?"#, " "), ("#", " "), (#"[^A-Z&' ]+"#, " ")] {
            s = s.replacingOccurrences(of: pattern, with: with, options: .regularExpression)
        }
        var tokens = s.split(separator: " ").map(String.init)
        while tokens.count > 1, tokens.last!.count == 2, tokens.last!.allSatisfy(\.isLetter) { tokens.removeLast() }
        let joined = tokens.joined(separator: " ").lowercased()
            .replacingOccurrences(of: #"^(pre ?authorized debit( to)?|pad( to)?|pos purchase|purchase)\s+"#, with: "", options: .regularExpression)
        return joined.split(separator: " ").prefix(2).joined(separator: " ")
    }
}

/// "Recent activity": the last few transactions, money in green, recurring ones marked. Nothing without statements.
struct RecentActivityCard: View {
    let statements: [Statement]
    var recurring: [RecurringCharge] = []

    var body: some View {
        let txns = RecentActivity.latest(statements)
        if !txns.isEmpty {
            VStack(alignment: .leading, spacing: 10) {
                Text("Recent Activity").font(.headline)
                if let big = RecentActivity.biggest(statements) {
                    (Text("Biggest in \(ISO8601DateFormatter.dateOnly(big.date)?.formatted(.dateTime.month(.wide)) ?? ""): ")
                     + Text(CurrencyFormatter.formatPrice(abs(big.amount))).fontWeight(.semibold).foregroundColor(.primary)
                     + Text(" at \(big.description)"))
                        .font(.footnote).foregroundStyle(.secondary)
                }
                ForEach(Array(txns.enumerated()), id: \.offset) { _, t in
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            HStack(spacing: 4) {
                                Text(t.description).font(.subheadline.weight(.semibold)).lineLimit(1)
                                if recurring.contains(where: { $0.merchant == MerchantKey.of(t.description) }) {
                                    Image(systemName: "arrow.triangle.2.circlepath").font(.caption2).foregroundStyle(.secondary)
                                        .accessibilityLabel("Recurring")
                                }
                            }
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
