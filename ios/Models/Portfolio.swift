import Foundation

struct Portfolio: Codable {
    let totalValue: Double
    let dayChange: Double
    let dayChangePercent: Double
    let holdings: [Holding]

    init(totalValue: Double, dayChange: Double, dayChangePercent: Double, holdings: [Holding]) {
        self.totalValue = totalValue
        self.dayChange = dayChange
        self.dayChangePercent = dayChangePercent
        self.holdings = holdings
    }

    init(financeData: FinanceData, stocks: [Stock]) {
        let stockMap = Dictionary(uniqueKeysWithValues: stocks.map { ($0.symbol, $0) })
        let mappedHoldings = financeData.holdings.map { item in
            let livePrice: Double
            if let stock = stockMap[item.symbol] {
                livePrice = stock.price
            } else if let marketValue = item.marketValue, item.shares > 0 {
                livePrice = marketValue / item.shares
            } else if item.shares > 0 && item.costBasis > 0 {
                livePrice = item.costBasis
            } else {
                livePrice = 0
            }
            return Holding(
                symbol: item.symbol,
                shares: item.shares,
                avgCost: item.costBasis,
                currentPrice: livePrice
            )
        }

        // "investment"-type broker accounts fold holdings value into their
        // balance server-side (SnapTradeAdapter.getAccounts(): cash +
        // holdingsValue), and those same positions are already summed via
        // mappedHoldings above -- including the full account balance here
        // would double-count holdings value. Only cash-type accounts (and
        // any account with no type, e.g. manually-entered ones) are pure
        // cash and safe to add directly.
        let accountTotal = financeData.accounts.reduce(0.0) { partial, account in
            if account.type == "investment" { return partial }
            return partial + account.balance
        }
        let totalValue = mappedHoldings.reduce(0) { $0 + $1.marketValue } + accountTotal
        let dayChange = mappedHoldings.reduce(0) { partial, holding in
            let changePercent = (stockMap[holding.symbol]?.changePercent ?? 0) / 100
            let previousPrice = changePercent > -1 ? holding.currentPrice / (1 + changePercent) : holding.currentPrice
            return partial + ((holding.currentPrice - previousPrice) * holding.shares)
        }
        let previousValue = max(totalValue - dayChange, 0.01)
        let dayChangePercent = (dayChange / previousValue) * 100

        self.init(
            totalValue: totalValue,
            dayChange: dayChange,
            dayChangePercent: dayChangePercent,
            holdings: mappedHoldings
        )
    }

    struct Holding: Codable, Identifiable {
        let symbol: String
        let shares: Double
        let avgCost: Double
        let currentPrice: Double

        var id: String { symbol }
        var marketValue: Double { shares * currentPrice }
        var gainLoss: Double { (currentPrice - avgCost) * shares }
    }
}
