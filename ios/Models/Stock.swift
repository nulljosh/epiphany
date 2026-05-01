import Foundation

struct Stock: Codable, Identifiable, Hashable {
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
        case changePercent = "changePercent"
        case high52 = "fiftyTwoWeekHigh"
        case low52 = "fiftyTwoWeekLow"
        case open, prevClose
        case dayHigh = "high"
        case dayLow = "low"
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        symbol = try container.decode(String.self, forKey: .symbol)
        name = try container.decodeIfPresent(String.self, forKey: .name) ?? symbol
        price = try container.decode(Double.self, forKey: .price)
        change = try container.decodeIfPresent(Double.self, forKey: .change) ?? 0
        changePercent = try container.decodeIfPresent(Double.self, forKey: .changePercent) ?? 0
        volume = try container.decodeIfPresent(Double.self, forKey: .volume) ?? 0
        high52 = try container.decodeIfPresent(Double.self, forKey: .high52) ?? 0
        low52 = try container.decodeIfPresent(Double.self, forKey: .low52) ?? 0
        marketCap = try container.decodeIfPresent(Double.self, forKey: .marketCap)
        peRatio = try container.decodeIfPresent(Double.self, forKey: .peRatio)
        open = try container.decodeIfPresent(Double.self, forKey: .open) ?? 0
        prevClose = try container.decodeIfPresent(Double.self, forKey: .prevClose) ?? 0
        dayHigh = try container.decodeIfPresent(Double.self, forKey: .dayHigh) ?? 0
        dayLow = try container.decodeIfPresent(Double.self, forKey: .dayLow) ?? 0
        eps = try container.decodeIfPresent(Double.self, forKey: .eps)
        beta = try container.decodeIfPresent(Double.self, forKey: .beta)
        yield = try container.decodeIfPresent(Double.self, forKey: .yield)
        avgVolume = try container.decodeIfPresent(Double.self, forKey: .avgVolume)
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
