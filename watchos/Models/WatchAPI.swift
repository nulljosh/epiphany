import Foundation

final class WatchAPI {
    static let shared = WatchAPI()

    private let baseURL = "https://epiphany.heyitsmejosh.com"
    private let session: URLSession
    private let decoder = JSONDecoder()
    private let defaults = UserDefaults(suiteName: "group.com.jt.monica")

    private init() {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 10
        config.timeoutIntervalForResource = 15
        session = URLSession(configuration: config)
    }

    // MARK: - Stocks (free endpoint)

    func fetchStocks() async throws -> [WatchStock] {
        let data = try await fetch("/api/stocks-free")
        let stocks = try decoder.decode([WatchStock].self, from: data)
        cache(data, forKey: "stocks")
        return stocks
    }

    func cachedStocks() -> [WatchStock]? {
        guard let data = defaults?.data(forKey: "cache_stocks") else { return nil }
        return try? decoder.decode([WatchStock].self, from: data)
    }

    // MARK: - Commodities

    func fetchCommodities() async throws -> [WatchCommodity] {
        let data = try await fetch("/api/commodities")
        let decoded = try decoder.decode([String: CommodityResponse].self, from: data)
        let commodities = decoded
            .map { WatchCommodity(name: $0.key.capitalized, price: $0.value.price, change: $0.value.change, changePercent: $0.value.changePercent) }
            .sorted { $0.name < $1.name }
        cache(data, forKey: "commodities")
        return commodities
    }

    func cachedCommodities() -> [WatchCommodity]? {
        guard let data = defaults?.data(forKey: "cache_commodities") else { return nil }
        let decoded = try? decoder.decode([String: CommodityResponse].self, from: data)
        return decoded?
            .map { WatchCommodity(name: $0.key.capitalized, price: $0.value.price, change: $0.value.change, changePercent: $0.value.changePercent) }
            .sorted { $0.name < $1.name }
    }

    // MARK: - Crypto

    func fetchCrypto() async throws -> [WatchCrypto] {
        let data = try await fetch("/api/prices")
        let decoded = try decoder.decode([String: CryptoResponse].self, from: data)
        let crypto = decoded
            .map { WatchCrypto(symbol: $0.key.uppercased(), spot: $0.value.spot, chgPct: $0.value.chgPct) }
            .sorted { $0.symbol < $1.symbol }
        cache(data, forKey: "crypto")
        return crypto
    }

    func cachedCrypto() -> [WatchCrypto]? {
        guard let data = defaults?.data(forKey: "cache_crypto") else { return nil }
        let decoded = try? decoder.decode([String: CryptoResponse].self, from: data)
        return decoded?
            .map { WatchCrypto(symbol: $0.key.uppercased(), spot: $0.value.spot, chgPct: $0.value.chgPct) }
            .sorted { $0.symbol < $1.symbol }
    }

    // MARK: - Internal

    private func fetch(_ path: String) async throws -> Data {
        guard let url = URL(string: baseURL + path) else {
            throw URLError(.badURL)
        }
        let (data, response) = try await session.data(from: url)
        guard let http = response as? HTTPURLResponse, 200..<300 ~= http.statusCode else {
            throw URLError(.badServerResponse)
        }
        return data
    }

    private func cache(_ data: Data, forKey key: String) {
        defaults?.set(data, forKey: "cache_\(key)")
        defaults?.set(Date().timeIntervalSince1970, forKey: "cache_\(key)_time")
    }
}
