import Foundation

struct PersonSearchResult: Codable, Identifiable {
    let title: String
    let snippet: String
    let url: String
    let displayUrl: String
    let imageUrl: String?

    var id: String { url }

    enum CodingKeys: String, CodingKey {
        case title, snippet, url, displayUrl, imageUrl
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        title = (try? c.decode(String.self, forKey: .title)) ?? ""
        snippet = (try? c.decode(String.self, forKey: .snippet)) ?? ""
        url = (try? c.decode(String.self, forKey: .url)) ?? ""
        displayUrl = (try? c.decode(String.self, forKey: .displayUrl)) ?? ""
        imageUrl = try? c.decodeIfPresent(String.self, forKey: .imageUrl)
    }
}

struct SocialLink: Codable, Identifiable {
    let platform: String
    let url: String
    let username: String?
    let icon: String?

    var id: String { url }

    var displayName: String {
        if let username, !username.isEmpty { return "@\(username)" }
        return platform.capitalized
    }

    var systemImage: String {
        if let icon, !icon.isEmpty { return icon }
        return "globe"
    }
}

struct PersonProfile: Codable {
    let query: String
    let results: [PersonSearchResult]
    let socialLinks: [SocialLink]
    let primaryImage: String?
    let resultCount: Int?
}

// MARK: - People Index

struct IndexedPerson: Codable, Identifiable, Hashable {
    let id: String
    var name: String
    var image: String?
    var bio: String?
    var tags: [String]
    var notes: String
    var socials: [SocialLink]
    var relationships: [PersonRelationship]
    var searchData: PersonSearchData?
    var enrichment: PersonEnrichment?
    let createdAt: String?
    var updatedAt: String?

    static func == (lhs: IndexedPerson, rhs: IndexedPerson) -> Bool { lhs.id == rhs.id }
    func hash(into hasher: inout Hasher) { hasher.combine(id) }

    enum CodingKeys: String, CodingKey {
        case id, name, image, bio, tags, notes, socials, relationships
        case searchData, enrichment, createdAt, updatedAt
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = (try? c.decode(String.self, forKey: .id)) ?? UUID().uuidString
        name = (try? c.decode(String.self, forKey: .name)) ?? ""
        image = try? c.decodeIfPresent(String.self, forKey: .image)
        bio = try? c.decodeIfPresent(String.self, forKey: .bio)
        tags = (try? c.decode([String].self, forKey: .tags)) ?? []
        notes = (try? c.decode(String.self, forKey: .notes)) ?? ""
        socials = (try? c.decode([SocialLink].self, forKey: .socials)) ?? []
        relationships = (try? c.decode([PersonRelationship].self, forKey: .relationships)) ?? []
        searchData = try? c.decodeIfPresent(PersonSearchData.self, forKey: .searchData)
        enrichment = try? c.decodeIfPresent(PersonEnrichment.self, forKey: .enrichment)
        createdAt = try? c.decodeIfPresent(String.self, forKey: .createdAt)
        updatedAt = try? c.decodeIfPresent(String.self, forKey: .updatedAt)
    }

    init(id: String, name: String, image: String? = nil, bio: String? = nil, tags: [String] = [], notes: String = "", socials: [SocialLink] = [], relationships: [PersonRelationship] = [], searchData: PersonSearchData? = nil, enrichment: PersonEnrichment? = nil, createdAt: String? = nil, updatedAt: String? = nil) {
        self.id = id; self.name = name; self.image = image; self.bio = bio
        self.tags = tags; self.notes = notes; self.socials = socials
        self.relationships = relationships; self.searchData = searchData
        self.enrichment = enrichment; self.createdAt = createdAt; self.updatedAt = updatedAt
    }
}

struct PersonRelationship: Codable, Hashable {
    let type: String
    let name: String

    enum CodingKeys: String, CodingKey { case type, name }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        type = (try? c.decode(String.self, forKey: .type)) ?? ""
        name = (try? c.decode(String.self, forKey: .name)) ?? ""
    }

    init(type: String, name: String) {
        self.type = type; self.name = name
    }
}

struct PersonSearchData: Codable {
    let query: String
    let results: [PersonSearchResult]
    let resultCount: Int?

    enum CodingKeys: String, CodingKey { case query, results, resultCount }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        query = (try? c.decode(String.self, forKey: .query)) ?? ""
        results = (try? c.decode([PersonSearchResult].self, forKey: .results)) ?? []
        resultCount = try? c.decodeIfPresent(Int.self, forKey: .resultCount)
    }

    init(query: String, results: [PersonSearchResult], resultCount: Int?) {
        self.query = query; self.results = results; self.resultCount = resultCount
    }
}

struct PersonEnrichment: Codable {
    let role: String?
    let company: String?
    let location: String?
    let keyFacts: [String]
    let associates: [String]
    let industryTags: [String]
    let sentiment: String?
    let enrichedAt: String?

    enum CodingKeys: String, CodingKey {
        case role, company, location, keyFacts, associates, industryTags, sentiment, enrichedAt
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        role = try? c.decodeIfPresent(String.self, forKey: .role)
        company = try? c.decodeIfPresent(String.self, forKey: .company)
        location = try? c.decodeIfPresent(String.self, forKey: .location)
        keyFacts = (try? c.decode([String].self, forKey: .keyFacts)) ?? []
        associates = (try? c.decode([String].self, forKey: .associates)) ?? []
        industryTags = (try? c.decode([String].self, forKey: .industryTags)) ?? []
        sentiment = try? c.decodeIfPresent(String.self, forKey: .sentiment)
        enrichedAt = try? c.decodeIfPresent(String.self, forKey: .enrichedAt)
    }
}

struct NewsMention: Codable, Identifiable {
    let title: String
    let url: String
    let source: String?
    let image: String?
    let publishedAt: String?

    var id: String { url }

    enum CodingKeys: String, CodingKey {
        case title, url, source, image, publishedAt
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        title = (try? c.decode(String.self, forKey: .title)) ?? ""
        url = (try? c.decode(String.self, forKey: .url)) ?? ""
        source = try? c.decodeIfPresent(String.self, forKey: .source)
        image = try? c.decodeIfPresent(String.self, forKey: .image)
        publishedAt = try? c.decodeIfPresent(String.self, forKey: .publishedAt)
    }
}

struct CrossrefResponse: Codable {
    let mentions: [NewsMention]
    let cached: Bool?

    enum CodingKeys: String, CodingKey { case mentions, cached }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        mentions = (try? c.decode([NewsMention].self, forKey: .mentions)) ?? []
        cached = try? c.decodeIfPresent(Bool.self, forKey: .cached)
    }
}

struct PeopleIndexResponse: Codable {
    let people: [IndexedPerson]

    enum CodingKeys: String, CodingKey { case people }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        people = (try? c.decode([IndexedPerson].self, forKey: .people)) ?? []
    }
}

struct IndexPersonResponse: Codable {
    let ok: Bool?
    let person: IndexedPerson?
}

struct EnrichResponse: Codable {
    let ok: Bool?
    let enrichment: PersonEnrichment?

    enum CodingKeys: String, CodingKey { case ok, enrichment }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        ok = try? c.decodeIfPresent(Bool.self, forKey: .ok)
        enrichment = try? c.decodeIfPresent(PersonEnrichment.self, forKey: .enrichment)
    }
}
