import Foundation

struct WatchlistItem: Codable, Identifiable {
    let symbol: String
    let userEmail: String?
    let addedAt: String?
    private let rawId: String?

    // Server-generated id when present, otherwise fall back to symbol
    // (symbol is unique per user, so it is a stable Identifiable key).
    var id: String { rawId ?? symbol }

    enum CodingKeys: String, CodingKey {
        case symbol
        case rawId = "id"
        case userEmail = "user_email"
        case addedAt = "added_at"
    }
}
