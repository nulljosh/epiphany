import SwiftUI

struct HoldingRow: View {
    let holding: Portfolio.Holding

    private var gainColor: Color {
        holding.gainLoss >= 0 ? Palette.successGreen : Palette.dangerRed
    }

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(holding.symbol)
                    .font(.headline)
                Text("\(CurrencyFormatter.formatShares(holding.shares)) shares")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                Text(CurrencyFormatter.formatPrice(holding.marketValue))
                    .font(.body)
                Text(CurrencyFormatter.formatSignedPrice(holding.gainLoss))
                    .font(.caption)
                    .foregroundStyle(gainColor)
            }
        }
    }
}
