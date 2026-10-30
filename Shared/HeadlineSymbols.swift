import SwiftUI

/// Stocks a headline names: "$AAPL", "(AAPL)", or the company's short name ("Apple", "Nvidia").
/// ponytail: first word of the company name, case-sensitive, with a stoplist for words that are also
/// plain English; a real entity tagger if the false hits get annoying.
enum HeadlineSymbols {
    private static let stoplist: Set<String> = ["General", "American", "United", "First", "Bank", "Target", "Advanced",
                                                "Applied", "International", "Southern", "Public", "Global", "The"]

    static func shortName(_ name: String) -> String? {
        guard let first = name.split(separator: " ").first?.trimmingCharacters(in: .punctuationCharacters),
              first.count >= 4, !stoplist.contains(first) else { return nil }
        return first
    }

    static func match(_ title: String, in stocks: [Stock], limit: Int = 3) -> [Stock] {
        var hits: [Stock] = []
        for stock in stocks where hits.count < limit {
            let ticker = NSRegularExpression.escapedPattern(for: stock.symbol)
            let byTicker = title.range(of: "\\$\(ticker)\\b|\\(\(ticker)\\)", options: .regularExpression) != nil
            // "NVIDIA" in the listing is "Nvidia" in headlines, so all-caps names match any case.
            let byName = shortName(stock.name).map { short in
                title.range(of: "\\b\(NSRegularExpression.escapedPattern(for: short))\\b",
                            options: short == short.uppercased() ? [.regularExpression, .caseInsensitive] : .regularExpression) != nil
            } ?? false
            if byTicker || byName { hits.append(stock) }
        }
        return hits
    }
}

/// Live price chips under a headline, one per stock it names. Nothing when it names none.
struct HeadlineChips: View {
    let title: String
    @Environment(AppState.self) private var appState

    var body: some View {
        let stocks = HeadlineSymbols.match(title, in: appState.stocks)
        if !stocks.isEmpty {
            HStack(spacing: 6) {
                ForEach(stocks) { stock in
                    HStack(spacing: 4) {
                        Text(stock.symbol).fontWeight(.semibold)
                        Text(CurrencyFormatter.formatPrice(stock.price))
                        Text(String(format: "%+.1f%%", stock.changePercent))
                            .foregroundStyle(stock.changePercent >= 0 ? Palette.successGreen : Palette.dangerRed)
                    }
                    .font(.caption2.monospacedDigit())
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(Color.primary.opacity(0.06), in: Capsule())
                }
            }
        }
    }
}
