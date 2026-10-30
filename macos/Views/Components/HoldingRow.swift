import SwiftUI

struct HoldingRow: View {
    let holding: Portfolio.Holding
    @Environment(AppState.self) private var appState

    /// Today's move in dollars, when there's a quote that moved.
    private var today: Double? {
        guard holding.marketValue > 0, let cp = appState.stocks.first(where: { $0.symbol == holding.symbol })?.changePercent, cp != 0 else { return nil }
        return Allocation.todayGain(holding.marketValue, changePercent: cp)
    }

    private var gainColor: Color {
        holding.gainLoss >= 0 ? Palette.successGreen : Palette.dangerRed
    }

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(holding.symbol)
                    .font(.headline)
                Text("\(CurrencyFormatter.formatShares(holding.shares)) shares"
                     + (appState.stocks.first { $0.symbol == holding.symbol }?.yield.flatMap { $0 > 0 ? String(format: " · %.2f%% yield", $0) : nil } ?? ""))
                    .font(.caption)
                    .foregroundStyle(.secondary)
                if let today {
                    Text("\(CurrencyFormatter.formatSignedPrice(today)) today")
                        .font(.caption2.monospacedDigit())
                        .foregroundStyle(today >= 0 ? Palette.successGreen : Palette.dangerRed)
                }
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                Text(CurrencyFormatter.formatPrice(holding.marketValue))
                    .font(.body)
                // No cost basis (broker rows), no gain: (price - 0) x shares would read as all profit.
                if holding.avgCost > 0 {
                    Text(CurrencyFormatter.formatSignedPrice(holding.gainLoss))
                        .font(.caption)
                        .foregroundStyle(gainColor)
                }
            }
        }
    }
}
