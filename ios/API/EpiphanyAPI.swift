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
            if code == 503 { return "Server temporarily unavailable. Please try again." }
            if code == 429 { return message }
            return message
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
final class EpiphanyAPI: @unchecked Sendable {
    static let shared = EpiphanyAPI()

    private let baseURL = "https://epiphany.heyitsmejosh.com"
    private let session: URLSession
    private let decoder: JSONDecoder

    // Simple time-based cache
    private var cache: [String: (data: Any, time: Date)] = [:]
    private let cacheTTL: TimeInterval = 120 // 2 minutes

    private func cached<T>(_ key: String) -> T? {
        guard let entry = cache[key],
              Date().timeIntervalSince(entry.time) < cacheTTL,
              let value = entry.data as? T else { return nil }
        return value
    }

    private func setCache<T>(_ key: String, _ value: T) {
        cache[key] = (data: value, time: Date())
    }

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

    func forgotPassword(email: String) async throws {
        let url = try makeURL("/api/auth", query: ["action": "forgot-password"])
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(["email": email])
        _ = try await perform(request)
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

    func changeName(name: String) async throws -> User {
        let response: AuthActionResponse = try await postAuthAction(
            "change-name",
            body: ["name": name]
        )
        guard let user = response.user else {
            throw APIError.decodingError("No user in change-name response")
        }
        return user
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

    func fetchStockQuote(symbol: String) async throws -> Stock? {
        let url = try makeURL("/api/stocks-free", query: ["symbols": symbol])
        var request = URLRequest(url: url)
        request.cachePolicy = .reloadIgnoringLocalCacheData
        let data = try await perform(request)
        return try decode([Stock].self, from: data).first
    }

    func fetchPriceHistory(symbol: String, range: String = "1y") async throws -> PriceHistory {
        let interval: String
        switch range {
        case "1d": interval = "5m"
        case "5d": interval = "15m"
        default: interval = "1d"
        }
        let url = try makeURL("/api/history", query: [
            "symbol": symbol,
            "range": range,
            "interval": interval
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

    struct FearGreedResponse: Codable {
        let score: Int
        let rating: String
    }

    func fetchFearGreed() async throws -> FearGreedResponse {
        let url = try makeURL("/api/fear-greed")
        let request = URLRequest(url: url)
        let data = try await perform(request)
        return try decode(FearGreedResponse.self, from: data)
    }

    func fetchNews() async throws -> [NewsArticle] {
        if let cached: [NewsArticle] = cached("news") { return cached }
        let url = try makeURL("/api/news")
        let request = URLRequest(url: url)
        let data = try await perform(request)
        let wrapper = try decode(NewsWrapper.self, from: data)
        setCache("news", wrapper.articles)
        return wrapper.articles
    }

    func fetchStockNews(query: String) async throws -> [NewsArticle] {
        let cacheKey = "news:\(query)"
        if let cached: [NewsArticle] = cached(cacheKey) { return cached }
        let url = try makeURL("/api/news", query: ["q": query])
        let request = URLRequest(url: url)
        let data = try await perform(request)
        let wrapper = try decode(NewsWrapper.self, from: data)
        setCache(cacheKey, wrapper.articles)
        return wrapper.articles
    }

    func fetchMacro() async throws -> [MacroIndicator] {
        let url = try makeURL("/api/macro")
        let request = URLRequest(url: url)
        let data = try await perform(request)
        return try decode([MacroIndicator].self, from: data)
    }

    func fetchDailyBrief() async throws -> DailyBrief {
        if let cached: DailyBrief = cached("daily-brief") { return cached }
        let url = try makeURL("/api/daily-brief")
        let request = URLRequest(url: url)
        let data = try await perform(request)
        let brief = try decode(DailyBrief.self, from: data)
        setCache("daily-brief", brief)
        return brief
    }

    // MARK: - Tally

    struct TallyResponse: Decodable {
        struct NextPayment: Decodable {
            let date: String
            let daysUntil: Int
            let amount: String?
        }
        let nextPayment: NextPayment
    }

    func fetchNextPayday() async throws -> TallyResponse.NextPayment {
        let url = try makeURL("/api/tally", query: ["action": "next-payment"])
        let request = URLRequest(url: url)
        let data = try await perform(request)
        let response = try decode(TallyResponse.self, from: data)
        return response.nextPayment
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
        // Add _fullReplace flag so server does a full overwrite
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

    func fetchEarthquakes(lat: Double? = nil, lon: Double? = nil, radius: Int = 500) async throws -> [Earthquake] {
        var params: [String: String] = ["radius": "\(radius)"]
        if let lat { params["lat"] = "\(lat)" }
        if let lon { params["lon"] = "\(lon)" }
        let url = try makeURL("/api/earthquakes", query: params)
        let request = URLRequest(url: url)
        let data = try await perform(request)
        return try decode(EarthquakeResponse.self, from: data).earthquakes
    }

    func fetchFlights(lamin: Double, lomin: Double, lamax: Double, lomax: Double) async throws -> [Flight] {
        let url = try makeURL("/api/flights", query: [
            "lamin": String(lamin),
            "lomin": String(lomin),
            "lamax": String(lamax),
            "lomax": String(lomax),
        ])
        let request = URLRequest(url: url)
        let data = try await perform(request)
        return try decode(FlightResponse.self, from: data).states
    }

    func fetchIncidents(lat: Double, lon: Double, lamin: Double? = nil, lomin: Double? = nil, lamax: Double? = nil, lomax: Double? = nil) async throws -> [Incident] {
        var params: [String: String] = ["lat": String(lat), "lon": String(lon)]
        if let lamin, let lomin, let lamax, let lomax {
            params["lamin"] = String(lamin)
            params["lomin"] = String(lomin)
            params["lamax"] = String(lamax)
            params["lomax"] = String(lomax)
        }
        let url = try makeURL("/api/incidents", query: params)
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
        let url = try makeURL("/api/crime", query: [
            "lat": String(lat),
            "lon": String(lon),
        ])
        let request = URLRequest(url: url)
        let data = try await perform(request)
        return try decode(CrimeResponse.self, from: data).incidents
    }

    func fetchLocalEvents(lat: Double, lon: Double) async throws -> [LocalEvent] {
        let url = try makeURL("/api/local-events", query: [
            "lat": String(lat),
            "lon": String(lon),
        ])
        let request = URLRequest(url: url)
        let data = try await perform(request)
        return try decode(LocalEventResponse.self, from: data).events
    }

    func fetchTraffic(lat: Double, lon: Double, lamin: Double? = nil, lomin: Double? = nil, lamax: Double? = nil, lomax: Double? = nil) async throws -> TrafficData {
        var params: [String: String] = ["lat": String(lat), "lon": String(lon)]
        if let lamin, let lomin, let lamax, let lomax {
            params["lamin"] = String(lamin)
            params["lomin"] = String(lomin)
            params["lamax"] = String(lamax)
            params["lomax"] = String(lomax)
        }
        let url = try makeURL("/api/traffic", query: params)
        let request = URLRequest(url: url)
        let data = try await perform(request)
        return try decode(TrafficData.self, from: data)
    }

    func fetchWildfires(lat: Double, lon: Double) async throws -> [Wildfire] {
        let url = try makeURL("/api/wildfires", query: [
            "lat": String(lat),
            "lon": String(lon),
        ])
        let request = URLRequest(url: url)
        let data = try await perform(request)
        let response = try decode(WildfireResponse.self, from: data)
        return response.fires
    }

    func fetchAQI(lat: Double, lon: Double) async throws -> [AQIReading] {
        let url = try makeURL("/api/aqi", query: [
            "lat": String(lat),
            "lon": String(lon),
        ])
        let request = URLRequest(url: url)
        let data = try await perform(request)
        return try decode(AQIResponse.self, from: data).readings
    }

    // MARK: - People Search

    func fetchPeople(query: String) async throws -> PersonProfile {
        let url = try makeURL("/api/people", query: ["q": query])
        let request = URLRequest(url: url)
        let data = try await perform(request)
        return try decode(PersonProfile.self, from: data)
    }

    // MARK: - People Index

    func fetchPeopleIndex() async throws -> [IndexedPerson] {
        let url = try makeURL("/api/people-index")
        let request = URLRequest(url: url)
        let data = try await perform(request)
        let response = try decode(PeopleIndexResponse.self, from: data)
        return response.people
    }

    func indexPerson(_ person: IndexedPerson) async throws -> IndexedPerson {
        let url = try makeURL("/api/people-index")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(person)
        let data = try await perform(request)
        let response = try decode(IndexPersonResponse.self, from: data)
        return response.person ?? person
    }

    func updatePerson(_ person: IndexedPerson) async throws -> IndexedPerson {
        try await indexPerson(person)
    }

    func deletePerson(id: String) async throws {
        let url = try makeURL("/api/people-index", query: ["id": id])
        var request = URLRequest(url: url)
        request.httpMethod = "DELETE"
        _ = try await perform(request)
    }

    func enrichPerson(personId: String) async throws -> PersonEnrichment? {
        let url = try makeURL("/api/people-enrich")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(["personId": personId])
        let data = try await perform(request)
        let response = try decode(EnrichResponse.self, from: data)
        return response.enrichment
    }

    func fetchCrossref(personId: String) async throws -> [NewsMention] {
        let url = try makeURL("/api/people-crossref", query: ["personId": personId])
        let request = URLRequest(url: url)
        let data = try await perform(request)
        let response = try decode(CrossrefResponse.self, from: data)
        return response.mentions
    }

    // MARK: - Article Extraction

    struct ArticleContent: Decodable {
        let title: String
        let content: String
        let htmlContent: String?
        let author: String?
        let siteName: String?
        let excerpt: String?
    }

    func fetchArticle(url: String) async throws -> ArticleContent {
        let apiUrl = try makeURL("/api/defuddle", query: ["url": url])
        let request = URLRequest(url: apiUrl)
        let data = try await perform(request)
        return try decode(ArticleContent.self, from: data)
    }

    // MARK: - Avatar

    @discardableResult
    func uploadAvatar(imageData: Data) async throws -> String {
        let url = try makeURL("/api/avatar")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let body = ["image": imageData.base64EncodedString()]
        request.httpBody = try JSONEncoder().encode(body)
        let data = try await perform(request)
        let response = try decode(AvatarResponse.self, from: data)
        guard let avatarUrl = response.avatarUrl else {
            throw APIError.decodingError("No avatarUrl in response")
        }
        return avatarUrl
    }

    func deleteAvatar() async throws {
        let url = try makeURL("/api/avatar")
        var request = URLRequest(url: url)
        request.httpMethod = "DELETE"
        _ = try await perform(request)
    }

    // MARK: - Ontology

    func fetchOntologyStats() async throws -> OntologyStatsResponse {
        let url = try makeURL("/api/ontology", query: ["action": "stats"])
        let data = try await perform(URLRequest(url: url))
        return try decode(OntologyStatsResponse.self, from: data)
    }

    func listOntologyObjects(type: OntologyObjectType, limit: Int = 50) async throws -> [OntologyObject] {
        let url = try makeURL("/api/ontology", query: ["action": "list", "type": type.rawValue, "limit": String(limit)])
        let data = try await perform(URLRequest(url: url))
        let response = try decode(OntologyListResponse.self, from: data)
        return response.objects
    }

    func getOntologyObject(id: String) async throws -> OntologyObject {
        let url = try makeURL("/api/ontology", query: ["action": "get", "id": id])
        let data = try await perform(URLRequest(url: url))
        return try decode(OntologyObject.self, from: data)
    }

    func upsertOntologyObject(_ object: OntologyObject) async throws {
        let url = try makeURL("/api/ontology", query: ["action": "upsert"])
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(object)
        _ = try await perform(request)
    }

    func batchUpsertOntology(_ objects: [OntologyObject]) async throws -> Int {
        let url = try makeURL("/api/ontology", query: ["action": "batch"])
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(["objects": objects])
        let data = try await perform(request)
        let response = try decode(OntologyBatchResponse.self, from: data)
        return response.upserted
    }

    func linkOntologyObjects(type: RelationshipType, sourceId: String, targetId: String) async throws {
        let url = try makeURL("/api/ontology", query: ["action": "link"])
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let body: [String: String] = ["type": type.rawValue, "sourceId": sourceId, "targetId": targetId]
        request.httpBody = try JSONEncoder().encode(body)
        _ = try await perform(request)
    }

    func getOntologyRelationships(id: String) async throws -> OntologyRelationshipsResponse {
        let url = try makeURL("/api/ontology", query: ["action": "relationships", "id": id])
        let data = try await perform(URLRequest(url: url))
        return try decode(OntologyRelationshipsResponse.self, from: data)
    }

    func queryOntology(type: OntologyObjectType, key: String? = nil, value: String? = nil) async throws -> [OntologyObject] {
        var params = ["action": "query", "type": type.rawValue]
        if let key { params["key"] = key }
        if let value { params["value"] = value }
        let url = try makeURL("/api/ontology", query: params)
        let data = try await perform(URLRequest(url: url))
        let response = try decode(OntologyListResponse.self, from: data)
        return response.objects
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
        let maxRetries = 2
        var lastError: Error?

        for attempt in 0...maxRetries {
            if attempt > 0 {
                try? await Task.sleep(for: .seconds(1))
            }

            let data: Data
            let response: URLResponse
            do {
                (data, response) = try await session.data(for: request)
            } catch let urlError as URLError {
                switch urlError.code {
                case .timedOut, .networkConnectionLost:
                    lastError = APIError.networkError(urlError.localizedDescription)
                    continue
                case .notConnectedToInternet:
                    throw APIError.networkError("No internet connection")
                default:
                    throw APIError.networkError(urlError.localizedDescription)
                }
            }

            guard let http = response as? HTTPURLResponse else {
                throw APIError.httpError(0, "No HTTP response")
            }

            if http.statusCode == 503 && attempt < maxRetries {
                lastError = APIError.httpError(503, "Server temporarily unavailable")
                continue
            }

            guard (200...299).contains(http.statusCode) else {
                if http.statusCode == 401 { throw APIError.unauthorized }
                let body = String(data: data, encoding: .utf8) ?? "unknown"
                let message = Self.parseErrorMessage(body) ?? body
                throw APIError.httpError(http.statusCode, message)
            }
            return data
        }

        throw lastError ?? APIError.networkError("Request failed after retries")
    }

    private static func parseErrorMessage(_ body: String) -> String? {
        guard let data = body.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let error = json["error"] as? String
        else { return nil }
        return error
    }

    private func decode<T: Decodable>(_ type: T.Type, from data: Data) throws -> T {
        do {
            return try decoder.decode(type, from: data)
        } catch {
            let preview = String(data: data.prefix(500), encoding: .utf8) ?? "<binary>"
            print("[EpiphanyAPI] Decode \(T.self) failed: \(error)")
            print("[EpiphanyAPI] Response body: \(preview)")
            throw APIError.decodingError("Failed to decode \(T.self): \(error.localizedDescription)")
        }
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

private struct FlightResponse: Decodable {
    let states: [Flight]
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

private struct AvatarResponse: Decodable {
    let ok: Bool?
    let avatarUrl: String?
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
        let open: Double?
        let high: Double?
        let low: Double?
        let close: Double
        let volume: Int?

        var id: String { date }

        var parsedDate: Date? {
            DateParsing.parse(date)
        }
    }
}
