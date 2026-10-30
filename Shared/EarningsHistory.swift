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

/// Last four quarters as estimate and actual bars on a stock's page; nothing when there's no history (funds, crypto).
struct EarningsHistoryCard: View {
    let symbol: String
    @State private var quarters: [EarningsQuarter] = []

    var body: some View {
        Group {
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
        .task(id: symbol) { quarters = (try? await EpiphanyAPI.shared.fetchEarningsHistory(symbol: symbol)) ?? [] }
    }
}
