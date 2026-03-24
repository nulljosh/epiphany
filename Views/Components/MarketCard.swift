import SwiftUI

struct MarketCard: View {
    let market: PredictionMarket

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(market.question)
                .font(.subheadline.weight(.medium))
                .lineLimit(3)

            HStack(spacing: 12) {
                Label(market.formattedVolume, systemImage: "chart.bar")
                    .font(.caption.weight(.medium))
                    .foregroundStyle(.secondary)

                if let liquidity = market.formattedLiquidity {
                    Label(liquidity, systemImage: "drop")
                        .font(.caption.weight(.medium))
                        .foregroundStyle(.secondary)
                }
            }

            if let url = market.polymarketURL {
                Link(destination: url) {
                    Text("View on Polymarket")
                        .font(.caption2)
                        .foregroundStyle(Palette.appleBlue)
                }
            }
        }
        .padding(.vertical, 4)
    }
}
