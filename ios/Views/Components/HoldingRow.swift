import SwiftUI

struct HoldingRow: View {
    let holding: Portfolio.Holding

    private var gainColor: Color {
        holding.gainLoss >= 0 ? Palette.successGreen : Palette.dangerRed
    }

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 3) {
                Text(holding.symbol)
                    .font(.headline.weight(.bold))
                    .foregroundStyle(Palette.text)
                Text("\(CurrencyFormatter.formatShares(holding.shares)) shares")
                    .font(.caption)
                    .foregroundStyle(Palette.textSecondary)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 3) {
                Text(CurrencyFormatter.formatPrice(holding.marketValue))
                    .font(.body.weight(.semibold))
                    .foregroundStyle(Palette.text)
                Text(CurrencyFormatter.formatSignedPrice(holding.gainLoss))
                    .font(.caption.weight(.medium))
                    .foregroundStyle(gainColor)
            }
        }
    }
}
