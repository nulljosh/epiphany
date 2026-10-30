import SwiftUI

/// One goal: a progress ring with the percent inside, the name, and saved of target. Mirrors GoalRing in FinancePanel.jsx.
struct GoalRow: View {
    let goal: FinanceData.Goal

    var body: some View {
        HStack(spacing: 14) {
            ZStack {
                Circle().stroke(Color.primary.opacity(0.08), lineWidth: 5)
                Circle().trim(from: 0, to: goal.progress)
                    .stroke(goal.progress >= 1 ? Palette.successGreen : Palette.appleBlue,
                            style: StrokeStyle(lineWidth: 5, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                Text(String(format: "%.0f%%", goal.progress * 100))
                    .font(.caption2.weight(.semibold).monospacedDigit())
            }
            .frame(width: 44, height: 44)
            VStack(alignment: .leading, spacing: 2) {
                Text(goal.name).font(.headline)
                Text("\(CurrencyFormatter.formatPrice(goal.saved, decimals: 0)) of \(CurrencyFormatter.formatPrice(goal.target, decimals: 0))")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .monospacedDigit()
            }
            Spacer()
            if let deadline = goal.deadline, !deadline.isEmpty {
                Text(deadline).font(.caption).foregroundStyle(.secondary)
            }
        }
        .accessibilityElement(children: .combine)
    }
}
