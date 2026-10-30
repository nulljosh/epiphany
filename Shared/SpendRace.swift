import Charts
import SwiftUI

/// The newest statement month's spending added up day by day, beside the month before. Mirrors spendRace in moneyGlance.js.
enum SpendRace {
    struct Race: Equatable { let month, prev: String; let cur, before: [Double] }

    static func build(_ statements: [Statement]) -> Race? {
        var byMonth: [String: [Double]] = [:]
        // Debits with a category, the same rule as Money in vs spending, so the totals agree.
        for t in statements.flatMap(\.transactions) where t.amount < 0 && !(t.category ?? "").isEmpty && t.date.count == 10 {
            let m = String(t.date.prefix(7)), day = Int(t.date.suffix(2)) ?? 0
            guard (1...31).contains(day) else { continue }
            byMonth[m, default: Array(repeating: 0, count: 32)][day] += -t.amount
        }
        let months = byMonth.keys.sorted()
        guard months.count >= 2 else { return nil }
        let prev = months[months.count - 2], cur = months[months.count - 1]
        func run(_ a: [Double]) -> [Double] { var s = 0.0; return a.dropFirst().map { s += $0; return s } }
        let lastDay = (1...31).last { byMonth[cur]![$0] > 0 } ?? 1
        return Race(month: cur, prev: prev, cur: Array(run(byMonth[cur]!).prefix(lastDay)), before: run(byMonth[prev]!))
    }
}

/// "August vs July": spending by day against last month, and how far ahead or behind.
struct SpendRaceCard: View {
    let statements: [Statement]

    var body: some View {
        if let r = SpendRace.build(statements), let total = r.cur.last {
            let diff = total - r.before[r.cur.count - 1]
            let name = { (ym: String) in ISO8601DateFormatter.dateOnly(ym + "-01")?.formatted(.dateTime.month(.wide)) ?? ym }
            VStack(alignment: .leading, spacing: 8) {
                Text("\(name(r.month)) vs \(name(r.prev))").font(.headline)
                (Text("\(CurrencyFormatter.formatPrice(total)) by day \(r.cur.count), ")
                 + Text("\(CurrencyFormatter.formatPrice(abs(diff))) \(diff <= 0 ? "less" : "more") than \(name(r.prev))")
                    .foregroundColor(diff <= 0 ? Palette.successGreen : Palette.dangerRed))
                    .font(.subheadline.weight(.semibold))
                Chart {
                    ForEach(Array(r.before.enumerated()), id: \.offset) { i, v in
                        LineMark(x: .value("Day", i + 1), y: .value("Spent", v), series: .value("Month", "before"))
                            .foregroundStyle(Color.secondary).lineStyle(StrokeStyle(lineWidth: 2, dash: [4, 3]))
                    }
                    ForEach(Array(r.cur.enumerated()), id: \.offset) { i, v in
                        LineMark(x: .value("Day", i + 1), y: .value("Spent", v), series: .value("Month", "now"))
                            .foregroundStyle(Palette.appleBlue).lineStyle(StrokeStyle(lineWidth: 2.5))
                    }
                }
                .chartXScale(domain: 1...31)
                .frame(height: 110)
                .accessibilityLabel("\(name(r.month)) spending by day against \(name(r.prev))")
            }
            .padding()
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 12))
        }
    }
}
