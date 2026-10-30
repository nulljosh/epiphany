import Foundation

struct PriceAlert: Codable, Identifiable {
    let id: String
    let userEmail: String?
    let symbol: String
    let targetPrice: Double
    let direction: Direction
    let triggered: Bool
    let createdAt: String?
    /// "price", "high52", "low52" or "earnings"; rows from before 21.0 have none and are price alerts.
    var kind: String? = nil

    enum Direction: String, Codable {
        case above
        case below
    }

    enum CodingKeys: String, CodingKey {
        case id, symbol, direction, triggered, kind
        case userEmail = "user_email"
        case targetPrice = "target_price"
        case createdAt = "created_at"
    }
}
