import Charts
import SwiftUI

/// Money in vs spending for one month, from /api/statements (summarizeCashflow).
struct CashflowMonth: Decodable, Identifiable, Hashable {
    let month: String  // "2026-09"
    let `in`: Double
    let out: Double
    var id: String { month }
    var label: String {
        ISO8601DateFormatter.dateOnly(month + "-01")?.formatted(.dateTime.month(.abbreviated)) ?? month
    }
}

/// One plain line about the latest month, from /api/statements (findInsights).
struct MoneyInsight: Decodable, Identifiable, Hashable {
    let kind: String
    let title: String
    let amount: Double
    let month: String
    let detail: String
    var id: String { kind }
}

/// Top of the Spending tab: what changed, what's due in the next 30 days, money in vs out.
/// Each part hides when it has no data.
struct MoneyGlance: View {
    let recurring: [RecurringCharge]
    let cashflow: [CashflowMonth]
    let insights: [MoneyInsight]
    var income: [RecurringCharge] = []
    var cash: Double = 0

    private var upcoming: [(charge: RecurringCharge, date: Date)] {
        let today = Calendar.current.startOfDay(for: .now)
        let horizon = Calendar.current.date(byAdding: .day, value: 30, to: today) ?? today
        return recurring
            .compactMap { c in ISO8601DateFormatter.dateOnly(c.nextDate).map { (charge: c, date: $0) } }
            .filter { $0.date >= today && $0.date <= horizon }
            .sorted { $0.date < $1.date }
            .prefix(5)
            .map { $0 }
    }

