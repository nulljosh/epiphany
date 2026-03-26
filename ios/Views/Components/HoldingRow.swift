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
                Text(String(format: "%.4f shares", holding.shares))
                    .font(.caption)
                    .foregroundStyle(Palette.textSecondary)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 3) {
                Text(String(format: "$%.2f", holding.marketValue))
                    .font(.body.weight(.semibold))
                    .foregroundStyle(Palette.text)
                Text(String(format: "%@$%.2f", holding.gainLoss >= 0 ? "+" : "", holding.gainLoss))
                    .font(.caption.weight(.medium))
                    .foregroundStyle(gainColor)
            }
        }
    }
}
