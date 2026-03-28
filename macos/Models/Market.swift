import Foundation

struct PredictionMarket: Codable, Identifiable {
    let id: String
    let slug: String?
    let question: String
    let description: String?
    let volume24hr: Double?
    let volume: Double?
    let liquidity: Double?
    let events: [MarketEvent]?
    let eventSlug: String?

    struct MarketEvent: Codable {
        let slug: String?
    }

    private enum CodingKeys: String, CodingKey {
        case id, slug, question, description
        case volume24hr, volume, liquidity
        case events, eventSlug
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        slug = try container.decodeIfPresent(String.self, forKey: .slug)
        question = try container.decode(String.self, forKey: .question)
        description = try container.decodeIfPresent(String.self, forKey: .description)
        events = try container.decodeIfPresent([MarketEvent].self, forKey: .events)
        eventSlug = try container.decodeIfPresent(String.self, forKey: .eventSlug)

        // These come as strings or doubles from Polymarket
        volume24hr = Self.decodeFlexibleDouble(container: container, key: .volume24hr)
        volume = Self.decodeFlexibleDouble(container: container, key: .volume)
        liquidity = Self.decodeFlexibleDouble(container: container, key: .liquidity)
    }

    private static func decodeFlexibleDouble(
        container: KeyedDecodingContainer<CodingKeys>,
        key: CodingKeys
    ) -> Double? {
        if let d = try? container.decodeIfPresent(Double.self, forKey: key) { return d }
        if let s = try? container.decodeIfPresent(String.self, forKey: key) { return Double(s) }
        return nil
    }

    var polymarketURL: URL? {
        guard let slug = eventSlug ?? events?.first?.slug else { return nil }
        return URL(string: "https://polymarket.com/event/\(slug)")
    }

    var formattedVolume: String {
        Self.formatCurrency(volume24hr ?? volume ?? 0)
    }

    var formattedLiquidity: String? {
        guard let liquidity, liquidity > 0 else { return nil }
        return Self.formatCurrency(liquidity)
    }

    static func formatCurrency(_ value: Double) -> String {
        if value >= 1_000_000 {
            return String(format: "$%.1fM", value / 1_000_000)
        } else if value >= 1_000 {
            return String(format: "$%.0fK", value / 1_000)
        }
        return String(format: "$%.0f", value)
    }
}
