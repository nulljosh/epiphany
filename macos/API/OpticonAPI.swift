import Foundation

enum APIError: LocalizedError {
    case invalidURL
    case httpError(Int, String)
    case decodingError(String)
    case unauthorized
    case networkError(String)

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid URL"
        case .httpError(let code, let message):
            return "HTTP \(code): \(message)"
        case .decodingError(let detail):
            return "Decode error: \(detail)"
        case .unauthorized:
            return "Not authenticated"
        case .networkError(let detail):
            return "Network error: \(detail)"
        }
    }
}

@MainActor
final class OpticonAPI {
    static let shared = OpticonAPI()

    private let baseURL = "https://opticon.heyitsmejosh.com"
    private let session: URLSession
    private let decoder: JSONDecoder

    private init() {
        let config = URLSessionConfiguration.default
        config.httpCookieStorage = HTTPCookieStorage.shared
        config.httpCookieAcceptPolicy = .always
        config.httpShouldSetCookies = true
        config.timeoutIntervalForRequest = 15
        config.timeoutIntervalForResource = 30
        session = URLSession(configuration: config)
        decoder = JSONDecoder()
    }

    // MARK: - Auth

    func login(email: String, password: String) async throws -> User {
        try await authRequest(action: "login", email: email, password: password)
    }

    func register(email: String, password: String) async throws -> User {
        try await authRequest(action: "register", email: email, password: password)
    }

    private func authRequest(action: String, email: String, password: String) async throws -> User {
        let url = try makeURL("/api/auth", query: ["action": action])
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(["email": email, "password": password])

        let data = try await perform(request)
        let wrapper = try decode(AuthResponse.self, from: data)
        guard let user = wrapper.user else {
            throw APIError.decodingError("No user in auth response")
        }
        return user
    }

    func logout() async throws {
        let url = try makeURL("/api/auth", query: ["action": "logout"])
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        _ = try await perform(request)
    }

    func me() async throws -> User {
        let url = try makeURL("/api/auth", query: ["action": "me"])
        let request = URLRequest(url: url)
        let data = try await perform(request)
        let wrapper = try decode(AuthResponse.self, from: data)
        guard wrapper.authenticated == true, let user = wrapper.user else {
            throw APIError.unauthorized
        }
        return user
    }

    func changeEmail(newEmail: String, password: String) async throws -> User {
        let response: AuthActionResponse = try await postAuthAction(
            "change-email",
            body: ["newEmail": newEmail, "password": password]
        )
        guard let user = response.user else {
            throw APIError.decodingError("No user in change-email response")
        }
        return user
    }

    func changePassword(currentPassword: String, newPassword: String) async throws {
        let _: AuthActionResponse = try await postAuthAction(
            "change-password",
            body: ["currentPassword": currentPassword, "newPassword": newPassword]
        )
    }

    func deleteAccount(password: String) async throws {
        let _: AuthActionResponse = try await postAuthAction(
            "delete-account",
            body: ["password": password]
        )
    }

    private func postAuthAction<T: Decodable>(_ action: String, body: [String: String]) async throws -> T {
        let url = try makeURL("/api/auth", query: ["action": action])
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(body)
        let data = try await perform(request)
        return try decode(T.self, from: data)
    }

    // MARK: - Market Data

    func fetchStocks() async throws -> [Stock] {
        let url = try makeURL("/api/stocks")
        let request = URLRequest(url: url)
        let data = try await perform(request)
        return try decode([Stock].self, from: data)
    }

    func fetchPriceHistory(symbol: String, range: String = "1y") async throws -> PriceHistory {
        let url = try makeURL("/api/history", query: [
            "symbol": symbol,
            "range": range
        ])
        let request = URLRequest(url: url)
        let data = try await perform(request)
        return try decode(PriceHistory.self, from: data)
    }

