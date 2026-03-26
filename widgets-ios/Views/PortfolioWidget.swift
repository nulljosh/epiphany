import WidgetKit
import SwiftUI

struct PortfolioWidget: Widget {
    let kind = "PortfolioWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: PortfolioProvider()) { entry in
            PortfolioWidgetView(entry: entry)
                .containerBackground(.fill.tertiary, for: .widget)
        }
        .configurationDisplayName("Portfolio")
        .description("Track your portfolio value and top holdings.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge, .accessoryCircular, .accessoryInline])
    }
}

struct PortfolioWidgetView: View {
    @Environment(\.widgetFamily) var family
    let entry: PortfolioEntry

    var body: some View {
        switch family {
        case .accessoryCircular:
            accessoryCircularView
        case .accessoryInline:
            accessoryInlineView
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

    // MARK: - Lock Screen

    private var accessoryCircularView: some View {
        VStack(spacing: 1) {
            Image(systemName: "chart.pie.fill")
                .font(.caption)
            Text(shortCurrency(entry.totalValue))
                .font(.caption2.bold())
            Text(String(format: "%@%.1f%%", entry.dayChangePercent >= 0 ? "+" : "", entry.dayChangePercent))
                .font(.system(size: 8))
        }
    }

    private var accessoryInlineView: some View {
        HStack(spacing: 4) {
            Image(systemName: entry.dayChange >= 0 ? "arrow.up.right" : "arrow.down.right")
            Text("\(shortCurrency(entry.totalValue)) \(String(format: "%@%.1f%%", entry.dayChangePercent >= 0 ? "+" : "", entry.dayChangePercent))")
        }
    }

    // MARK: - Small

    private var smallView: some View {
        VStack(alignment: .leading, spacing: 6) {
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
            .foregroundStyle(entry.dayChange >= 0 ? Color.widgetGain : Color.widgetLoss)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .redacted(reason: entry.isPlaceholder ? .placeholder : [])
    }

    // MARK: - Medium

    private var mediumView: some View {
        HStack(spacing: 16) {
            VStack(alignment: .leading, spacing: 6) {
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
                .foregroundStyle(entry.dayChange >= 0 ? Color.widgetGain : Color.widgetLoss)
            }

            Divider()

            VStack(alignment: .leading, spacing: 4) {
                Text("TOP HOLDINGS")
                    .font(.system(size: 9, weight: .semibold))
                    .foregroundStyle(.secondary)

                ForEach(entry.holdings.prefix(3)) { stock in
                    HStack {
                        Text(stock.symbol)
                            .font(.caption.bold())
                        Spacer()
                        Text(formatPercent(stock.changePercent))
                            .font(.caption)
                            .foregroundStyle(stock.changePercent >= 0 ? Color.widgetGain : Color.widgetLoss)
                    }
                }
                Spacer()
            }
        }
        .redacted(reason: entry.isPlaceholder ? .placeholder : [])
    }

    // MARK: - Large

    private var largeView: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: "chart.pie.fill")
                    .foregroundStyle(.blue)
                Text("Portfolio")
                    .font(.headline)
                Spacer()
                Text(formatPercent(entry.dayChangePercent))
                    .font(.caption.bold())
                    .foregroundStyle(entry.dayChangePercent >= 0 ? Color.widgetGain : Color.widgetLoss)
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
            .foregroundStyle(entry.dayChange >= 0 ? Color.widgetGain : Color.widgetLoss)

            Divider()

            Text("HOLDINGS")
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(.secondary)

            ForEach(entry.holdings.prefix(5)) { stock in
                HStack {
                    VStack(alignment: .leading, spacing: 1) {
                        Text(stock.symbol)
                            .font(.caption.bold())
                        Text(stock.name)
                            .font(.system(size: 10))
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                    Spacer()
                    VStack(alignment: .trailing, spacing: 1) {
                        Text(String(format: "$%.2f", stock.price))
                            .font(.caption)
                        Text(formatPercent(stock.changePercent))
                            .font(.system(size: 10))
                            .foregroundStyle(stock.changePercent >= 0 ? Color.widgetGain : Color.widgetLoss)
                    }
                }
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

    private func shortCurrency(_ value: Double) -> String {
        if value >= 1_000_000 { return String(format: "$%.1fM", value / 1_000_000) }
        if value >= 1_000 { return String(format: "$%.0fK", value / 1_000) }
        return String(format: "$%.0f", value)
    }

    private func formatChange(_ value: Double) -> String {
        String(format: "%@$%.2f", value >= 0 ? "+" : "", value)
    }

    private func formatPercent(_ value: Double) -> String {
        String(format: "%@%.2f%%", value >= 0 ? "+" : "", value)
    }
}

extension Color {
    static let widgetGain = Color(red: 48/255, green: 209/255, blue: 88/255)
    static let widgetLoss = Color(red: 255/255, green: 69/255, blue: 58/255)
}
