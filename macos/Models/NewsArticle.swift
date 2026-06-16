import Foundation

struct NewsArticle: Codable, Identifiable {
    let title: String
    let source: String
    let publishedAt: String
    let url: String
    let imageUrl: String?

    var id: String { url.isEmpty ? "\(title)-\(publishedAt)" : url }

    private enum CodingKeys: String, CodingKey {
        case title, source, publishedAt, url, imageUrl
    }

    private enum DecodingKeys: String, CodingKey {
        case title, source, sourceName, domain
        case publishedAt, published_at, seendate
        case url, link
        case imageUrl, image_url, socialimage, image
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: DecodingKeys.self)

        title = try container.decodeIfPresent(String.self, forKey: .title) ?? "Untitled"
        source =
            try container.decodeIfPresent(String.self, forKey: .source) ??
            container.decodeIfPresent(String.self, forKey: .sourceName) ??
            container.decodeIfPresent(String.self, forKey: .domain) ??
            "GDELT"
        publishedAt =
            try container.decodeIfPresent(String.self, forKey: .publishedAt) ??
            container.decodeIfPresent(String.self, forKey: .published_at) ??
            container.decodeIfPresent(String.self, forKey: .seendate) ??
            ""
        url =
            try container.decodeIfPresent(String.self, forKey: .url) ??
            container.decodeIfPresent(String.self, forKey: .link) ??
            ""
        imageUrl =
            try container.decodeIfPresent(String.self, forKey: .imageUrl) ??
            container.decodeIfPresent(String.self, forKey: .image) ??
            container.decodeIfPresent(String.self, forKey: .image_url) ??
            container.decodeIfPresent(String.self, forKey: .socialimage)
    }
}
