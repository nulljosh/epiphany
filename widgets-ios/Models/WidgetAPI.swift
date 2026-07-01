import Foundation

struct WidgetAPI {
    static let baseURL = "https://epiphany.heyitsmejosh.com"
    private static var defaults: UserDefaults? { UserDefaults(suiteName: "group.com.heyitsmejosh.epiphany") }

    private static var session: URLSession {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 10
        config.timeoutIntervalForResource = 15
        return URLSession(configuration: config)
    }

    // MARK: - Stocks

    static func fetchStocks() async throws -> [WidgetStock] {
        let data = try await fetch("/api/stocks-free")
        let stocks = try JSONDecoder().decode([WidgetStock].self, from: data)
        cache(data, forKey: "stocks")
        return stocks
    }

    static func cachedStocks() -> [WidgetStock] {
        guard let data = defaults?.data(forKey: "widget_stocks") else { return [] }
        return (try? JSONDecoder().decode([WidgetStock].self, from: data)) ?? []
    }

    // MARK: - Commodities

    static func fetchCommodities() async throws -> [WidgetCommodity] {
        let data = try await fetch("/api/commodities")
        let decoded = try JSONDecoder().decode([String: CommodityAPIResponse].self, from: data)
        let result = decoded
            .map { WidgetCommodity(name: $0.key.capitalized, price: $0.value.price, change: $0.value.change, changePercent: $0.value.changePercent) }
            .sorted { $0.name < $1.name }
        cache(data, forKey: "commodities")
        return result
    }

    static func cachedCommodities() -> [WidgetCommodity] {
        guard let data = defaults?.data(forKey: "widget_commodities") else { return [] }
        let decoded = try? JSONDecoder().decode([String: CommodityAPIResponse].self, from: data)
        return decoded?
            .map { WidgetCommodity(name: $0.key.capitalized, price: $0.value.price, change: $0.value.change, changePercent: $0.value.changePercent) }
            .sorted { $0.name < $1.name } ?? []
    }

    // MARK: - Crypto

    static func fetchCrypto() async throws -> [WidgetCrypto] {
        let data = try await fetch("/api/prices")
        let decoded = try JSONDecoder().decode([String: CryptoAPIResponse].self, from: data)
        let result = decoded
            .map { WidgetCrypto(symbol: $0.key.uppercased(), spot: $0.value.spot, chgPct: $0.value.chgPct) }
            .sorted { $0.symbol < $1.symbol }
        cache(data, forKey: "crypto")
        return result
    }

    static func cachedCrypto() -> [WidgetCrypto] {
        guard let data = defaults?.data(forKey: "widget_crypto") else { return [] }
        let decoded = try? JSONDecoder().decode([String: CryptoAPIResponse].self, from: data)
        return decoded?
            .map { WidgetCrypto(symbol: $0.key.uppercased(), spot: $0.value.spot, chgPct: $0.value.chgPct) }
            .sorted { $0.symbol < $1.symbol } ?? []
    }

    // MARK: - Internal

    private static func fetch(_ path: String) async throws -> Data {
        guard let url = URL(string: baseURL + path) else {
            throw URLError(.badURL)
        }
        let (data, response) = try await session.data(from: url)
        guard let http = response as? HTTPURLResponse, 200..<300 ~= http.statusCode else {
            throw URLError(.badServerResponse)
        }
        return data
    }

    private static func cache(_ data: Data, forKey key: String) {
        defaults?.set(data, forKey: "widget_\(key)")
        defaults?.set(Date().timeIntervalSince1970, forKey: "widget_\(key)_time")
    }
}
