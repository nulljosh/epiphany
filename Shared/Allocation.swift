import Charts
import SwiftUI

/// Stocks, crypto and cash for the allocation donut. Mirrors src/utils/allocation.js.
/// ponytail: crypto by symbol shape ("BTC-USD") plus the big coin tickers; no funds bucket until
/// holdings carry an asset type.
enum Allocation {
    private static let coins: Set<String> = ["BTC", "ETH", "SOL", "DOGE", "XRP", "ADA", "LTC", "AVAX", "DOT", "LINK"]

    static func isCrypto(_ symbol: String) -> Bool {
        symbol.range(of: "-(USD|CAD|USDT)$", options: [.regularExpression, .caseInsensitive]) != nil
            || coins.contains(symbol.uppercased())
    }

    /// Listing currency by suffix. Mirrors isCad in src/utils/allocation.js.
    static func isCad(_ symbol: String) -> Bool {
        symbol.range(of: "\\.(TO|V|NE|CN)$|-CAD$", options: [.regularExpression, .caseInsensitive]) != nil
    }

    /// Holdings filter chips. ponytail: no ETF chip until holdings carry an asset type.
    static func passes(_ symbol: String, _ filter: String) -> Bool {
        switch filter {
        case "Stocks": !isCrypto(symbol)
        case "Crypto": isCrypto(symbol)
        case "CAD": isCad(symbol)
        case "USD": !isCad(symbol)
        default: true
        }
    }

    /// "All" plus each chip that actually splits the list.
    static func filterNames(_ holdings: [Portfolio.Holding]) -> [String] {
        ["All"] + ["Stocks", "Crypto", "CAD", "USD"].filter { f in
            let n = holdings.filter { passes($0.symbol, f) }.count
            return n > 0 && n < holdings.count
        }
    }

    /// Estimated yearly dividends: value times trailing yield. Mirrors yearlyDividends in src/utils/allocation.js.
    static func yearlyDividends(_ holdings: [Portfolio.Holding], stocks: [Stock]) -> Double {
        let yields = Dictionary(stocks.compactMap { s in s.yield.map { (s.symbol, $0) } }, uniquingKeysWith: { a, _ in a })
        return holdings.reduce(0) { sum, h in
            guard h.marketValue > 0, let y = yields[h.symbol], y > 0 else { return sum }
            return sum + h.marketValue * y / 100
        }
    }

    /// Today's move in dollars for a value that moved `changePercent` today. Mirrors todayGain in allocation.js.
    static func todayGain(_ value: Double, changePercent: Double) -> Double {
        changePercent > -100 ? value - value / (1 + changePercent / 100) : 0
    }

    /// The holding that's over `limit` of the holdings' value, if any (two or more holdings). Mirrors concentration in allocation.js.
    static func concentration(_ holdings: [Portfolio.Holding], limit: Double = 0.25) -> (symbol: String, share: Double)? {
        let live = holdings.filter { $0.marketValue > 0 }
        guard live.count > 1, let top = live.max(by: { $0.marketValue < $1.marketValue }) else { return nil }
        let share = top.marketValue / live.reduce(0) { $0 + $1.marketValue }
        return share > limit ? (top.symbol, share) : nil
    }

    /// "AAPL is 41% of your holdings" under the list, in amber.
    @ViewBuilder static func concentrationRow(_ holdings: [Portfolio.Holding]) -> some View {
        if let c = concentration(holdings) {
            Divider().padding(.horizontal)
            Text("\(c.symbol) is \(Int((c.share * 100).rounded()))% of your holdings")
                .font(.subheadline)
                .foregroundStyle(Palette.warningAmber)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal)
                .padding(.vertical, 8)
        }
    }

    /// Unrealized gain over holdings with a cost basis (broker rows without one are skipped). Mirrors unrealizedGain in allocation.js.
    static func unrealizedGain(_ holdings: [Portfolio.Holding]) -> (gain: Double, percent: Double)? {
        let known = holdings.filter { $0.avgCost > 0 && $0.shares > 0 }
        let cost = known.reduce(0) { $0 + $1.avgCost * $1.shares }
        guard cost > 0 else { return nil }
        let gain = known.reduce(0) { $0 + $1.gainLoss }
        return (gain, gain / cost * 100)
    }

    /// Unrealized gain row under the holdings; nothing when no holding has a cost basis.
    @ViewBuilder static func gainRow(_ holdings: [Portfolio.Holding]) -> some View {
        if let u = unrealizedGain(holdings) {
            Divider().padding(.horizontal)
            HStack {
                Text("Unrealized gain").foregroundStyle(.secondary)
                Spacer()
                Text("\(CurrencyFormatter.formatSignedPrice(u.gain)) (\(String(format: "%+.1f%%", u.percent)))")
                    .fontWeight(.semibold)
                    .monospacedDigit()
                    .foregroundStyle(u.gain >= 0 ? Palette.successGreen : Palette.dangerRed)
            }
            .font(.subheadline)
            .padding(.horizontal)
            .padding(.vertical, 10)
        }
    }

    static func slices(holdings: [Portfolio.Holding], cash: Double) -> [(label: String, value: Double)] {
        let values = holdings.filter { $0.marketValue > 0 }
        let crypto = values.filter { isCrypto($0.symbol) }.reduce(0) { $0 + $1.marketValue }
        let stocks = values.reduce(0) { $0 + $1.marketValue } - crypto
        return [("Stocks", stocks), ("Crypto", crypto), ("Cash", cash)].filter { $0.1 > 0 }
    }
}

/// The portfolio as a donut by asset class, with each share beside it. Hidden with fewer than two classes.
struct AllocationDonut: View {
    let slices: [(label: String, value: Double)]
    private static let colors: [String: Color] = ["Stocks": Palette.appleBlue, "Crypto": Palette.warningAmber, "Cash": Palette.successGreen]

    var body: some View {
        let total = slices.reduce(0) { $0 + $1.value }
        if slices.count > 1, total > 0 {
            HStack(spacing: 20) {
                Chart(slices, id: \.label) { slice in
                    SectorMark(angle: .value("Value", slice.value), innerRadius: .ratio(0.62), angularInset: 1.5)
                        .foregroundStyle(Self.colors[slice.label] ?? .gray)
                }
                .frame(width: 96, height: 96)
                VStack(alignment: .leading, spacing: 6) {
                    ForEach(slices, id: \.label) { slice in
                        HStack(spacing: 8) {
                            Circle().fill(Self.colors[slice.label] ?? .gray).frame(width: 8, height: 8)
                            Text(slice.label).font(.subheadline)
                            Spacer()
                            Text(String(format: "%.0f%%", slice.value / total * 100))
                                .font(.subheadline.weight(.semibold).monospacedDigit())
                        }
                    }
                }
            }
        }
    }
}
