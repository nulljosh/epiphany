import SwiftUI

/// One reported quarter: EPS actual against the estimate, surprise in percent. From /api/earnings-history.
struct EarningsQuarter: Decodable, Equatable {
    let quarter: String
    let actual: Double
    let estimate: Double
    let surprise: Double?

    var beat: Bool { actual >= estimate }
    /// "Beat 6.7%", "Missed 4.5%".
    var verdict: String {
        let word = beat ? "Beat" : "Missed"
        return surprise.map { "\(word) \(String(format: "%.1f", abs($0)))%" } ?? word
    }
}

/// Analysts' mean price target, range, count and consensus. From /api/earnings-history.
struct AnalystTarget: Decodable, Equatable {
    let mean: Double
    let high: Double?
    let low: Double?
    let count: Int
    let consensus: String?

    /// "+14.2%" from today's price.
    func upside(from price: Double) -> Double { price > 0 ? (mean / price - 1) * 100 : 0 }
}

/// Open-market insider buys and sells in the last 90 days. From /api/earnings-history.
struct InsiderActivity: Decodable, Equatable {
    struct Trade: Decodable, Equatable {
        let name: String
        let role: String?
        let side: String
        let shares: Double?
        let value: Double?
        let date: String?
    }
    let buys: Int
    let sells: Int
    let bought: Double
    let sold: Double
    let recent: [Trade]
}

struct InsiderCard: View {
    let activity: InsiderActivity

    /// "$94.6M"; `.notation(.compactName)` on currency needs iOS 18.
    private func money(_ v: Double) -> String {
        let (n, unit) = v >= 1e9 ? (v / 1e9, "B") : v >= 1e6 ? (v / 1e6, "M") : v >= 1e3 ? (v / 1e3, "K") : (v, "")
        return "$" + String(format: unit.isEmpty ? "%.0f" : "%.1f", n) + unit
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Insiders, Last 90 Days").font(.headline)
            (Text("\(activity.buys) \(activity.buys == 1 ? "buy" : "buys")" + (activity.bought > 0 ? " (\(money(activity.bought)))" : "")).foregroundColor(Palette.successGreen)
             + Text(" · ")
             + Text("\(activity.sells) \(activity.sells == 1 ? "sell" : "sells")" + (activity.sold > 0 ? " (\(money(activity.sold)))" : "")).foregroundColor(Palette.dangerRed))
                .font(.subheadline.weight(.semibold))
            ForEach(Array(activity.recent.enumerated()), id: \.offset) { _, t in
                HStack(alignment: .firstTextBaseline) {
                    Text(t.name + (t.role.map { " · \($0)" } ?? "")).lineLimit(1)
                    Spacer(minLength: 8)
                    Text("\(t.side == "buy" ? "Bought" : "Sold") \(t.value.map(money) ?? "\(Int(t.shares ?? 0)) shares")" + (t.date.map { " · \($0)" } ?? ""))
                }
                .font(.caption).foregroundStyle(.secondary)
            }
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 12))
        .padding(.horizontal)
    }
}

/// Who owns the stock: institution and insider shares (0 to 1), fund count and the biggest holders. From /api/earnings-history.
struct Ownership: Decodable, Equatable {
    struct Holder: Decodable, Equatable {
        let name: String
        let pct: Double?
        let change: Double?
    }
    let institutions: Double
    let insiders: Double?
    let count: Int?
    let top: [Holder]
}

struct OwnershipCard: View {
    let ownership: Ownership

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Who Owns It").font(.headline)
            Text("Institutions \(ownership.institutions.formatted(.percent.precision(.fractionLength(1))))" + (ownership.insiders.map { " · insiders \($0.formatted(.percent.precision(.fractionLength(1))))" } ?? ""))
                .font(.subheadline.weight(.semibold))
            GeometryReader { g in
                HStack(spacing: 0) {
                    Rectangle().fill(Palette.appleBlue).frame(width: g.size.width * min(ownership.institutions, 1))
                    Rectangle().fill(.orange).frame(width: g.size.width * min(ownership.insiders ?? 0, 1))
                    Spacer(minLength: 0)
                }
            }
            .frame(height: 6)
            .background(Color.secondary.opacity(0.2))
            .clipShape(Capsule())
            .accessibilityHidden(true)
            ForEach(ownership.top, id: \.name) { o in
                HStack(alignment: .firstTextBaseline) {
                    Text(o.name).lineLimit(1)
                    Spacer(minLength: 8)
                    Text(o.pct.map { $0.formatted(.percent.precision(.fractionLength(2))) } ?? "")
                    if let c = o.change {
                        Text(c.formatted(.percent.precision(.fractionLength(1)).sign(strategy: .always()))).foregroundStyle(c >= 0 ? Palette.successGreen : Palette.dangerRed)
                    }
                }
                .font(.caption).foregroundStyle(.secondary)
            }
            if let count = ownership.count {
                Text("\(count.formatted()) institutions in the latest filings. Change is since their last quarter.")
                    .font(.caption2).foregroundStyle(.secondary)
            }
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 12))
        .padding(.horizontal)
    }
}

