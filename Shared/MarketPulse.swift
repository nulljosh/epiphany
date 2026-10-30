import SwiftUI

/// The day at a glance above the list: the three big indexes as cards, then today's biggest movers.
/// The indexes are their ETFs (SPY, QQQ, DIA), which the stock list already loads.
struct MarketPulse: View {
    let stocks: [Stock]
    let sparklines: [String: [Double]]
    let onSelect: (Stock) -> Void

    private static let indexes = [("SPY", "S&P 500"), ("QQQ", "Nasdaq 100"), ("DIA", "Dow")]

    private var movers: [Stock] {
        let skip = Set(Self.indexes.map(\.0))
        return stocks.filter { !skip.contains($0.symbol) }
            .sorted { abs($0.changePercent) > abs($1.changePercent) }
            .prefix(8).map { $0 }
    }

    var body: some View {
        let bySymbol = Dictionary(stocks.map { ($0.symbol, $0) }, uniquingKeysWith: { a, _ in a })
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                ForEach(Self.indexes, id: \.0) { symbol, name in
                    if let stock = bySymbol[symbol] {
                        Button { onSelect(stock) } label: { card(stock, name: name) }
                            .buttonStyle(.plain)
                    }
                }
            }
            if !movers.isEmpty {
                Text("Top movers")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.secondary)
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(movers) { stock in
                            Button { onSelect(stock) } label: { chip(stock) }
                                .buttonStyle(.plain)
                        }
                    }
                }
                .scrollClipDisabled()
            }
            SectorHeatGrid(stocks: stocks)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
    }

    private func card(_ stock: Stock, name: String) -> some View {
        let color = tint(stock.changePercent)
        return VStack(alignment: .leading, spacing: 4) {
            Text(name).font(.caption.weight(.semibold)).lineLimit(1)
            if let data = sparklines[stock.symbol], data.count > 1 {
                SparklineChart(data: data, baseline: stock.price / (1 + stock.changePercent / 100), color: color)
                    .frame(height: 28)
            } else {
                Spacer().frame(height: 28)
            }
            Text(CurrencyFormatter.formatPrice(stock.price))
                .font(.footnote.weight(.medium).monospacedDigit())
            Text(percent(stock.changePercent))
                .font(.caption.weight(.semibold).monospacedDigit())
                .foregroundStyle(color)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.fill.quaternary, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .accessibilityElement(children: .combine)
    }

    // Own colour and format helpers: iOS and Mac name theirs differently.
    private func tint(_ change: Double) -> Color { change >= 0 ? Palette.successGreen : Palette.dangerRed }
    private func percent(_ change: Double) -> String { String(format: "%@%.2f%%", change >= 0 ? "+" : "", change) }

    private func chip(_ stock: Stock) -> some View {
        HStack(spacing: 6) {
            Text(stock.symbol).font(.footnote.weight(.semibold))
            Text(percent(stock.changePercent))
                .font(.footnote.weight(.semibold).monospacedDigit())
                .foregroundStyle(tint(stock.changePercent))
        }
        .padding(.horizontal, 12)
        .frame(height: 32)
        .background(.fill.quaternary, in: Capsule())
    }
}
