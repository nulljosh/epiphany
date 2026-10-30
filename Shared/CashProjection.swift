import Charts
import SwiftUI

/// Cash for the next `days` days: today's cash, minus each bill on its day, plus each payday. Statements lag, so a
/// nextDate in the past rolls forward by its cadence until it lands on or after today. Mirrors projectCash in
/// src/utils/moneyGlance.js.
enum CashProjection {
    struct Point: Equatable { let day: Int; let balance: Double }

    struct MonthBills: Equatable { let month: String; let total: Double; let items: [Due] }
    struct Due: Equatable { let charge: RecurringCharge; let date: Date }

    /// Bills in the next `days`, rolled forward by cadence like `project`, grouped by month with a total each.
    /// Mirrors billsByMonth in moneyGlance.js.
    static func billsByMonth(_ bills: [RecurringCharge], today: Date = .now, days: Int = 60) -> [MonthBills] {
        let cal = Calendar.current
        let day0 = cal.startOfDay(for: today)
        let end = cal.date(byAdding: .day, value: days, to: day0) ?? day0
        var groups: [String: [Due]] = [:]
        for r in bills where r.amount > 0 {
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
                groups[String(format: "%04d-%02d", cal.component(.year, from: d), cal.component(.month, from: d)), default: []].append(Due(charge: r, date: d))
                d = step(d)
            }
        }
        return groups.keys.sorted().map { m in
            let items = groups[m]!.sorted { $0.date < $1.date }
            return MonthBills(month: m, total: items.reduce(0) { $0 + $1.charge.amount }, items: items)
        }
    }

    /// Paydays in and bills out from tomorrow to the end of this month, and what that leaves. Mirrors restOfMonth in moneyGlance.js.
    static func restOfMonth(bills: [RecurringCharge], income: [RecurringCharge], today: Date = .now) -> (in: Double, out: Double, left: Double) {
        let cal = Calendar.current
        let days = (cal.range(of: .day, in: .month, for: today)?.count ?? 30) - cal.component(.day, from: today)
        guard days > 0 else { return (0, 0, 0) }
        // Tomorrow to month end; anything due today counts as already gone.
        func net(_ b: [RecurringCharge], _ i: [RecurringCharge]) -> Double {
            let p = project(start: 0, bills: b, income: i, today: today, days: days).points
            return (p.last?.balance ?? 0) - (p.first?.balance ?? 0)
        }
        let inn = net([], income), out = -net(bills, [])
        return (inn, out, inn - out)
    }

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
