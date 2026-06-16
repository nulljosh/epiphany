import WidgetKit
import SwiftUI

struct MarketsEntry: TimelineEntry {
    let date: Date
    let markets: [MarketEntry]
    let isPlaceholder: Bool

    static var placeholder: MarketsEntry {
        MarketsEntry(
            date: .now,
            markets: [
                MarketEntry(name: "S&P 500", price: 5234.18, changePercent: 0.47),
                MarketEntry(name: "Nasdaq", price: 16428.82, changePercent: 0.62),
                MarketEntry(name: "Dow Jones", price: 39872.99, changePercent: 0.23),
                MarketEntry(name: "Gold", price: 2338.50, changePercent: -0.15),
                MarketEntry(name: "Bitcoin", price: 67842.00, changePercent: 2.31),
            ],
            isPlaceholder: true
        )
    }
}

struct MarketsProvider: TimelineProvider {
    private let indexSymbols = ["SPY", "QQQ", "DIA"]
    private let indexNames: [String: String] = [
        "SPY": "S&P 500",
        "QQQ": "Nasdaq",
        "DIA": "Dow Jones"
    ]

    func placeholder(in context: Context) -> MarketsEntry {
        .placeholder
    }

    func getSnapshot(in context: Context, completion: @escaping (MarketsEntry) -> Void) {
        if context.isPreview {
            completion(.placeholder)
            return
        }
        let entries = buildEntries(
            stocks: WidgetAPI.cachedStocks(),
            commodities: WidgetAPI.cachedCommodities(),
            crypto: WidgetAPI.cachedCrypto()
        )
        completion(MarketsEntry(date: .now, markets: entries, isPlaceholder: false))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<MarketsEntry>) -> Void) {
        Task {
            var stocks: [WidgetStock] = []
            var commodities: [WidgetCommodity] = []
            var crypto: [WidgetCrypto] = []

            do { stocks = try await WidgetAPI.fetchStocks() } catch { stocks = WidgetAPI.cachedStocks() }
            do { commodities = try await WidgetAPI.fetchCommodities() } catch { commodities = WidgetAPI.cachedCommodities() }
            do { crypto = try await WidgetAPI.fetchCrypto() } catch { crypto = WidgetAPI.cachedCrypto() }

            let entries = buildEntries(stocks: stocks, commodities: commodities, crypto: crypto)
            let entry = MarketsEntry(date: .now, markets: entries, isPlaceholder: false)
            let nextUpdate = Calendar.current.date(byAdding: .minute, value: 15, to: .now)!
            completion(Timeline(entries: [entry], policy: .after(nextUpdate)))
        }
    }

    private func buildEntries(stocks: [WidgetStock], commodities: [WidgetCommodity], crypto: [WidgetCrypto]) -> [MarketEntry] {
        var result: [MarketEntry] = []

        for symbol in indexSymbols {
            if let stock = stocks.first(where: { $0.symbol == symbol }) {
                result.append(MarketEntry(name: indexNames[symbol] ?? symbol, price: stock.price, changePercent: stock.changePercent))
            }
        }

        if let gold = commodities.first(where: { $0.name.lowercased() == "gold" }) {
            result.append(MarketEntry(name: "Gold", price: gold.price, changePercent: gold.changePercent))
        }

        if let btc = crypto.first(where: { $0.symbol == "BTC" }) {
            result.append(MarketEntry(name: "Bitcoin", price: btc.spot, changePercent: btc.chgPct))
        }

        return result
    }
}
