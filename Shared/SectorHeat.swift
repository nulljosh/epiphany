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

    struct Slice: Equatable { let sector: String; let value: Double; let share: Double }

    /// Holdings value per sector, biggest first; coins are Crypto, unmapped stocks Other. Mirrors holdingsBySector in sectors.js.
    static func holdings(_ holdings: [Portfolio.Holding]) -> [Slice] {
        var sums: [String: Double] = [:]
        for h in holdings where h.marketValue > 0 {
            // TD.TO is TD in the map: try the symbol without its Canadian exchange suffix.
            let bare = h.symbol.replacingOccurrences(of: #"\.(TO|V|NE|CN)$"#, with: "", options: [.regularExpression, .caseInsensitive])
            let sector = Allocation.isCrypto(h.symbol) ? "Crypto" : (sectorOf[h.symbol] ?? sectorOf[bare] ?? "Other")
            sums[sector, default: 0] += h.marketValue
        }
        let total = sums.values.reduce(0, +)
        return sums.map { Slice(sector: $0.key, value: $0.value, share: $0.value / total) }
            .sorted { $0.value > $1.value }
    }

    /// Holdings value by where they list: US, Canada (by symbol suffix) or Crypto. Mirrors holdingsByCountry in allocation.js.
    static func byCountry(_ holdings: [Portfolio.Holding]) -> [Slice] {
        var sums: [String: Double] = [:]
        for h in holdings where h.marketValue > 0 {
            sums[Allocation.isCrypto(h.symbol) ? "Crypto" : Allocation.isCad(h.symbol) ? "Canada" : "US", default: 0] += h.marketValue
        }
        let total = sums.values.reduce(0, +)
        return sums.map { Slice(sector: $0.key, value: $0.value, share: $0.value / total) }.sorted { $0.value > $1.value }
    }
}

/// Holdings split into named shares as bars ("By Sector", "By Country"); nothing with fewer than two.
struct SectorBars: View {
    let holdings: [Portfolio.Holding]
    var title = "By Sector"
    var split: ([Portfolio.Holding]) -> [SectorHeat.Slice] = SectorHeat.holdings

    var body: some View {
        let slices = split(holdings)
        if slices.count > 1 {
            VStack(alignment: .leading, spacing: 10) {
                Text(title).font(.headline)
                ForEach(slices, id: \.sector) { s in
                    VStack(alignment: .leading, spacing: 4) {
                        HStack {
                            Text(s.sector).fontWeight(.semibold)
                            Spacer()
                            Text("\(CurrencyFormatter.formatPrice(s.value)) · \(Int((s.share * 100).rounded()))%")
                                .foregroundStyle(.secondary).monospacedDigit()
                        }
                        .font(.subheadline)
                        GeometryReader { g in
                            ZStack(alignment: .leading) {
                                Capsule().fill(Color.primary.opacity(0.08))
                                Capsule().fill(Palette.appleBlue).frame(width: g.size.width * s.share)
                            }
                        }
                        .frame(height: 6)
                    }
                }
            }
            .padding()
            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 12))
        }
    }
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