    func fetchCommodities() async throws -> [CommodityData] {
        let url = try makeURL("/api/commodities")
        let request = URLRequest(url: url)
        let data = try await perform(request)
        let decoded = try decode([String: CommodityResponse].self, from: data)
        return decoded
            .map { key, value in
                CommodityData(
                    name: key.capitalized,
                    price: value.price,
                    change: value.change,
                    changePercent: value.changePercent
                )
            }
            .sorted { $0.name < $1.name }
    }

    func fetchCrypto() async throws -> [CryptoData] {
        let url = try makeURL("/api/prices")
        let request = URLRequest(url: url)
        let data = try await perform(request)
        let decoded = try decode([String: CryptoResponse].self, from: data)
        return decoded
            .map { key, value in
                CryptoData(symbol: key.uppercased(), spot: value.spot, chgPct: value.chgPct)
            }
            .sorted { $0.symbol < $1.symbol }
    }

    func fetchNews() async throws -> [NewsArticle] {
        let url = try makeURL("/api/news")
        let request = URLRequest(url: url)
        let data = try await perform(request)
        let wrapper = try decode(NewsWrapper.self, from: data)
        return wrapper.articles
    }

    func fetchMacro() async throws -> [MacroIndicator] {
        let url = try makeURL("/api/macro")
        let request = URLRequest(url: url)
        let data = try await perform(request)
        return try decode([MacroIndicator].self, from: data)
    }

    // MARK: - Portfolio

    func fetchPortfolio() async throws -> Portfolio {
        let url = try makeURL("/api/portfolio", query: ["action": "get"])
        let request = URLRequest(url: url)
        let data = try await perform(request)
        return try decode(Portfolio.self, from: data)
    }

    func fetchFinanceData() async throws -> FinanceData {
        let url = try makeURL("/api/portfolio", query: ["action": "get"])
        let request = URLRequest(url: url)
        let data = try await perform(request)
        return try decode(FinanceData.self, from: data)
    }

    func updateFinanceData(_ financeData: FinanceData) async throws {
        let url = try makeURL("/api/portfolio", query: ["action": "update"])
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        var payload = try JSONEncoder().encode(financeData)
        if var json = try? JSONSerialization.jsonObject(with: payload) as? [String: Any] {
            json["_fullReplace"] = true
            payload = try JSONSerialization.data(withJSONObject: json)
        }
        request.httpBody = payload
        _ = try await perform(request)
    }

    func fetchStatements() async throws -> [Statement] {
        let url = try makeURL("/api/statements")
        let request = URLRequest(url: url)
        let data = try await perform(request)
        let wrapper = try decode(StatementsWrapper.self, from: data)
        return wrapper.statements
    }

    // MARK: - Watchlist

    func fetchWatchlist() async throws -> [WatchlistItem] {
        let url = try makeURL("/api/watchlist")
        let request = URLRequest(url: url)
        let data = try await perform(request)
        return try decode([WatchlistItem].self, from: data)
    }

    func addToWatchlist(symbol: String) async throws -> WatchlistItem {
        let url = try makeURL("/api/watchlist")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(["symbol": symbol])

        let data = try await perform(request)
        return try decode(WatchlistItem.self, from: data)
    }

    func removeFromWatchlist(symbol: String) async throws {
        let url = try makeURL("/api/watchlist", query: ["symbol": symbol])
        var request = URLRequest(url: url)
        request.httpMethod = "DELETE"
        _ = try await perform(request)
    }

    // MARK: - Alerts

    func fetchAlerts() async throws -> [PriceAlert] {
        let url = try makeURL("/api/alerts")
        let request = URLRequest(url: url)
        let data = try await perform(request)
        return try decode([PriceAlert].self, from: data)
    }

    func createAlert(symbol: String, targetPrice: Double, direction: PriceAlert.Direction) async throws -> PriceAlert {
        let url = try makeURL("/api/alerts")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let body: [String: Any] = [
            "symbol": symbol,
            "target_price": targetPrice,
            "direction": direction.rawValue
        ]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let data = try await perform(request)
        return try decode(PriceAlert.self, from: data)
    }

