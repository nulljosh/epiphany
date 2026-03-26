import WidgetKit
import SwiftUI

struct MarketsWidget: Widget {
    let kind = "MarketsWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: MarketsProvider()) { entry in
            MarketsWidgetView(entry: entry)
                .containerBackground(.fill.tertiary, for: .widget)
        }
        .configurationDisplayName("Markets")
        .description("Major indices, commodities, and crypto at a glance.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge, .accessoryInline])
    }
}

struct MarketsWidgetView: View {
    @Environment(\.widgetFamily) var family
    let entry: MarketsEntry

    var body: some View {
        switch family {
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

    private var accessoryInlineView: some View {
        let sp = entry.markets.first { $0.name == "S&P 500" }
        return HStack(spacing: 4) {
            Text("S&P")
            if let sp {
                Text(String(format: "%@%.1f%%", sp.changePercent >= 0 ? "+" : "", sp.changePercent))
            }
        }
    }

    // MARK: - Small

    private var smallView: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Image(systemName: "chart.bar.fill")
                    .foregroundStyle(.blue)
                Text("Markets")
                    .font(.caption.bold())
                    .foregroundStyle(.secondary)
            }

            Spacer()

            ForEach(entry.markets.prefix(2), id: \.name) { market in
                marketRow(market)
            }

            Spacer()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .redacted(reason: entry.isPlaceholder ? .placeholder : [])
    }

    // MARK: - Medium

    private var mediumView: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Image(systemName: "chart.bar.fill")
                    .foregroundStyle(.blue)
                Text("Markets")
                    .font(.caption.bold())
                    .foregroundStyle(.secondary)
                Spacer()
                Text(entry.date, style: .time)
                    .font(.system(size: 9))
                    .foregroundStyle(.secondary)
            }

            Spacer()

            let columns = Array(entry.markets.prefix(5))
            let half = (columns.count + 1) / 2
            HStack(alignment: .top, spacing: 16) {
                VStack(alignment: .leading, spacing: 6) {
                    ForEach(columns.prefix(half), id: \.name) { market in
                        marketRow(market)
                    }
                }
                VStack(alignment: .leading, spacing: 6) {
                    ForEach(columns.dropFirst(half), id: \.name) { market in
                        marketRow(market)
                    }
                }
            }

            Spacer()
        }
        .redacted(reason: entry.isPlaceholder ? .placeholder : [])
    }

    // MARK: - Large

    private var largeView: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: "chart.bar.fill")
                    .foregroundStyle(.blue)
                Text("Markets")
                    .font(.headline)
                Spacer()
                Text(entry.date, style: .time)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Divider()

            ForEach(entry.markets, id: \.name) { market in
                HStack {
                    Text(market.name)
                        .font(.subheadline)
                    Spacer()
                    Text(formatPrice(market.price))
                        .font(.subheadline.monospacedDigit())
                    Text(String(format: "%@%.2f%%", market.changePercent >= 0 ? "+" : "", market.changePercent))
                        .font(.caption.bold())
                        .foregroundStyle(market.changePercent >= 0 ? Color.widgetGain : Color.widgetLoss)
                        .frame(width: 70, alignment: .trailing)
                }
                .padding(.vertical, 2)
            }

            Spacer()
        }
        .redacted(reason: entry.isPlaceholder ? .placeholder : [])
    }

    // MARK: - Helpers

    private func marketRow(_ market: MarketEntry) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(market.name)
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(.secondary)
            HStack(spacing: 4) {
                Text(formatPrice(market.price))
                    .font(.caption.bold().monospacedDigit())
                Text(String(format: "%@%.1f%%", market.changePercent >= 0 ? "+" : "", market.changePercent))
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(market.changePercent >= 0 ? Color.widgetGain : Color.widgetLoss)
            }
        }
    }

    private func formatPrice(_ value: Double) -> String {
        if value >= 10000 { return String(format: "$%.0f", value) }
        return String(format: "$%.2f", value)
    }
}
