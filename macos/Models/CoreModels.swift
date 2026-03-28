import Foundation

// MARK: - User

struct User: Codable {
    let id: String?
    let email: String
    let tier: String?
    let verified: Bool?
    let stripeCustomerId: String?
    let avatarUrl: String?
}

// MARK: - Market Data

struct CommodityData: Codable, Identifiable {
    let name: String
    let price: Double
    let change: Double
    let changePercent: Double

    var id: String { name }
}

struct CryptoData: Codable, Identifiable {
    let symbol: String
    let spot: Double
    let chgPct: Double

    var id: String { symbol }
}

// MARK: - Watchlist & Alerts

struct WatchlistItem: Codable, Identifiable {
    let id: String
    let userEmail: String?
    let symbol: String
    let addedAt: String?

    enum CodingKeys: String, CodingKey {
        case id, symbol
        case userEmail = "user_email"
        case addedAt = "added_at"
    }
}

struct PriceAlert: Codable, Identifiable {
    let id: String
    let userEmail: String?
    let symbol: String
    let targetPrice: Double
    let direction: Direction
    let triggered: Bool
    let createdAt: String?

    enum Direction: String, Codable {
        case above
        case below
    }

    enum CodingKeys: String, CodingKey {
        case id, symbol, direction, triggered
        case userEmail = "user_email"
        case targetPrice = "target_price"
        case createdAt = "created_at"
    }
}