    func deleteAlert(id: String) async throws {
        let url = try makeURL("/api/alerts", query: ["id": id])
        var request = URLRequest(url: url)
        request.httpMethod = "DELETE"
        _ = try await perform(request)
    }

    // MARK: - Situation Data

    func fetchEarthquakes() async throws -> [Earthquake] {
        let url = try makeURL("/api/earthquakes")
        let request = URLRequest(url: url)
        let data = try await perform(request)
        return try decode(EarthquakeResponse.self, from: data).earthquakes
    }

    func fetchFlights(lamin: Double, lomin: Double, lamax: Double, lomax: Double) async throws -> FlightFeed {
        let url = try makeURL("/api/flights", query: [
            "lamin": String(lamin),
            "lomin": String(lomin),
            "lamax": String(lamax),
            "lomax": String(lomax),
        ])
        let request = URLRequest(url: url)
        let data = try await perform(request)
        return try decode(FlightFeed.self, from: data)
    }

    func fetchIncidents(lat: Double, lon: Double) async throws -> [Incident] {
        let url = try makeURL("/api/incidents", query: [
            "lat": String(lat),
            "lon": String(lon),
        ])
        let request = URLRequest(url: url)
        let data = try await perform(request)
        return try decode(IncidentResponse.self, from: data).incidents
    }

    func fetchWeatherAlerts(lat: Double, lon: Double) async throws -> [WeatherAlert] {
        let url = try makeURL("/api/weather-alerts", query: [
            "lat": String(lat),
            "lon": String(lon),
        ])
        let request = URLRequest(url: url)
        let data = try await perform(request)
        return try decode(WeatherAlertResponse.self, from: data).alerts
    }

    // MARK: - Additional Situation Data

    func fetchCrime(lat: Double, lon: Double) async throws -> [CrimeIncident] {
        let url = try makeURL("/api/crime", query: ["lat": String(lat), "lon": String(lon)])
        let request = URLRequest(url: url)
        let data = try await perform(request)
        return try decode(CrimeResponse.self, from: data).incidents
    }

    func fetchLocalEvents(lat: Double, lon: Double) async throws -> [LocalEvent] {
        let url = try makeURL("/api/local-events", query: ["lat": String(lat), "lon": String(lon)])
        let request = URLRequest(url: url)
        let data = try await perform(request)
        return try decode(LocalEventResponse.self, from: data).events
    }

    func fetchTraffic(lat: Double, lon: Double) async throws -> TrafficData {
        let url = try makeURL("/api/traffic", query: ["lat": String(lat), "lon": String(lon)])
        let request = URLRequest(url: url)
        let data = try await perform(request)
        return try decode(TrafficData.self, from: data)
    }

    // MARK: - Prediction Markets

    func fetchMarkets(limit: Int = 50, order: String = "volume24hr") async throws -> [PredictionMarket] {
        let url = try makeURL("/api/markets", query: [
            "limit": String(limit),
            "order": order,
            "closed": "false",
            "ascending": "false"
        ])
        let request = URLRequest(url: url)
        let data = try await perform(request)
        return try decode([PredictionMarket].self, from: data)
    }

    // MARK: - Internals

    private func makeURL(_ path: String, query: [String: String] = [:]) throws -> URL {
        var components = URLComponents(string: baseURL + path)
        if !query.isEmpty {
            components?.queryItems = query.map { URLQueryItem(name: $0.key, value: $0.value) }
        }
        guard let url = components?.url else { throw APIError.invalidURL }
        return url
    }