    /// Money in minus out for the newest statement month. Says "this month" only when it is; a statement that lags
    /// reads "Left in September". Mirrors leftThisMonth in src/utils/moneyGlance.js.
    static func left(_ cashflow: [CashflowMonth], now: Date = .now) -> (title: String, left: Double, month: CashflowMonth)? {
        guard let m = cashflow.last else { return nil }
        let c = Calendar.current.dateComponents([.year, .month], from: now)
        let current = String(format: "%04d-%02d", c.year ?? 0, c.month ?? 0)
        let name = ISO8601DateFormatter.dateOnly(m.month + "-01")?.formatted(.dateTime.month(.wide)) ?? m.month
        return (m.month == current ? "Left this month" : "Left in \(name)", m.in - m.out, m)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            if let left = Self.left(cashflow) {
                VStack(alignment: .leading, spacing: 4) {
                    heading(left.title.uppercased())
                    Text((left.left < 0 ? "-" : "") + CurrencyFormatter.formatPrice(abs(left.left)))
                        .font(.title.weight(.bold).monospacedDigit())
                        .foregroundStyle(left.left >= 0 ? Color.primary : Palette.dangerRed)
                    Text("\(CurrencyFormatter.formatPrice(left.month.in)) in, \(CurrencyFormatter.formatPrice(left.month.out)) spent")
                        .font(.footnote.monospacedDigit())
                        .foregroundStyle(.secondary)
                }
                .accessibilityElement(children: .combine)
            }
            let rest = CashProjection.restOfMonth(bills: recurring, income: income)
            if rest.in > 0 || rest.out > 0 {
                VStack(alignment: .leading, spacing: 4) {
                    heading("REST OF \(Date.now.formatted(.dateTime.month(.wide)).uppercased())")
                    Text((rest.left < 0 ? "-" : "+") + CurrencyFormatter.formatPrice(abs(rest.left)))
                        .font(.title.weight(.bold).monospacedDigit())
                        .foregroundStyle(rest.left >= 0 ? Color.primary : Palette.dangerRed)
                    Text("\(CurrencyFormatter.formatPrice(rest.in)) in paydays, \(CurrencyFormatter.formatPrice(rest.out)) in bills still to come")
                        .font(.footnote.monospacedDigit())
                        .foregroundStyle(.secondary)
                }
                .accessibilityElement(children: .combine)
            }
            if !insights.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 10) {
                        ForEach(insights) { insightCard($0) }
                    }
                }
            }
            if !upcoming.isEmpty { upcomingList }
            if cash > 0 { CashLineCard(cash: cash, bills: recurring, income: income) }
            if !cashflow.isEmpty { cashflowChart }
        }
    }

    private func heading(_ text: String, trailing: String? = nil) -> some View {
        HStack {
            Text(text)
                .font(.caption2.weight(.bold))
                .tracking(1.0)
            Spacer()
            if let trailing {
                Text(trailing).font(.caption2.weight(.semibold).monospacedDigit())
            }
        }
        .foregroundStyle(.secondary)
    }

    private func insightCard(_ insight: MoneyInsight) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(insight.title.prefix(1).uppercased() + insight.title.dropFirst())
                .font(.subheadline.weight(.semibold))
                .lineLimit(1)
            Text(CurrencyFormatter.formatPrice(insight.amount))
                .font(.title3.weight(.semibold).monospacedDigit())
            Text(insight.detail)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(12)
        .frame(width: 180, alignment: .leading)
        .background(Color.primary.opacity(0.05), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
    }

    private var upcomingList: some View {
        VStack(alignment: .leading, spacing: 10) {
            heading("NEXT 30 DAYS",
                    trailing: CurrencyFormatter.formatPrice(upcoming.map(\.charge.amount).reduce(0, +)))
            billsCalendar
            ForEach(upcoming, id: \.charge.id) { item in
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(item.charge.merchant.capitalized)
                            .font(.subheadline.weight(.semibold))
                        Text(item.date, format: .dateTime.weekday(.abbreviated).month(.abbreviated).day())
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                    Text(CurrencyFormatter.formatPrice(item.charge.amount))
                        .font(.subheadline.weight(.semibold).monospacedDigit())
                }
            }
        }
    }

    /// This month as a grid, with the days a recurring charge is due marked.
    private var billsCalendar: some View {
        let cal = Calendar.current
        let now = Date.now
        let today = cal.component(.day, from: now)
        let first = cal.date(from: cal.dateComponents([.year, .month], from: now)) ?? now
        let lead = (cal.component(.weekday, from: first) - cal.firstWeekday + 7) % 7
        let length = cal.range(of: .day, in: .month, for: now)?.count ?? 30
        // Monthly bills land on the same day every month; the rest only on their next date.
        let due = Set(recurring.compactMap { charge -> Int? in
            guard let date = ISO8601DateFormatter.dateOnly(charge.nextDate) else { return nil }
            if charge.cadence == "monthly" { return min(cal.component(.day, from: date), length) }
            return cal.isDate(date, equalTo: now, toGranularity: .month) ? cal.component(.day, from: date) : nil
        })
        let symbols = Array(cal.veryShortWeekdaySymbols[(cal.firstWeekday - 1)...] + cal.veryShortWeekdaySymbols[..<(cal.firstWeekday - 1)])
        let cells: [Int?] = Array(repeating: nil, count: lead) + (1...length).map { $0 }
        return LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 4), count: 7), spacing: 4) {
            ForEach(Array(symbols.enumerated()), id: \.offset) { _, s in
                Text(s).font(.caption2.weight(.semibold)).foregroundStyle(.tertiary)
            }
            ForEach(Array(cells.enumerated()), id: \.offset) { _, day in
                if let day {
                    Text("\(day)")
                        .font(.caption2.monospacedDigit().weight(due.contains(day) || day == today ? .bold : .regular))
                        .foregroundStyle(due.contains(day) ? .primary : day < today ? .tertiary : .secondary)
                        .frame(maxWidth: .infinity, minHeight: 24)
                        .background(due.contains(day) ? Palette.warningAmber.opacity(0.22) : .clear, in: Capsule())
                        .overlay { if day == today { Capsule().strokeBorder(.secondary, lineWidth: 1) } }
                } else {
                    Color.clear.frame(height: 24)
                }
            }
        }
    }

    private var cashflowChart: some View {
        VStack(alignment: .leading, spacing: 10) {
            heading("MONEY IN VS SPENDING")
            Chart {
                ForEach(cashflow) { m in
                    BarMark(x: .value("Month", m.label), y: .value("Amount", m.in))
                        .foregroundStyle(by: .value("Flow", "In"))
                        .position(by: .value("Flow", "In"))
                    BarMark(x: .value("Month", m.label), y: .value("Amount", m.out))
                        .foregroundStyle(by: .value("Flow", "Spent"))
                        .position(by: .value("Flow", "Spent"))
                }
            }
            .chartForegroundStyleScale(["In": Palette.successGreen, "Spent": Palette.dangerRed])
            .chartLegend(position: .top, alignment: .trailing)
            .frame(height: 160)
        }
    }
}

/// First run: an empty account gets three steps instead of zeros. Hidden once anything is there.
struct FirstRunCard: View {
    let onUpload: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Start with last month")
                .font(.headline)
            Text("Three steps and the numbers here are yours.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
            ForEach(Array(["Drop in a PDF statement: spending, bills and insights fill in from it.",
                           "Add what you hold, or connect a broker read only.",
                           "Set a monthly budget per category."].enumerated()), id: \.offset) { i, step in
                HStack(alignment: .top, spacing: 10) {
                    Text("\(i + 1)")
                        .font(.caption.weight(.bold))
                        .frame(width: 24, height: 24)
                        .background(Color.primary.opacity(0.08), in: Circle())
                    Text(step)
                        .font(.subheadline)
                }
            }
            Button("Add a statement", action: onUpload)
                .buttonStyle(.borderedProminent)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.primary.opacity(0.05), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }
}
