import Foundation

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
