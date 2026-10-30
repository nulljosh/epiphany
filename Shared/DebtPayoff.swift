import Charts
import SwiftUI

/// Smallest balance first, each at its minimum payment with interest, like the web's projection
/// (debtMonthsToPayoff in src/utils/debtPayoff.js), plus the month you'd be debt-free.
enum DebtPayoff {
    struct Step: Equatable { let name: String; let balance, months, cumulative: Double }

    /// Months to clear `balance` at `payment` a month with `rate` percent a year; infinite when it never clears.
    static func months(balance: Double, payment: Double, rate: Double) -> Double {
        if balance <= 0 { return 0 }
        if payment <= 0 { return .infinity }
        if balance <= payment { return 0 }
        let r = rate / 100 / 12
        if r <= 0 { return balance / payment }
        let ratio = balance * r / payment
        return ratio >= 1 ? .infinity : -log(1 - ratio) / log(1 + r)
    }

    static func plan(_ debt: [FinanceData.DebtItem], now: Date = .now) -> (steps: [Step], unpayable: Bool, finish: Date?) {
        var cumulative = 0.0, unpayable = false, steps: [Step] = []
        for d in debt.filter({ $0.balance > 0 }).sorted(by: { $0.balance < $1.balance }) {
            let m = months(balance: d.balance, payment: d.minPayment, rate: d.rate)
            if m.isFinite { cumulative += m } else { unpayable = true }
            steps.append(Step(name: d.name, balance: d.balance, months: m, cumulative: cumulative))
        }
        let finish = unpayable || steps.isEmpty ? nil : Calendar.current.date(byAdding: .month, value: Int(cumulative.rounded(.up)), to: now)
        return (steps, unpayable, finish)
    }
}

/// Total debt falling to zero as each one is paid off, with the debt-free month.
struct DebtPayoffCard: View {
    let debt: [FinanceData.DebtItem]

    var body: some View {
        let p = DebtPayoff.plan(debt)
        if !p.steps.isEmpty {
            let total = p.steps.reduce(0) { $0 + $1.balance }
            // Remaining total after each payoff, starting from today.
            let points = [(0.0, total)] + p.steps.enumerated().filter { $0.element.months.isFinite }.map { i, s in
                (s.cumulative, p.steps.dropFirst(i + 1).reduce(0) { $0 + $1.balance })
            }
            VStack(alignment: .leading, spacing: 10) {
                Text("Payoff Projection").font(.headline)
                Chart(Array(points.enumerated()), id: \.offset) { _, pt in
                    AreaMark(x: .value("Month", pt.0), y: .value("Debt", pt.1))
                        .foregroundStyle(Palette.dangerRed.opacity(0.15))
                    LineMark(x: .value("Month", pt.0), y: .value("Debt", pt.1))
                        .foregroundStyle(Palette.dangerRed)
                }
                .chartXAxisLabel("Months")
                .frame(height: 120)
                ForEach(p.steps, id: \.name) { s in
                    HStack {
                        Text(s.name).font(.subheadline.weight(.semibold))
                        Spacer()
                        Text(s.months.isFinite ? "~\(Int(s.months.rounded(.up))) mo" : "never at this payment")
                            .font(.caption).foregroundStyle(.secondary)
                        Text(CurrencyFormatter.formatPrice(s.balance)).font(.caption).monospacedDigit()
                    }
                }
                Text(p.finish.map { "Debt-free by \($0.formatted(.dateTime.month(.wide).year()))" } ?? "Payoff time unknown. Set a monthly payment on every debt")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(p.finish == nil ? Color.secondary : Palette.successGreen)
            }
        }
    }
}
