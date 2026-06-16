import Foundation

struct WatchStock: Codable, Identifiable {
    let symbol: String
    let name: String
    let price: Double
    let change: Double
    let changePercent: Double

    var id: String { symbol }

    enum CodingKeys: String, CodingKey {
        case symbol, name, price, change
        case changePercent = "changePercent"
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        symbol = try container.decode(String.self, forKey: .symbol)
        name = try container.decodeIfPresent(String.self, forKey: .name) ?? symbol
        price = try container.decode(Double.self, forKey: .price)
        change = try container.decodeIfPresent(Double.self, forKey: .change) ?? 0
        changePercent = try container.decodeIfPresent(Double.self, forKey: .changePercent) ?? 0
    }

    init(symbol: String, name: String, price: Double, change: Double = 0, changePercent: Double = 0) {
        self.symbol = symbol
        self.name = name
        self.price = price
        self.change = change
        self.changePercent = changePercent
    }
}

struct WatchCommodity: Codable, Identifiable {
    let name: String
    let price: Double
    let change: Double
    let changePercent: Double

    var id: String { name }
}

struct WatchCrypto: Codable, Identifiable {
    let symbol: String
    let spot: Double
    let chgPct: Double

    var id: String { symbol }
}

struct PortfolioSummary: Codable {
    let totalValue: Double
    let dayChange: Double
    let dayChangePercent: Double
    let topHoldings: [HoldingSummary]

    struct HoldingSummary: Codable, Identifiable {
        let symbol: String
        let value: Double
        let changePercent: Double

        var id: String { symbol }
    }
}

struct CommodityResponse: Codable {
    let price: Double
    let change: Double
    let changePercent: Double
}

struct CryptoResponse: Codable {
    let spot: Double
    let chgPct: Double
}
