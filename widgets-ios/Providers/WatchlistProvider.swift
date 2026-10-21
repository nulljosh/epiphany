import WidgetKit
import SwiftUI

struct WatchlistEntry: TimelineEntry {
    let date: Date
    let stocks: [WidgetStock]
    let isPlaceholder: Bool

    static var placeholder: WatchlistEntry {
        WatchlistEntry(
            date: .now,
            stocks: [
                WidgetStock(symbol: "AAPL", name: "Apple", price: 178.72, change: 2.15, changePercent: 1.22),
                WidgetStock(symbol: "MSFT", name: "Microsoft", price: 378.91, change: -1.23, changePercent: -0.32),
                WidgetStock(symbol: "GOOGL", name: "Alphabet", price: 141.80, change: 0.95, changePercent: 0.67),
                WidgetStock(symbol: "AMZN", name: "Amazon", price: 178.25, change: 3.12, changePercent: 1.78),
                WidgetStock(symbol: "NVDA", name: "NVIDIA", price: 875.28, change: 12.45, changePercent: 1.44),
            ],
            isPlaceholder: true
        )
    }
}

struct WatchlistProvider: TimelineProvider {
    private let defaultSymbols = ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "TSLA", "META", "JPM", "V", "UNH"]
    /// The user's watchlist from the app, or the defaults before they sign in.
    private var symbols: [String] {
        let mine = WidgetAPI.watchlistSymbols
        return mine.isEmpty ? defaultSymbols : mine
    }

    func placeholder(in context: Context) -> WatchlistEntry {
        .placeholder
    }

    func getSnapshot(in context: Context, completion: @escaping (WatchlistEntry) -> Void) {
        if context.isPreview {
            completion(.placeholder)
            return
        }
        let wanted = symbols
        let cached = (WidgetAPI.cachedWatchlistStocks() + WidgetAPI.cachedStocks()).filter { wanted.contains($0.symbol) }
        completion(WatchlistEntry(date: .now, stocks: cached, isPlaceholder: false))
    }

    func getTimeline(in context: Context, completion: @escaping @Sendable (Timeline<WatchlistEntry>) -> Void) {
        Task {
            let wanted = symbols
            let all: [WidgetStock]
            do {
                all = try await WidgetAPI.fetchStocks(symbols: wanted)
            } catch {
                all = WidgetAPI.cachedWatchlistStocks() + WidgetAPI.cachedStocks()
            }

            // Keep the user's order and drop duplicates from the two caches.
            var seen = Set<String>()
            let filtered = wanted.compactMap { sym in all.first { $0.symbol == sym } }.filter { seen.insert($0.symbol).inserted }
            let entry = WatchlistEntry(date: .now, stocks: filtered, isPlaceholder: false)
            let nextUpdate = Calendar.current.date(byAdding: .minute, value: 15, to: .now)!
            completion(Timeline(entries: [entry], policy: .after(nextUpdate)))
        }
    }
}
