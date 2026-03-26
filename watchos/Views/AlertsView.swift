import SwiftUI

struct AlertsView: View {
    @State private var stocks: [WatchStock] = []
    @State private var isLoading = true

    // Significant movers (>3% change) serve as pseudo-alerts on free tier
    private var movers: [WatchStock] {
        stocks
            .filter { abs($0.changePercent) >= 3.0 }
            .sorted { abs($0.changePercent) > abs($1.changePercent) }
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 8) {
                Text("ALERTS")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)

                if isLoading {
                    ProgressView()
                        .frame(maxWidth: .infinity)
                } else if movers.isEmpty {
                    VStack(spacing: 4) {
                        Image(systemName: "bell.slash")
                            .font(.title3)
                            .foregroundStyle(.secondary)
                        Text("No significant moves")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.top, 20)
                } else {
                    ForEach(movers.prefix(10)) { stock in
                        HStack {
                            Image(systemName: stock.changePercent >= 0 ? "arrow.up.circle.fill" : "arrow.down.circle.fill")
                                .foregroundStyle(stock.changePercent >= 0 ? Color.gain : Color.loss)
                                .font(.caption)
                            VStack(alignment: .leading, spacing: 1) {
                                Text(stock.symbol)
                                    .font(.caption.bold())
                                Text(String(format: "$%.2f", stock.price))
                                    .font(.system(size: 10))
                                    .foregroundStyle(.secondary)
                            }
                            Spacer()
                            Text(String(format: "%@%.1f%%", stock.changePercent >= 0 ? "+" : "", stock.changePercent))
                                .font(.caption.bold())
                                .foregroundStyle(stock.changePercent >= 0 ? Color.gain : Color.loss)
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
            stocks = cached
            isLoading = false
        }
        do {
            stocks = try await WatchAPI.shared.fetchStocks()
        } catch {}
        isLoading = false
    }
}