    private func perform(_ request: URLRequest) async throws -> Data {
        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: request)
        } catch let urlError as URLError {
            switch urlError.code {
            case .timedOut:
                throw APIError.networkError("Request timed out")
            case .notConnectedToInternet:
                throw APIError.networkError("No internet connection")
            case .networkConnectionLost:
                throw APIError.networkError("Connection lost")
            default:
                throw APIError.networkError(urlError.localizedDescription)
            }
        }

        guard let http = response as? HTTPURLResponse else {
            throw APIError.httpError(0, "No HTTP response")
        }
        guard (200...299).contains(http.statusCode) else {
            if http.statusCode == 401 { throw APIError.unauthorized }
            let body = String(data: data, encoding: .utf8) ?? "unknown"
            throw APIError.httpError(http.statusCode, body)
        }
        return data
    }

    private func decode<T: Decodable>(_ type: T.Type, from data: Data) throws -> T {
        do {
            return try decoder.decode(type, from: data)
        } catch {
            throw APIError.decodingError(error.localizedDescription)
        }
    }

    // MARK: - People

    func fetchPeople(query: String) async throws -> PersonProfile {
        let url = try makeURL("/api/people", query: ["q": query])
        let request = URLRequest(url: url)
        let data = try await perform(request)
        return try decode(PersonProfile.self, from: data)
    }
}

private struct AuthResponse: Decodable {
    let ok: Bool?
    let authenticated: Bool?
    let user: User?
}

private struct AuthActionResponse: Decodable {
    let ok: Bool?
    let message: String?
    let user: User?
}

private struct NewsWrapper: Decodable {
    let articles: [NewsArticle]
}

private struct StatementsWrapper: Decodable {
    let statements: [Statement]
}

private struct EarthquakeResponse: Decodable {
    let earthquakes: [Earthquake]
}

private struct IncidentResponse: Decodable {
    let incidents: [Incident]
}

private struct WeatherAlertResponse: Decodable {
    let alerts: [WeatherAlert]
}

private struct CrimeResponse: Decodable {
    let incidents: [CrimeIncident]
}

private struct LocalEventResponse: Decodable {
    let events: [LocalEvent]
}

private struct CommodityResponse: Decodable {
    let price: Double
    let change: Double
    let changePercent: Double

    private enum CodingKeys: String, CodingKey {
        case price
        case change
        case changePercent
        case change_percent
        case chgPct
        case chg_pct
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        price = try container.decodeIfPresent(Double.self, forKey: .price) ?? 0
        change = try container.decodeIfPresent(Double.self, forKey: .change) ?? 0
        changePercent = try container.decodeIfPresent(Double.self, forKey: .changePercent)
            ?? container.decodeIfPresent(Double.self, forKey: .change_percent)
            ?? container.decodeIfPresent(Double.self, forKey: .chgPct)
            ?? container.decodeIfPresent(Double.self, forKey: .chg_pct)
            ?? 0
    }
}

private struct CryptoResponse: Decodable {
    let spot: Double
    let chgPct: Double

    private enum CodingKeys: String, CodingKey {
        case spot
        case chgPct
        case chg_pct
        case changePercent
        case change_percent
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        spot = try container.decodeIfPresent(Double.self, forKey: .spot) ?? 0
        chgPct = try container.decodeIfPresent(Double.self, forKey: .chgPct)
            ?? container.decodeIfPresent(Double.self, forKey: .chg_pct)
            ?? container.decodeIfPresent(Double.self, forKey: .changePercent)
            ?? container.decodeIfPresent(Double.self, forKey: .change_percent)
            ?? 0
    }
}

// MARK: - Price History

struct PriceHistory: Codable {
    let history: [DataPoint]

    struct DataPoint: Codable, Identifiable {
        let date: String
        let close: Double
        let volume: Int?

        var id: String { date }

        private static let dateFormatter: DateFormatter = {
            let formatter = DateFormatter()
            formatter.dateFormat = "yyyy-MM-dd"
            return formatter
        }()

        var parsedDate: Date? {
            Self.dateFormatter.date(from: date)
        }
    }
}