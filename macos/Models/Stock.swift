import Foundation

private extension KeyedDecodingContainer where Key == Stock.CodingKeys {
    func flexibleDouble(forKey key: Key) -> Double? {
        if let value = try? decodeIfPresent(Double.self, forKey: key) {
            return value
        }
        if let value = try? decodeIfPresent(Int.self, forKey: key) {
            return Double(value)
        }
        if let value = try? decodeIfPresent(String.self, forKey: key) {
            let cleaned = value
                .trimmingCharacters(in: .whitespacesAndNewlines)
                .replacingOccurrences(of: "%", with: "")
                .replacingOccurrences(of: "(", with: "")
                .replacingOccurrences(of: ")", with: "")
                .replacingOccurrences(of: "+", with: "")
            return Double(cleaned)
        }
        return nil
    }
}

struct Stock: Decodable, Identifiable, Hashable {
    let symbol: String
    let name: String
    let price: Double
    let change: Double
    let changePercent: Double
    let volume: Double
    let high52: Double
    let low52: Double
    let marketCap: Double?
    let peRatio: Double?
    let open: Double
    let prevClose: Double
    let dayHigh: Double
    let dayLow: Double
    let eps: Double?
    let beta: Double?
    let yield: Double?
    let avgVolume: Double?

    var id: String { symbol }

    var formattedVolume: String {
        if volume >= 1_000_000_000 {
            return String(format: "%.1fB", volume / 1_000_000_000)
        } else if volume >= 1_000_000 {
            return String(format: "%.1fM", volume / 1_000_000)
        } else if volume >= 1_000 {
            return String(format: "%.0fK", volume / 1_000)
        }
        return String(format: "%.0f", volume)
    }

    var formattedMarketCap: String? {
        guard let cap = marketCap, cap > 0 else { return nil }
        if cap >= 1_000_000_000_000 {
            return String(format: "%.2fT", cap / 1_000_000_000_000)
        } else if cap >= 1_000_000_000 {
            return String(format: "%.1fB", cap / 1_000_000_000)
        } else if cap >= 1_000_000 {
            return String(format: "%.0fM", cap / 1_000_000)
        }
        return String(format: "%.0f", cap)
    }

    var formattedPERatio: String? {
        guard let pe = peRatio, pe > 0 else { return nil }
        return String(format: "%.1f", pe)
    }

    var formattedEPS: String? {
        guard let e = eps else { return nil }
        return String(format: "$%.2f", e)
    }

    var formattedBeta: String? {
        guard let b = beta else { return nil }
        return String(format: "%.2f", b)
    }

    var formattedYield: String? {
        guard let y = yield, y > 0 else { return nil }
        return String(format: "%.2f%%", y)
    }

    var formattedAvgVolume: String? {
        guard let av = avgVolume, av > 0 else { return nil }
        if av >= 1_000_000 { return String(format: "%.1fM", av / 1_000_000) }
        if av >= 1_000 { return String(format: "%.0fK", av / 1_000) }
        return String(format: "%.0f", av)
    }

    var dayRange: String? {
        guard dayLow > 0 && dayHigh > 0 else { return nil }
        return String(format: "$%.2f - $%.2f", dayLow, dayHigh)
    }

    var yearRange: String? {
        guard low52 > 0 && high52 > 0 else { return nil }
        return String(format: "$%.2f - $%.2f", low52, high52)
    }

    enum CodingKeys: String, CodingKey {
        case symbol, name, price, change, volume, marketCap, peRatio, eps, beta, yield, avgVolume
        case changePercent = "changesPercentage"
        case changePercentAlt = "changePercent"
        case changePercentSnake = "change_percent"
        case regularMarketChangePercent
        case high52 = "yearHigh"
        case low52 = "yearLow"
        case high52Alt = "fiftyTwoWeekHigh"
        case low52Alt = "fiftyTwoWeekLow"
        case marketCapSnake = "market_cap"
        case marketCapitalization
        case pe
        case trailingPE
        case priceEarningsRatio
        case open, prevClose
        case dayHigh = "high"
        case dayLow = "low"
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        symbol = try container.decode(String.self, forKey: .symbol)
        name = try container.decodeIfPresent(String.self, forKey: .name) ?? symbol
        price = container.flexibleDouble(forKey: .price) ?? 0
        change = container.flexibleDouble(forKey: .change) ?? 0
        let decodedPercent = container.flexibleDouble(forKey: .changePercent)
            ?? container.flexibleDouble(forKey: .changePercentAlt)
            ?? container.flexibleDouble(forKey: .changePercentSnake)
            ?? container.flexibleDouble(forKey: .regularMarketChangePercent)
        if let decodedPercent {
            changePercent = decodedPercent
        } else if price != 0 {
            changePercent = (change / (price - change)) * 100
        } else {
            changePercent = 0
        }
        volume = container.flexibleDouble(forKey: .volume) ?? 0
        high52 = container.flexibleDouble(forKey: .high52)
            ?? container.flexibleDouble(forKey: .high52Alt)
            ?? 0
        low52 = container.flexibleDouble(forKey: .low52)
            ?? container.flexibleDouble(forKey: .low52Alt)
            ?? 0
        marketCap = container.flexibleDouble(forKey: .marketCap)
            ?? container.flexibleDouble(forKey: .marketCapSnake)
            ?? container.flexibleDouble(forKey: .marketCapitalization)
        peRatio = container.flexibleDouble(forKey: .pe)
            ?? container.flexibleDouble(forKey: .peRatio)
            ?? container.flexibleDouble(forKey: .trailingPE)
            ?? container.flexibleDouble(forKey: .priceEarningsRatio)
        open = container.flexibleDouble(forKey: .open) ?? 0
        prevClose = container.flexibleDouble(forKey: .prevClose) ?? 0
        dayHigh = container.flexibleDouble(forKey: .dayHigh) ?? 0
        dayLow = container.flexibleDouble(forKey: .dayLow) ?? 0
        eps = container.flexibleDouble(forKey: .eps)
        beta = container.flexibleDouble(forKey: .beta)
        yield = container.flexibleDouble(forKey: .yield)
        avgVolume = container.flexibleDouble(forKey: .avgVolume)
    }

    init(symbol: String, name: String, price: Double, change: Double = 0,
         changePercent: Double = 0, volume: Double = 0, high52: Double = 0, low52: Double = 0,
         marketCap: Double? = nil, peRatio: Double? = nil, open: Double = 0,
         prevClose: Double = 0, dayHigh: Double = 0, dayLow: Double = 0, eps: Double? = nil,
         beta: Double? = nil, yield: Double? = nil, avgVolume: Double? = nil) {
        self.symbol = symbol
        self.name = name
        self.price = price
        self.change = change
        self.changePercent = changePercent
        self.volume = volume
        self.high52 = high52
        self.low52 = low52
        self.marketCap = marketCap
        self.peRatio = peRatio
        self.open = open
        self.prevClose = prevClose
        self.dayHigh = dayHigh
        self.dayLow = dayLow
        self.eps = eps
        self.beta = beta
        self.yield = yield
        self.avgVolume = avgVolume
    }
}
