import SwiftUI

/// Today's move per sector, the plain average of its stocks' percent change. Same map and order as the web
/// (`SECTOR_MAP` in src/hooks/useStocks.js), minus funds, futures and the VIX.
/// ponytail: equal weight, not cap weight; weight by marketCap if a megacap day reads wrong.
enum SectorHeat {
    static let order = ["Tech", "Financials", "Healthcare", "Energy", "Industrials", "Consumer", "Telecom", "Utilities", "REITs"]
    static let members: [String: [String]] = [
        "Tech": ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "AVGO", "AMD", "ADBE", "CRM", "NFLX", "CSCO", "ORCL", "ACN", "INTC", "TXN", "QCOM", "INTU", "IBM", "PLTR", "COIN", "HOOD", "HIMS", "SHOP", "RKLB", "SOFI", "XYZ", "APP", "DUOL", "DELL", "PENG", "SNDK", "IREN", "MU", "NBIS", "CRDO"],
        "Financials": ["BRK-B", "V", "JPM", "MA", "BAC", "GS", "MS", "C", "WFC", "BLK", "SCHW", "AXP", "SPGI", "CME", "RY", "TD", "BNS", "BMO", "CM"],
        "Healthcare": ["LLY", "UNH", "JNJ", "MRK", "ABBV", "TMO", "DHR", "PFE", "AMGN", "BMY", "MDT", "BSX", "ELV", "CVS", "MRNA"],
        "Energy": ["XOM", "CVX"],
        "Industrials": ["HD", "COST", "UNP", "RTX", "HON", "UPS", "FDX", "BA", "CAT", "DE", "LMT", "GE", "WM", "KODK"],
        "Consumer": ["SHOO", "WMT", "PG", "KO", "PEP", "NKE", "PM", "DIS", "TGT", "LOW", "SBUX", "MCD", "YUM", "F", "GM", "RL"],
        "Telecom": ["CMCSA", "VZ", "T", "TMUS"],
        "Utilities": ["NEE", "DUK", "SO"],
        "REITs": ["AMT", "PLD"],
    ]
    private static let sectorOf: [String: String] = Dictionary(
        members.flatMap { sector, symbols in symbols.map { ($0, sector) } }, uniquingKeysWith: { a, _ in a })

    struct Move: Equatable { let sector: String; let change: Double; let count: Int }

    static func moves(_ stocks: [Stock]) -> [Move] {
        var sums: [String: (Double, Int)] = [:]
        for stock in stocks where stock.changePercent.isFinite {
            guard let sector = sectorOf[stock.symbol] else { continue }
            let s = sums[sector, default: (0, 0)]
            sums[sector] = (s.0 + stock.changePercent, s.1 + 1)
        }
        return order.compactMap { name in sums[name].map { Move(sector: name, change: $0.0 / Double($0.1), count: $0.1) } }
    }

    /// A 3 percent day is full colour.
    static func alpha(_ change: Double) -> Double { min(abs(change) / 3, 1) * 0.7 + 0.12 }
}

/// One tile per sector, green or red by today's average move.
struct SectorHeatGrid: View {
    let stocks: [Stock]

    var body: some View {
        let moves = SectorHeat.moves(stocks)
        if moves.count > 1 {
            VStack(alignment: .leading, spacing: 8) {
                Text("Sectors")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.secondary)
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 96), spacing: 6)], spacing: 6) {
                    ForEach(moves, id: \.sector) { move in
                        VStack(alignment: .leading, spacing: 2) {
                            Text(move.sector).font(.footnote.weight(.semibold)).lineLimit(1)
                            Text(String(format: "%+.2f%%", move.change)).font(.footnote.monospacedDigit())
                        }
                        .padding(.horizontal, 8)
                        .padding(.vertical, 10)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background((move.change >= 0 ? Palette.successGreen : Palette.dangerRed).opacity(SectorHeat.alpha(move.change)),
                                    in: RoundedRectangle(cornerRadius: 8, style: .continuous))
                        .accessibilityElement(children: .combine)
                        .accessibilityHint("\(move.count) stocks")
                    }
                }
            }
        }
    }
}
