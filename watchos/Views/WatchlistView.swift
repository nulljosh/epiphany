import SwiftUI

struct WatchlistView: View {
    @State private var stocks: [WatchStock] = []
    @State private var isLoading = true

    // Default watchlist symbols for free tier (no auth)
    private let watchlistSymbols = ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "TSLA", "META"]

    var body: some View {
        ScrollView {
            VStack(spacing: 8) {
                Text("WATCHLIST")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)

                if isLoading {
                    ProgressView()
                        .frame(maxWidth: .infinity)
                } else if stocks.isEmpty {
                    Text("No data available")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity)
                } else {
                    ForEach(stocks) { stock in
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
                                    .font(.caption2)
                                Text(String(format: "%@%.2f%%", stock.changePercent >= 0 ? "+" : "", stock.changePercent))
                                    .font(.caption2)
                                    .foregroundStyle(stock.changePercent >= 0 ? Color.gain : Color.loss)
                            }
                        }
                        .padding(.vertical, 2)
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
        if let cached = WatchAPI.shared.cachedStocks() {
            stocks = cached.filter { watchlistSymbols.contains($0.symbol) }
            isLoading = false
        }
        do {
            let all = try await WatchAPI.shared.fetchStocks()
            stocks = all.filter { watchlistSymbols.contains($0.symbol) }
        } catch {}
        isLoading = false
    }
}
