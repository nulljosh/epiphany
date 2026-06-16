import Foundation

struct SocialLink: Codable {
    let platform: String
    let url: String
    let username: String?
    let icon: String?
}

struct PersonSearchResult: Codable {
    let title: String
    let snippet: String
    let url: String
    let displayUrl: String
    let imageUrl: String?
}

struct PersonProfile: Codable {
    let query: String
    let results: [PersonSearchResult]
    let socialLinks: [SocialLink]
    let primaryImage: String?
    let resultCount: Int?
}

struct PersonEnrichment: Codable {
    let bio: String?
    let tags: [String]?
    let relatedNames: [String]?
    let occupations: [String]?
    let locations: [String]?

    enum CodingKeys: String, CodingKey {
        case bio
        case tags
        case relatedNames = "related_names"
        case occupations
        case locations
    }
}

struct IndexedPerson: Codable, Identifiable {
    let id: String
    let name: String
    let image: String?
    let bio: String?
    let tags: [String]
    let notes: String?
    let socials: [SocialLink]
    let relationships: [String]
    let searchData: PersonProfile?
    let enrichment: PersonEnrichment?
    let createdAt: Date
    let updatedAt: Date

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case image
        case bio
        case tags
        case notes
        case socials
        case relationships
        case searchData = "search_data"
        case enrichment
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

struct NewsMention: Codable {
    let title: String
    let url: String
    let source: String
    let image: String?
    let publishedAt: String?

    enum CodingKeys: String, CodingKey {
        case title
        case url
        case source
        case image
        case publishedAt = "published_at"
    }
}

struct PeopleIndexResponse: Codable {
    let people: [IndexedPerson]
}

struct IndexPersonResponse: Codable {
    let ok: Bool
    let person: IndexedPerson
}

struct EnrichResponse: Codable {
    let enrichment: PersonEnrichment?
}

struct CrossrefResponse: Codable {
    let mentions: [NewsMention]
}
