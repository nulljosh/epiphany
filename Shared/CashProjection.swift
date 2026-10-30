import Charts
import SwiftUI

/// Cash for the next `days` days: today's cash, minus each bill on its day, plus each payday. Statements lag, so a
/// nextDate in the past rolls forward by its cadence until it lands on or after today. Mirrors projectCash in
/// src/utils/moneyGlance.js.
enum CashProjection {
    struct Point: Equatable { let day: Int; let balance: Double }

    static func project(start: Double, bills: [RecurringCharge], income: [RecurringCharge],
                        today: Date = .now, days: Int = 30) -> (points: [Point], low: Point, events: Int) {
        let cal = Calendar.current
        let day0 = cal.startOfDay(for: today)
        let end = cal.date(byAdding: .day, value: days, to: day0) ?? day0
        var delta = [Double](repeating: 0, count: days + 1)
        var events = 0
        for (items, sign) in [(bills, -1.0), (income, 1.0)] {
            for r in items where r.amount > 0 {
                guard var d = ISO8601DateFormatter.dateOnly(r.nextDate) else { continue }
                let step: (Date) -> Date = { date in
                    switch r.cadence {
                    case "biweekly": cal.date(byAdding: .day, value: 14, to: date) ?? end
                    case "yearly": cal.date(byAdding: .year, value: 1, to: date) ?? end
                    default: cal.date(byAdding: .month, value: 1, to: date) ?? end
                    }
                }
                while d < day0 { d = step(d) }
                while d <= end {
                    delta[cal.dateComponents([.day], from: day0, to: d).day ?? 0] += sign * r.amount
                    events += 1
                    d = step(d)
                }
            }
        }
        var balance = start
        let points = delta.enumerated().map { day, x in balance += x; return Point(day: day, balance: balance) }
        let low = points.min { $0.balance < $1.balance } ?? Point(day: 0, balance: start)
        return (points, low, events)
    }
}

/// The projection as a line, Today at the left edge, with the low point called out. Nothing when no bill or
/// payday falls in the window.
struct CashLineCard: View {
    let cash: Double
    let bills: [RecurringCharge]
    let income: [RecurringCharge]

    var body: some View {
        let p = CashProjection.project(start: cash, bills: bills, income: income)
        if p.events > 0, let end = p.points.last?.balance {
            VStack(alignment: .leading, spacing: 4) {
                Text("CASH IN 30 DAYS")
                    .font(.caption2.weight(.bold))
                    .tracking(1.0)
                    .foregroundStyle(.secondary)
                Text(money(end))
                    .font(.title2.weight(.bold).monospacedDigit())
                    .foregroundStyle(end < 0 ? Palette.dangerRed : Color.primary)
                if p.low.day > 0, p.low.balance < min(cash, end) {
                    Text("Lowest \(money(p.low.balance)) on \(dateOf(p.low.day))")
                        .font(.footnote)
                        .foregroundStyle(p.low.balance < 0 ? Palette.dangerRed : .secondary)
                }
                Chart {
                    ForEach(p.points, id: \.day) { pt in
                        LineMark(x: .value("Day", pt.day), y: .value("Cash", pt.balance))
                            .foregroundStyle(Palette.appleBlue)
                    }
                    PointMark(x: .value("Day", 0), y: .value("Cash", cash))
                        .foregroundStyle(Palette.appleBlue)
                        .annotation(position: .bottom, alignment: .leading) { Text("Today").font(.caption2).foregroundStyle(.secondary) }
                    if (p.points.map(\.balance).min() ?? 0) < 0 {
                        RuleMark(y: .value("Zero", 0)).foregroundStyle(.secondary).lineStyle(StrokeStyle(lineWidth: 1, dash: [3, 3]))
                    }
                }
                .chartXAxis(.hidden)
                .chartYAxis(.hidden)
                .chartYScale(domain: .automatic(includesZero: (p.points.map(\.balance).min() ?? 0) < 0))
                .frame(height: 90)
                .padding(.top, 6)
                .accessibilityLabel("Projected cash balance for the next 30 days")
            }
        }
    }

    private func money(_ v: Double) -> String { (v < 0 ? "-" : "") + CurrencyFormatter.formatPrice(abs(v)) }
    private func dateOf(_ day: Int) -> String {
        (Calendar.current.date(byAdding: .day, value: day, to: .now) ?? .now).formatted(.dateTime.month(.abbreviated).day())
    }
}
