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

    struct Moment: Equatable, Identifiable {
        let symbol, text: String
        let up: Bool
        let size: Double
        var id: String { symbol + text }
    }

    /// What happened today: moves of 3% or more and 52-week highs or lows, biggest move first. Mirrors todayEvents in upcoming.js.
    static func today(_ stocks: [Stock], following symbols: Set<String>, minMove: Double = 3) -> [Moment] {
        stocks.filter { symbols.contains($0.symbol) && $0.price > 0 }.flatMap { s -> [Moment] in
            var out: [Moment] = []
            let move = s.changePercent
            if abs(move) >= minMove {
                out.append(Moment(symbol: s.symbol, text: "\(move > 0 ? "Up" : "Down") \(String(format: "%.1f", abs(move)))% today", up: move > 0, size: abs(move)))
            }
            if s.high52 > s.low52, s.price >= s.high52 * 0.995 {
                out.append(Moment(symbol: s.symbol, text: "At a 52-week high", up: true, size: abs(move) - 0.1))
            } else if s.high52 > s.low52, s.price <= s.low52 * 1.005 {
                out.append(Moment(symbol: s.symbol, text: "At a 52-week low", up: false, size: abs(move) - 0.1))
            }
            return out
        }
        .sorted { $0.size > $1.size }
        .prefix(6).map { $0 }
    }
}

/// "Today in Your Stocks" on Markets: big moves and 52-week highs or lows in your watchlist and holdings. Nothing on a quiet day.
struct TodayCard: View {
    let stocks: [Stock]
    let onSelect: (Stock) -> Void
    @Environment(AppState.self) private var appState

    var body: some View {
        let follow = appState.watchlistSymbols.union((appState.financeData?.holdings ?? []).map(\.symbol))
        let moments = Upcoming.today(stocks, following: follow)
        if !moments.isEmpty {
            VStack(alignment: .leading, spacing: 8) {
                Text("Today in Your Stocks").font(.subheadline.weight(.semibold)).foregroundStyle(.secondary)
                ForEach(moments) { m in
                    Button {
                        if let s = stocks.first(where: { $0.symbol == m.symbol }) { onSelect(s) }
                    } label: {
                        HStack(spacing: 10) {
                            Text(m.symbol).fontWeight(.semibold).frame(width: 52, alignment: .leading)
                            Text(m.text).foregroundStyle(m.up ? Palette.successGreen : Palette.dangerRed)
                            Spacer()
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

/// "Upcoming" on Markets: your watchlist's and holdings' earnings and dividends, next 14 days. Nothing when there are none.
struct UpcomingCard: View {
    let stocks: [Stock]
    let onSelect: (Stock) -> Void
    @Environment(AppState.self) private var appState
    @State private var nextFed: Date?

    var body: some View {
        let follow = appState.watchlistSymbols.union((appState.financeData?.holdings ?? []).map(\.symbol))
        let events = Upcoming.events(stocks, following: follow).prefix(8)
        Group { if !events.isEmpty || nextFed != nil {
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
                if let nextFed {
                    if !events.isEmpty { Divider() }
                    HStack(spacing: 10) {
                        Text(nextFed.formatted(.dateTime.month(.abbreviated).day()))
                            .foregroundStyle(.secondary).monospacedDigit().frame(width: 52, alignment: .leading)
                        Text("Fed rate decision").fontWeight(.semibold)
                        Spacer()
                        Text("Economy").foregroundStyle(.secondary)
                    }
                    .font(.subheadline)
                }
            }
            .padding(12)
            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 12))
        } }
        .task { nextFed = (try? await EpiphanyAPI.shared.fetchNextFedDecision()).flatMap { $0.flatMap(ISO8601DateFormatter.dateOnly) } }
    }
}
