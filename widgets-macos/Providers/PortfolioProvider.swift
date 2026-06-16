import WidgetKit
import SwiftUI

struct PortfolioEntry: TimelineEntry {
    let date: Date
    let totalValue: Double
    let dayChange: Double
    let dayChangePercent: Double
    let holdings: [WidgetStock]
    let isPlaceholder: Bool

    static var placeholder: PortfolioEntry {
        PortfolioEntry(
            date: .now,
            totalValue: 48523.17,
            dayChange: 312.45,
            dayChangePercent: 0.65,
            holdings: [
                WidgetStock(symbol: "AAPL", name: "Apple", price: 178.72, change: 2.15, changePercent: 1.22),
                WidgetStock(symbol: "MSFT", name: "Microsoft", price: 378.91, change: -1.23, changePercent: -0.32),
                WidgetStock(symbol: "NVDA", name: "NVIDIA", price: 875.28, change: 12.45, changePercent: 1.44),
            ],
            isPlaceholder: true
        )
    }
}

struct PortfolioProvider: TimelineProvider {
    func placeholder(in context: Context) -> PortfolioEntry {
        .placeholder
    }

    func getSnapshot(in context: Context, completion: @escaping (PortfolioEntry) -> Void) {
        if context.isPreview {
            completion(.placeholder)
            return
        }
        let cached = WidgetAPI.cachedStocks()
        let entry = buildEntry(from: cached)
        completion(entry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<PortfolioEntry>) -> Void) {
        Task {
            let stocks: [WidgetStock]
            do {
                stocks = try await WidgetAPI.fetchStocks()
            } catch {
                stocks = WidgetAPI.cachedStocks()
            }

            let entry = buildEntry(from: stocks)
            let nextUpdate = Calendar.current.date(byAdding: .minute, value: 15, to: .now)!
            completion(Timeline(entries: [entry], policy: .after(nextUpdate)))
        }
    }

    private func buildEntry(from stocks: [WidgetStock]) -> PortfolioEntry {
        let total = stocks.reduce(0) { $0 + $1.price }
        let change = stocks.reduce(0) { $0 + $1.change }
        let pct = total > 0 ? (change / (total - change)) * 100 : 0
        return PortfolioEntry(
            date: .now,
            totalValue: total,
            dayChange: change,
            dayChangePercent: pct,
            holdings: Array(stocks.prefix(5)),
            isPlaceholder: false
        )
    }
}
