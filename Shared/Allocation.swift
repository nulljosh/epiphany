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
