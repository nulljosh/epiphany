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

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            if !insights.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 10) {
                        ForEach(insights) { insightCard($0) }
                    }
                }
            }
            if !upcoming.isEmpty { upcomingList }
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
