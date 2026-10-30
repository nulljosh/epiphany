import SwiftUI

/// Your position in one symbol, summed across accounts. Mirrors position in allocation.js.
/// Cost and total gain stay nil for broker rows with no cost basis.
struct Position: Equatable {
    let shares, value, today: Double
    let avgCost, gain, gainPercent: Double?

    static func make(_ holdings: [FinanceData.Holding], symbol: String, price: Double, changePercent: Double) -> Position? {
        let rows = holdings.filter { $0.symbol == symbol && $0.shares > 0 }
        guard !rows.isEmpty, price > 0 else { return nil }
        let shares = rows.reduce(0) { $0 + $1.shares }
        let value = shares * price
        let today = Allocation.todayGain(value, changePercent: changePercent)
        guard rows.allSatisfy({ $0.costBasis > 0 }) else {
            return Position(shares: shares, value: value, today: today, avgCost: nil, gain: nil, gainPercent: nil)
        }
        let cost = rows.reduce(0) { $0 + $1.shares * $1.costBasis }
        return Position(shares: shares, value: value, today: today, avgCost: cost / shares,
                        gain: value - cost, gainPercent: (value - cost) / cost * 100)
    }
}

/// "Your Position" card on a stock's page; nothing when you don't hold it.
struct PositionCard: View {
    let stock: Stock
    @Environment(AppState.self) private var appState

    var body: some View {
        if let p = Position.make(appState.financeData?.holdings ?? [], symbol: stock.symbol,
                                 price: stock.price, changePercent: stock.changePercent) {
            VStack(alignment: .leading, spacing: 10) {
                Text("Your Position").font(.headline)
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], alignment: .leading, spacing: 12) {
                    cell("Shares", p.shares.formatted(.number.precision(.fractionLength(0...6))))
                    cell("Value", CurrencyFormatter.formatPrice(p.value))
                    cell("Avg Cost", p.avgCost.map { CurrencyFormatter.formatPrice($0) } ?? "—")
                    cell("Today", CurrencyFormatter.formatSignedPrice(p.today), tint: p.today)
                    cell("Total Gain", p.gain.map(CurrencyFormatter.formatSignedPrice) ?? "—", tint: p.gain)
                    cell("Return", p.gainPercent.map { String(format: "%+.2f%%", $0) } ?? "—", tint: p.gainPercent)
                }
            }
            .padding()
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 12))
            .padding(.horizontal)
        }
    }

    private func cell(_ label: String, _ value: String, tint: Double? = nil) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label).font(.caption2).foregroundStyle(.secondary)
            Text(value)
                .font(.caption.weight(.medium))
                .monospacedDigit()
                .foregroundStyle(tint.map { $0 >= 0 ? Palette.successGreen : Palette.dangerRed } ?? .primary)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// A stock's P/E against the S&P 500's (SPY's), as one plain line. Mirrors valuationLine in allocation.js.
enum Valuation {
    static func line(pe: Double?, market: Double?) -> String? {
        guard let pe, pe > 0, let market, market > 0 else { return nil }
        let diff = Int((pe / market - 1) * 100 + (pe >= market ? 0.5 : -0.5))
        let place = abs(diff) < 5 ? "about level with" : "\(abs(diff))% \(diff > 0 ? "above" : "below")"
        return "P/E \(String(format: "%.1f", pe)) is \(place) the S&P 500's \(String(format: "%.1f", market))"
    }
}

/// The valuation line under a stock's stats; nothing for SPY itself or without both P/Es.
struct ValuationLine: View {
    let stock: Stock
    @Environment(AppState.self) private var appState

    var body: some View {
        if stock.symbol != "SPY", let text = Valuation.line(pe: stock.peRatio, market: appState.stocks.first { $0.symbol == "SPY" }?.peRatio) {
            Text(text).font(.footnote).foregroundStyle(.secondary).padding(.horizontal)
        }
    }
}
