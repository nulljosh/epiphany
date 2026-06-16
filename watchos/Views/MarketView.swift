import SwiftUI

struct MarketView: View {
    @State private var stocks: [WatchStock] = []
    @State private var commodities: [WatchCommodity] = []
    @State private var crypto: [WatchCrypto] = []
    @State private var isLoading = true

    private let indexSymbols = ["SPY", "QQQ", "DIA"]
    private let indexNames: [String: String] = [
        "SPY": "S&P 500",
        "QQQ": "Nasdaq",
        "DIA": "Dow Jones"
    ]

    var body: some View {
        ScrollView {
            VStack(spacing: 8) {
                Text("MARKETS")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)

                if isLoading {
                    ProgressView()
                        .frame(maxWidth: .infinity)
                } else {
                    // Indices
                    let indices = stocks.filter { indexSymbols.contains($0.symbol) }
                    ForEach(indices) { stock in
                        MarketRow(
                            name: indexNames[stock.symbol] ?? stock.symbol,
                            price: formatPrice(stock.price),
                            change: stock.changePercent,
                            isPercent: true
                        )
                    }

                    if !commodities.isEmpty {
                        Divider()
                        Text("COMMODITIES")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                            .frame(maxWidth: .infinity, alignment: .leading)

                        ForEach(commodities.prefix(3)) { commodity in
                            MarketRow(
                                name: commodity.name,
                                price: formatPrice(commodity.price),
                                change: commodity.changePercent,
                                isPercent: true
                            )
                        }
                    }

                    if !crypto.isEmpty {
                        Divider()
                        Text("CRYPTO")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                            .frame(maxWidth: .infinity, alignment: .leading)

                        ForEach(crypto.prefix(3)) { coin in
                            MarketRow(
                                name: coin.symbol,
                                price: formatPrice(coin.spot),
                                change: coin.chgPct,
                                isPercent: true
                            )
                        }
                    }
                }
            }
            .padding(.horizontal, 4)
        }
        .task {
            await loadData()
        }
    }

    private func loadData() async {
        // Load cached first
        if let cached = WatchAPI.shared.cachedStocks() { stocks = cached }
        if let cached = WatchAPI.shared.cachedCommodities() { commodities = cached }
        if let cached = WatchAPI.shared.cachedCrypto() { crypto = cached }
        if !stocks.isEmpty { isLoading = false }

        async let fetchedStocks = WatchAPI.shared.fetchStocks()
        async let fetchedCommodities = WatchAPI.shared.fetchCommodities()
        async let fetchedCrypto = WatchAPI.shared.fetchCrypto()

        do { stocks = try await fetchedStocks } catch {}
        do { commodities = try await fetchedCommodities } catch {}
        do { crypto = try await fetchedCrypto } catch {}
        isLoading = false
    }

    private func formatPrice(_ value: Double) -> String {
        if value >= 10000 {
            return String(format: "$%.0f", value)
        }
        return String(format: "$%.2f", value)
    }
}

struct MarketRow: View {
    let name: String
    let price: String
    let change: Double
    let isPercent: Bool

    var body: some View {
        HStack {
            Text(name)
                .font(.caption.bold())
                .lineLimit(1)
            Spacer()
            VStack(alignment: .trailing, spacing: 1) {
                Text(price)
                    .font(.caption2)
                Text(String(format: "%@%.2f%%", change >= 0 ? "+" : "", change))
                    .font(.caption2)
                    .foregroundStyle(change >= 0 ? Color.gain : Color.loss)
            }
        }
    }
}
