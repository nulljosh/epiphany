import SwiftUI

struct MarketCard: View {
    let market: PredictionMarket

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text(market.question)
                .font(.subheadline.weight(.semibold))
                .lineLimit(3)

            if let description = market.description, !description.isEmpty {
                Text(description)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }

            HStack(spacing: 10) {
                statPill(title: "24h Vol", value: market.formattedVolume, systemImage: "chart.bar.fill")

                if let liquidity = market.formattedLiquidity {
                    statPill(title: "Liquidity", value: liquidity, systemImage: "drop.fill")
                }

                Spacer(minLength: 0)

                if let url = market.polymarketURL {
                    Link(destination: url) {
                        Label("Open", systemImage: "arrow.up.right")
                            .font(.caption.weight(.semibold))
                            .padding(.horizontal, 10)
                            .padding(.vertical, 8)
                            .background(Palette.appleBlue.opacity(0.18), in: Capsule())
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.white.opacity(0.04), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    private func statPill(title: String, value: String, systemImage: String) -> some View {
        HStack(spacing: 6) {
            Image(systemName: systemImage)
            VStack(alignment: .leading, spacing: 1) {
                Text(title)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                Text(value)
                    .font(.caption.monospacedDigit().weight(.semibold))
            }
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 8)
        .background(Color.white.opacity(0.05), in: Capsule())
    }
}
