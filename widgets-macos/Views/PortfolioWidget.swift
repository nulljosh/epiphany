import WidgetKit
import SwiftUI

struct PortfolioWidget: Widget {
    let kind = "MacPortfolioWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: PortfolioProvider()) { entry in
            PortfolioWidgetView(entry: entry)
                .containerBackground(.fill.tertiary, for: .widget)
        }
        .configurationDisplayName("Portfolio")
        .description("Track your portfolio value and top holdings.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}

struct PortfolioWidgetView: View {
    @Environment(\.widgetFamily) var family
    let entry: PortfolioEntry

    var body: some View {
        switch family {
        case .systemSmall:
            smallView
        case .systemMedium:
            mediumView
        case .systemLarge:
            largeView
        default:
            smallView
        }
    }

    // MARK: - Small

    private var smallView: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: "chart.pie.fill")
                    .foregroundStyle(.blue)
                Text("Portfolio")
                    .font(.caption.bold())
                    .foregroundStyle(.secondary)
            }

            Spacer()

            Text(formatCurrency(entry.totalValue))
                .font(.title2.bold())
                .minimumScaleFactor(0.6)
                .lineLimit(1)

            HStack(spacing: 4) {
                Image(systemName: entry.dayChange >= 0 ? "arrow.up.right" : "arrow.down.right")
                    .font(.caption2)
                Text(formatChange(entry.dayChange))
                    .font(.caption)
                Text(formatPercent(entry.dayChangePercent))
                    .font(.caption)
            }
            .foregroundStyle(entry.dayChange >= 0 ? Color.macGain : Color.macLoss)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .redacted(reason: entry.isPlaceholder ? .placeholder : [])
    }

    // MARK: - Medium

    private var mediumView: some View {
        HStack(spacing: 16) {
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Image(systemName: "chart.pie.fill")
                        .foregroundStyle(.blue)
                    Text("Portfolio")
                        .font(.caption.bold())
                        .foregroundStyle(.secondary)
                }

                Spacer()

                Text(formatCurrency(entry.totalValue))
                    .font(.title2.bold())
                    .minimumScaleFactor(0.6)

                HStack(spacing: 4) {
                    Image(systemName: entry.dayChange >= 0 ? "arrow.up.right" : "arrow.down.right")
                        .font(.caption2)
                    Text(formatChange(entry.dayChange))
                        .font(.caption)
                    Text(formatPercent(entry.dayChangePercent))
                        .font(.caption)
                }
                .foregroundStyle(entry.dayChange >= 0 ? Color.macGain : Color.macLoss)
            }

            Divider()

            VStack(alignment: .leading, spacing: 6) {
                Text("TOP HOLDINGS")
                    .font(.system(size: 9, weight: .semibold))
                    .foregroundStyle(.secondary)

                ForEach(entry.holdings.prefix(3)) { stock in
                    HStack {
                        Text(stock.symbol)
                            .font(.caption.bold())
                        Spacer()
                        Text(String(format: "$%.2f", stock.price))
                            .font(.caption.monospacedDigit())
                        Text(formatPercent(stock.changePercent))
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundStyle(stock.changePercent >= 0 ? Color.macGain : Color.macLoss)
                            .frame(width: 60, alignment: .trailing)
                    }
                }
                Spacer()
            }
        }
        .redacted(reason: entry.isPlaceholder ? .placeholder : [])
    }

    // MARK: - Large

    private var largeView: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Image(systemName: "chart.pie.fill")
                    .foregroundStyle(.blue)
                Text("Portfolio")
                    .font(.headline)
                Spacer()
                Text(formatPercent(entry.dayChangePercent))
                    .font(.caption.bold())
                    .foregroundStyle(entry.dayChangePercent >= 0 ? Color.macGain : Color.macLoss)
            }

            Text(formatCurrency(entry.totalValue))
                .font(.largeTitle.bold())
                .minimumScaleFactor(0.5)

            HStack(spacing: 4) {
                Image(systemName: entry.dayChange >= 0 ? "arrow.up.right" : "arrow.down.right")
                    .font(.caption)
                Text(formatChange(entry.dayChange))
                    .font(.subheadline)
                Text("today")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            .foregroundStyle(entry.dayChange >= 0 ? Color.macGain : Color.macLoss)

            Divider()

            Text("HOLDINGS")
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(.secondary)

            ForEach(entry.holdings.prefix(5)) { stock in
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(stock.symbol)
                            .font(.subheadline.bold())
                        Text(stock.name)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                    Spacer()
                    Text(String(format: "$%.2f", stock.price))
                        .font(.subheadline.monospacedDigit())
                    Text(formatPercent(stock.changePercent))
                        .font(.caption.bold())
                        .foregroundStyle(stock.changePercent >= 0 ? Color.macGain : Color.macLoss)
                        .frame(width: 70, alignment: .trailing)
                }
                .padding(.vertical, 1)
            }

            Spacer()
        }
        .redacted(reason: entry.isPlaceholder ? .placeholder : [])
    }

    // MARK: - Formatting

    private func formatCurrency(_ value: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.maximumFractionDigits = 0
        return formatter.string(from: NSNumber(value: value)) ?? "$0"
    }

    private func formatChange(_ value: Double) -> String {
        String(format: "%@$%.2f", value >= 0 ? "+" : "", value)
    }

    private func formatPercent(_ value: Double) -> String {
        String(format: "%@%.2f%%", value >= 0 ? "+" : "", value)
    }
}

extension Color {
    static let macGain = Color(red: 48/255, green: 209/255, blue: 88/255)
    static let macLoss = Color(red: 255/255, green: 69/255, blue: 58/255)
}
