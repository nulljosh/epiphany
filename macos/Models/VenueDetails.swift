import Foundation

struct VenueDetails: Codable {
    let available: Bool
    let photos: [String]
    let rating: Double?
    let reviewCount: Int
    let reviews: [VenueReview]
    let yelpUrl: String?

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        available = try container.decodeIfPresent(Bool.self, forKey: .available) ?? false
        photos = try container.decodeIfPresent([String].self, forKey: .photos) ?? []
        rating = try container.decodeIfPresent(Double.self, forKey: .rating)
        reviewCount = try container.decodeIfPresent(Int.self, forKey: .reviewCount) ?? 0
        reviews = try container.decodeIfPresent([VenueReview].self, forKey: .reviews) ?? []
        yelpUrl = try container.decodeIfPresent(String.self, forKey: .yelpUrl)
    }
}

struct VenueReview: Codable, Identifiable {
    let text: String
    let rating: Int
    let user: String

    var id: String { "\(user)-\(text.prefix(20))" }
}
