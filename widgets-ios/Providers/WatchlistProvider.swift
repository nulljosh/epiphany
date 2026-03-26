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

    func placeholder(in context: Context) -> WatchlistEntry {
        .placeholder
    }

    func getSnapshot(in context: Context, completion: @escaping (WatchlistEntry) -> Void) {
        if context.isPreview {
            completion(.placeholder)
            return
        }
        let cached = WidgetAPI.cachedStocks().filter { defaultSymbols.contains($0.symbol) }
        completion(WatchlistEntry(date: .now, stocks: cached, isPlaceholder: false))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<WatchlistEntry>) -> Void) {
        Task {
            let all: [WidgetStock]
            do {
                all = try await WidgetAPI.fetchStocks()
            } catch {
                all = WidgetAPI.cachedStocks()
            }

            let filtered = all.filter { defaultSymbols.contains($0.symbol) }
            let entry = WatchlistEntry(date: .now, stocks: filtered, isPlaceholder: false)
            let nextUpdate = Calendar.current.date(byAdding: .minute, value: 15, to: .now)!
            completion(Timeline(entries: [entry], policy: .after(nextUpdate)))
        }
    }
}
