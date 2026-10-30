import SwiftUI

/// Estimated dividend payments per month for the next year, from each holding's next pay date and trailing yield.
/// Mirrors dividendCalendar in allocation.js.
/// ponytail: assumes quarterly payers (most US and Canadian stocks); monthly and yearly payers read a bit off.
enum DividendCalendar {
    struct Month: Equatable { let month: Date; let amount: Double }
    struct Payment: Equatable { let symbol: String; let date: Date; let amount: Double }

    static func build(_ holdings: [Portfolio.Holding], stocks: [Stock], now: Date = .now, months: Int = 12) -> (calendar: [Month], next: [Payment]) {
        let cal = Calendar.current
        let start = cal.date(from: cal.dateComponents([.year, .month], from: now))!
        let end = cal.date(byAdding: .month, value: months, to: start)!
        let quotes = Dictionary(stocks.map { ($0.symbol, $0) }, uniquingKeysWith: { a, _ in a })
        var byMonth: [Date: Double] = [:]
        var next: [Payment] = []
        for h in holdings {
            guard h.marketValue > 0, let q = quotes[h.symbol], let y = q.yield, y > 0, let ts = q.dividendDate else { continue }
            let each = h.marketValue * y / 100 / 4
            let first = Date(timeIntervalSince1970: ts)
            for i in 0..<4 {
                guard let d = cal.date(byAdding: .month, value: i * 3, to: first), d >= start, d < end,
                      let m = cal.date(from: cal.dateComponents([.year, .month], from: d)) else { continue }
                byMonth[m, default: 0] += each
            }
            if first >= start { next.append(Payment(symbol: h.symbol, date: first, amount: each)) }
        }
        let calendar = (0..<months).compactMap { cal.date(byAdding: .month, value: $0, to: start) }.map { Month(month: $0, amount: byMonth[$0] ?? 0) }
        return (calendar, next.sorted { $0.date < $1.date })
    }
}

/// Twelve monthly bars of estimated dividends and the next pay dates; nothing when no holding pays.
struct DividendCalendarCard: View {
    let holdings: [Portfolio.Holding]
    let stocks: [Stock]

    var body: some View {
        let d = DividendCalendar.build(holdings, stocks: stocks)
        if !d.next.isEmpty || d.calendar.contains(where: { $0.amount > 0 }) {
            let peak = d.calendar.map(\.amount).max() ?? 1
            VStack(alignment: .leading, spacing: 10) {
                Text("Dividend Calendar").font(.headline)
                HStack(alignment: .bottom, spacing: 4) {
                    ForEach(d.calendar, id: \.month) { m in
                        VStack(spacing: 4) {
                            RoundedRectangle(cornerRadius: 3)
                                .fill(Palette.successGreen)
                                .frame(height: m.amount > 0 ? max(6, 56 * m.amount / peak) : 0)
                                .frame(maxHeight: 56, alignment: .bottom)
                            Text(m.month.formatted(.dateTime.month(.narrow))).font(.caption2).foregroundStyle(.secondary)
                        }
                        .frame(maxWidth: .infinity)
                        .accessibilityElement(children: .ignore)
                        .accessibilityLabel("\(m.month.formatted(.dateTime.month(.wide))): about \(CurrencyFormatter.formatPrice(m.amount))")
                    }
                }
                ForEach(d.next.prefix(5), id: \.symbol) { p in
                    HStack {
                        Text(p.symbol).fontWeight(.semibold)
                        Text(p.date.formatted(.dateTime.month(.abbreviated).day())).foregroundStyle(.secondary)
                        Spacer()
                        Text("about \(CurrencyFormatter.formatPrice(p.amount))").foregroundStyle(.secondary).monospacedDigit()
                    }
                    .font(.subheadline)
                }
                Text("Estimated from each stock's yield, paid quarterly.").font(.caption2).foregroundStyle(.secondary)
            }
            .padding()
            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 12))
        }
    }
}
