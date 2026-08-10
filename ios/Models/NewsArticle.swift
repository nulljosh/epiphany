import Foundation

struct NewsArticle: Codable, Identifiable {
    let title: String
    let source: String
    let publishedAt: String
    let url: String
    let imageUrl: String?
    let sourceUrl: String?

    var id: String { url.isEmpty ? "\(title)-\(publishedAt)" : url }

    private enum CodingKeys: String, CodingKey {
        case title, source, publishedAt, url, imageUrl, sourceUrl
    }

    private enum DecodingKeys: String, CodingKey {
        case title, source, sourceName, domain
        case publishedAt, published_at, seendate
        case url, link
        case imageUrl, image_url, socialimage, image
        case sourceUrl
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
        sourceUrl = try container.decodeIfPresent(String.self, forKey: .sourceUrl)
    }

    /// Thumbnail for a news row.
    ///
    /// Only GDELT articles carry a real per-article image (`socialimage`).
    /// Google News RSS carries none, and it supplies the bulk of the feed
    /// whenever GDELT is rate-limiting us, which is why every row used to fall
    /// back to the same generic newspaper glyph. Fall back to the publisher's
    /// own logo instead, keyed off the domain the feed reports.
    // ponytail: publisher favicon, not a true per-article image. Upgrading
    // means resolving Google's opaque redirect URLs and scraping og:image per
    // article. Only worth it if GDELT stays dead.
    var thumbnailURL: URL? {
        if let imageUrl, !imageUrl.isEmpty, let url = URL(string: imageUrl) { return url }
        guard let domain = publisherDomain else { return nil }
        return URL(string: "https://www.google.com/s2/favicons?domain=\(domain)&sz=128")
    }

    private var publisherDomain: String? {
        for candidate in [sourceUrl, source.isEmpty ? nil : "https://\(source)"] {
            guard let candidate,
                  let host = URLComponents(string: candidate)?.host?
                      .replacingOccurrences(of: "www.", with: ""),
                  host.contains(".")
            else { continue }
            return host
        }
        return nil
    }
}
