import Foundation

/// The stats grid under a stock chart, in Apple Stocks order. The web's `stats` in StockDetail.jsx keeps the same order.
enum KeyStats {
    static func rows(_ s: Stock) -> [(label: String, value: String)] {
        func price(_ v: Double) -> String? { v > 0 ? CurrencyFormatter.formatPrice(v) : nil }
        let all: [(String, String?)] = [
            ("Open", price(s.open)),
            ("High", price(s.dayHigh)),
            ("Low", price(s.dayLow)),
            ("Prev Close", price(s.prevClose)),
            ("Volume", s.volume > 0 ? s.formattedVolume : nil),
            ("Avg Vol", s.formattedAvgVolume),
            ("P/E", s.formattedPERatio),
            ("Mkt Cap", s.formattedMarketCap.map { "$\($0)" }),
            ("52W H", price(s.high52)),
            ("52W L", price(s.low52)),
            ("EPS", s.formattedEPS),
            ("Yield", s.formattedYield),
            ("Beta", s.formattedBeta),
            ("Bid", s.bid.flatMap(price)),
            ("Ask", s.ask.flatMap(price)),
            ("Exchange", s.exchange),
            ("Earnings", s.earningsSoon ? s.formattedNextEarnings : nil),
            ("Dividend", s.formattedDividendDate),
        ]
        return all.compactMap { label, value in value.map { (label, $0) } }
    }
}
