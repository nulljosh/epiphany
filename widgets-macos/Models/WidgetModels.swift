import Foundation

struct WidgetStock: Codable, Identifiable {
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

struct WidgetCommodity: Codable, Identifiable {
    let name: String
    let price: Double
    let change: Double
    let changePercent: Double

    var id: String { name }
}

struct WidgetCrypto: Codable, Identifiable {
    let symbol: String
    let spot: Double
    let chgPct: Double

    var id: String { symbol }
}

struct CommodityAPIResponse: Codable {
    let price: Double
    let change: Double
    let changePercent: Double
}

struct CryptoAPIResponse: Codable {
    let spot: Double
    let chgPct: Double
}

struct MarketEntry {
    let name: String
    let price: Double
    let changePercent: Double
}
