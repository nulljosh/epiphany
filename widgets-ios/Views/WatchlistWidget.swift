import WidgetKit
import SwiftUI

struct WatchlistWidget: Widget {
    let kind = "WatchlistWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: WatchlistProvider()) { entry in
            WatchlistWidgetView(entry: entry)
                .containerBackground(.fill.tertiary, for: .widget)
        }
        .configurationDisplayName("Watchlist")
        .description("Your watched stocks at a glance.")
        .supportedFamilies([.systemMedium, .systemLarge])
    }
}

struct WatchlistWidgetView: View {
    @Environment(\.widgetFamily) var family
    let entry: WatchlistEntry

    var body: some View {
        switch family {
        case .systemMedium:
            mediumView
        case .systemLarge:
            largeView
        default:
            mediumView
        }
    }

    // MARK: - Medium

    private var mediumView: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Image(systemName: "star.fill")
                    .foregroundStyle(.yellow)
                Text("Watchlist")
                    .font(.caption.bold())
                    .foregroundStyle(.secondary)
                Spacer()
                Text(entry.date, style: .time)
                    .font(.system(size: 9))
                    .foregroundStyle(.secondary)
            }

            Spacer()

            ForEach(entry.stocks.prefix(5)) { stock in
                stockRow(stock, compact: true)
            }

            Spacer()
        }
        .redacted(reason: entry.isPlaceholder ? .placeholder : [])
    }

    // MARK: - Large

    private var largeView: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Image(systemName: "star.fill")
                    .foregroundStyle(.yellow)
                Text("Watchlist")
                    .font(.headline)
                Spacer()
                Text(entry.date, style: .time)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Divider()

            ForEach(entry.stocks.prefix(10)) { stock in
                stockRow(stock, compact: false)
            }

            Spacer()
        }
        .redacted(reason: entry.isPlaceholder ? .placeholder : [])
    }

    // MARK: - Row

    private func stockRow(_ stock: WidgetStock, compact: Bool) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 1) {
                Text(stock.symbol)
                    .font(compact ? .caption.bold() : .subheadline.bold())
                if !compact {
                    Text(stock.name)
                        .font(.system(size: 10))
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            }
            Spacer()
            Text(String(format: "$%.2f", stock.price))
                .font(compact ? .caption.monospacedDigit() : .subheadline.monospacedDigit())
            Text(String(format: "%@%.2f%%", stock.changePercent >= 0 ? "+" : "", stock.changePercent))
                .font(compact ? .system(size: 10, weight: .semibold) : .caption.bold())
                .foregroundStyle(stock.changePercent >= 0 ? Color.widgetGain : Color.widgetLoss)
                .frame(width: compact ? 55 : 70, alignment: .trailing)
        }
        .padding(.vertical, compact ? 1 : 2)
    }
}
