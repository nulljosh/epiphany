import SwiftUI

struct PortfolioGlance: View {
    @State private var stocks: [WatchStock] = []
    @State private var isLoading = true

    private var portfolioValue: Double {
        stocks.reduce(0) { $0 + $1.price }
    }

    private var dayChange: Double {
        stocks.reduce(0) { $0 + $1.change }
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 8) {
                Text("PORTFOLIO")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)

                if isLoading {
                    ProgressView()
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    VStack(spacing: 4) {
                        Text(formatCurrency(portfolioValue))
                            .font(.title2.bold())
                            .foregroundStyle(.primary)

                        HStack(spacing: 4) {
                            Image(systemName: dayChange >= 0 ? "arrow.up.right" : "arrow.down.right")
                                .font(.caption2)
                            Text(formatChange(dayChange))
                                .font(.caption)
                        }
                        .foregroundStyle(dayChange >= 0 ? Color.gain : Color.loss)
                    }
                    .frame(maxWidth: .infinity)

                    Divider()

                    Text("TOP HOLDINGS")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity, alignment: .leading)

                    ForEach(stocks.prefix(5)) { stock in
                        HStack {
                            Text(stock.symbol)
                                .font(.caption.bold())
                            Spacer()
                            VStack(alignment: .trailing, spacing: 1) {
                                Text(formatPrice(stock.price))
                                    .font(.caption2)
                                Text(formatPercent(stock.changePercent))
                                    .font(.caption2)
                                    .foregroundStyle(stock.changePercent >= 0 ? Color.gain : Color.loss)
                            }
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
        if let cached = WatchAPI.shared.cachedStocks() {
            stocks = cached
            isLoading = false
        }
        do {
            stocks = try await WatchAPI.shared.fetchStocks()
        } catch {
            // Keep cached data on failure
        }
        isLoading = false
    }

    private func formatCurrency(_ value: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.maximumFractionDigits = 0
        return formatter.string(from: NSNumber(value: value)) ?? "$0"
    }

    private func formatPrice(_ value: Double) -> String {
        String(format: "$%.2f", value)
    }

    private func formatChange(_ value: Double) -> String {
        String(format: "%@$%.2f", value >= 0 ? "+" : "", value)
    }

    private func formatPercent(_ value: Double) -> String {
        String(format: "%@%.2f%%", value >= 0 ? "+" : "", value)
    }
}

extension Color {
    static let gain = Color(red: 48/255, green: 209/255, blue: 88/255)   // #30D158
    static let loss = Color(red: 255/255, green: 69/255, blue: 58/255)   // #FF453A
}
