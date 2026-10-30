import SwiftUI

/// The month's whole budget against everything spent in the newest statement month. Mirrors budgetLeft in budgetActual.js.
enum BudgetRing {
    struct Left: Equatable { let budget, spent, left, ratio: Double; let month: String }

    static func left(_ budget: FinanceData.Budget, month: FinanceData.SpendingMonth?) -> Left? {
        let total = budget.totalMonthlyExpenses
        guard total > 0, let month else { return nil }
        return Left(budget: total, spent: month.total, left: total - month.total, ratio: month.total / total, month: month.month)
    }
}

/// A ring of the month's budget used, with what's left (or over) beside it.
struct BudgetRingCard: View {
    let left: BudgetRing.Left

    var body: some View {
        let over = left.left < 0
        HStack(spacing: 20) {
            ZStack {
                Circle().stroke(Color.primary.opacity(0.08), lineWidth: 12)
                Circle().trim(from: 0, to: min(left.ratio, 1))
                    .stroke(over ? Palette.dangerRed : Palette.appleBlue, style: StrokeStyle(lineWidth: 12, lineCap: .round))
                    .rotationEffect(.degrees(-90))
            }
            .frame(width: 104, height: 104)
            VStack(alignment: .leading, spacing: 4) {
                Text(left.month.uppercased()).font(.caption.weight(.semibold)).foregroundStyle(.secondary)
                Text(CurrencyFormatter.formatPrice(abs(left.left)))
                    .font(.title.weight(.bold).monospacedDigit())
                    .foregroundStyle(over ? Palette.dangerRed : Color.primary)
                Text("\(over ? "over" : "left of") \(CurrencyFormatter.formatPrice(left.budget)), \(CurrencyFormatter.formatPrice(left.spent)) spent")
                    .font(.footnote.monospacedDigit()).foregroundStyle(.secondary)
            }
            Spacer(minLength: 0)
        }
        .accessibilityElement(children: .combine)
    }
}