/// Consensus and target against today's price; nothing without coverage.
struct AnalystLine: View {
    let target: AnalystTarget
    let price: Double

    var body: some View {
        let up = target.upside(from: price)
        VStack(alignment: .leading, spacing: 4) {
            Text("Analysts").font(.headline)
            (Text((target.consensus.map { $0.capitalized + " · " } ?? "") + "target \(CurrencyFormatter.formatPrice(target.mean))")
             + Text(String(format: " (%+.1f%%)", up)).foregroundColor(up >= 0 ? Palette.successGreen : Palette.dangerRed))
                .font(.subheadline.weight(.semibold))
            Text("\(target.count) analysts" + (target.low.flatMap { lo in target.high.map { ", from \(CurrencyFormatter.formatPrice(lo)) to \(CurrencyFormatter.formatPrice($0))" } } ?? "") + ". Their view, not advice.")
                .font(.caption).foregroundStyle(.secondary)
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 12))
        .padding(.horizontal)
    }
}

/// Last four quarters as estimate and actual bars on a stock's page; nothing when there's no history (funds, crypto).
struct EarningsHistoryCard: View {
    let symbol: String
    var price: Double = 0
    @State private var quarters: [EarningsQuarter] = []
    @State private var analysts: AnalystTarget?
    @State private var insiders: InsiderActivity?
    @State private var ownership: Ownership?

    var body: some View {
        Group {
            if let analysts, price > 0 { AnalystLine(target: analysts, price: price) }
            if let insiders { InsiderCard(activity: insiders) }
            if let ownership { OwnershipCard(ownership: ownership) }
            if !quarters.isEmpty {
                let top = max(quarters.flatMap { [abs($0.actual), abs($0.estimate)] }.max() ?? 0.01, 0.01)
                VStack(alignment: .leading, spacing: 10) {
                    Text("Earnings").font(.headline)
                    HStack(alignment: .bottom, spacing: 8) {
                        ForEach(quarters, id: \.quarter) { q in
                            VStack(spacing: 4) {
                                HStack(alignment: .bottom, spacing: 3) {
                                    RoundedRectangle(cornerRadius: 2).fill(Color.secondary.opacity(0.4))
                                        .frame(width: 10, height: 56 * abs(q.estimate) / top)
                                    RoundedRectangle(cornerRadius: 2).fill(q.beat ? Palette.successGreen : Palette.dangerRed)
                                        .frame(width: 10, height: 56 * abs(q.actual) / top)
                                }
                                .frame(height: 56, alignment: .bottom)
                                Text(q.verdict).font(.caption2.weight(.semibold)).foregroundStyle(q.beat ? Palette.successGreen : Palette.dangerRed)
                                Text(q.quarter).font(.caption2).foregroundStyle(.secondary)
                            }
                            .frame(maxWidth: .infinity)
                            .accessibilityElement(children: .ignore)
                            .accessibilityLabel("\(q.quarter): EPS \(String(format: "%.2f", q.actual)) against \(String(format: "%.2f", q.estimate)), \(q.verdict)")
                        }
                    }
                    Text("EPS: grey is the estimate, colour is what it reported.").font(.caption2).foregroundStyle(.secondary)
                }
                .padding()
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 12))
                .padding(.horizontal)
            }
        }
        .task(id: symbol) {
            let h = try? await EpiphanyAPI.shared.fetchEarningsHistory(symbol: symbol)
            quarters = h?.quarters ?? []
            analysts = h?.analysts
            insiders = h?.insiders
            ownership = h?.ownership
        }
    }
}
