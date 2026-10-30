import SwiftUI

/// Earnings and dividend dates in the next `days` for the symbols you follow. Mirrors upcomingEvents in upcoming.js.
enum Upcoming {
    struct Event: Equatable, Identifiable {
        let symbol, kind: String
        let date: Date
        var id: String { symbol + kind }
    }

    static func events(_ stocks: [Stock], following symbols: Set<String>, now: Date = Date(), days: Double = 14) -> [Event] {
        let start = Calendar.current.startOfDay(for: now)
        let end = now.addingTimeInterval(days * 86400)
        return stocks.filter { symbols.contains($0.symbol) }
            .flatMap { s in [("Earnings", s.nextEarnings), ("Dividend", s.dividendDate)].compactMap { kind, ts in
                ts.map { Event(symbol: s.symbol, kind: kind, date: Date(timeIntervalSince1970: $0)) }
            } }
            .filter { $0.date >= start && $0.date <= end }
            .sorted { ($0.date, $0.symbol) < ($1.date, $1.symbol) }
    }
}

/// "Upcoming" on Markets: your watchlist's and holdings' earnings and dividends, next 14 days. Nothing when there are none.
struct UpcomingCard: View {
    let stocks: [Stock]
    let onSelect: (Stock) -> Void
    @Environment(AppState.self) private var appState

    var body: some View {
        let follow = appState.watchlistSymbols.union((appState.financeData?.holdings ?? []).map(\.symbol))
        let events = Upcoming.events(stocks, following: follow).prefix(8)
        if !events.isEmpty {
            VStack(alignment: .leading, spacing: 8) {
                Text("Upcoming").font(.subheadline.weight(.semibold)).foregroundStyle(.secondary)
                ForEach(events) { e in
                    Button {
                        if let s = stocks.first(where: { $0.symbol == e.symbol }) { onSelect(s) }
                    } label: {
                        HStack(spacing: 10) {
                            Text(e.date.formatted(.dateTime.month(.abbreviated).day()))
                                .foregroundStyle(.secondary).monospacedDigit().frame(width: 52, alignment: .leading)
                            Text(e.symbol).fontWeight(.semibold)
                            Spacer()
                            Text(e.kind).foregroundStyle(e.kind == "Earnings" ? Palette.appleBlue : Palette.successGreen)
                        }
                        .font(.subheadline)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(12)
            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 12))
        }
    }
}
