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
        // Backend sends icon field; fall back to globe if missing
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
