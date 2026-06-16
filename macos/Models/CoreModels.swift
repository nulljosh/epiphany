import Foundation

// MARK: - User

struct User: Codable {
    let id: String?
    let email: String
    let tier: String?
    let verified: Bool?
    let stripeCustomerId: String?
    let avatarUrl: String?
    let avatarUpdatedAt: Int?
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
    let symbol: String
    let userEmail: String?
    let addedAt: String?
    private let rawId: String?

    // Server id when present, else fall back to symbol (unique per user).
    var id: String { rawId ?? symbol }

    enum CodingKeys: String, CodingKey {
        case symbol
        case rawId = "id"
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
