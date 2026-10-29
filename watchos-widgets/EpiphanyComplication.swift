import AppIntents
import SwiftUI
import WidgetKit

/// A watch face complication for one symbol you pick: price and day change, refreshed about every 15 minutes.
struct SymbolIntent: WidgetConfigurationIntent {
    static let title: LocalizedStringResource = "Symbol"
    static let description = IntentDescription("Price and day change for one stock or ETF.")

    @Parameter(title: "Symbol", default: "SPY")
    var symbol: String
}

struct QuoteEntry: TimelineEntry {
    let date: Date
    let symbol: String
    let quote: WatchStock?
}

struct QuoteProvider: AppIntentTimelineProvider {
    func placeholder(in context: Context) -> QuoteEntry {
        QuoteEntry(date: .now, symbol: "SPY", quote: WatchStock(symbol: "SPY", name: "SPY", price: 500, changePercent: 0.5))
    }

    func snapshot(for configuration: SymbolIntent, in context: Context) async -> QuoteEntry {
        await entry(for: configuration)
    }

    func timeline(for configuration: SymbolIntent, in context: Context) async -> Timeline<QuoteEntry> {
        Timeline(entries: [await entry(for: configuration)], policy: .after(.now.addingTimeInterval(15 * 60)))
    }

    func recommendations() -> [AppIntentRecommendation<SymbolIntent>] {
        ["SPY", "QQQ", "AAPL", "NVDA"].map { sym in
            let intent = SymbolIntent()
            intent.symbol = sym
            return AppIntentRecommendation(intent: intent, description: sym)
        }
    }

    private func entry(for configuration: SymbolIntent) async -> QuoteEntry {
        let symbol = configuration.symbol.trimmingCharacters(in: .whitespaces).uppercased()
        let quote = try? await WatchAPI.shared.fetchQuote(symbol: symbol)
        return QuoteEntry(date: .now, symbol: symbol, quote: quote)
    }
}

struct QuoteComplicationView: View {
    @Environment(\.widgetFamily) private var family
    let entry: QuoteEntry

    private var price: String { entry.quote.map { $0.price.formatted(.number.precision(.fractionLength(2))) } ?? "--" }
    private var percent: String {
        guard let q = entry.quote else { return "" }
        return (q.changePercent >= 0 ? "+" : "") + q.changePercent.formatted(.number.precision(.fractionLength(2))) + "%"
    }
    private var tint: Color { (entry.quote?.changePercent ?? 0) >= 0 ? .green : .red }

    var body: some View {
        switch family {
        case .accessoryInline:
            Text("\(entry.symbol) \(price) \(percent)")
        case .accessoryRectangular:
            VStack(alignment: .leading, spacing: 0) {
                Text(entry.symbol).font(.headline).widgetAccentable()
                Text(price).font(.title3.monospacedDigit())
                Text(percent).font(.caption.monospacedDigit()).foregroundStyle(tint)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        case .accessoryCorner:
            Text(percent)
                .foregroundStyle(tint)
                .widgetLabel(entry.symbol)
        default:
            VStack(spacing: 0) {
                Text(entry.symbol).font(.system(size: 10, weight: .semibold)).widgetAccentable()
                Text(percent).font(.system(size: 11, weight: .bold).monospacedDigit()).foregroundStyle(tint)
                    .minimumScaleFactor(0.6)
            }
        }
    }
}

@main
struct EpiphanyComplication: Widget {
    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: "EpiphanyQuote", intent: SymbolIntent.self, provider: QuoteProvider()) { entry in
            QuoteComplicationView(entry: entry)
                .containerBackground(.clear, for: .widget)
        }
        .configurationDisplayName("Quote")
        .description("Price and day change for one symbol.")
        .supportedFamilies([.accessoryCircular, .accessoryRectangular, .accessoryInline, .accessoryCorner])
    }
}
