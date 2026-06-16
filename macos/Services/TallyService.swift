import Foundation
import Security

struct TallyPaymentInfo: Codable, Sendable {
    let paymentAmount: String?
    let nextPaymentDate: String?

    enum CodingKeys: String, CodingKey {
        case paymentAmount = "payment_amount"
        case nextPaymentDate = "next_date"
    }

    var parsedNextDate: Date? {
        guard let raw = nextPaymentDate, !raw.isEmpty else { return nil }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        for format in ["yyyy-MM-dd", "MMM d, yyyy", "MMMM d, yyyy"] {
            formatter.dateFormat = format
            if let date = formatter.date(from: raw) { return date }
        }
        return nil
    }

    var daysUntilPayday: Int? {
        guard let date = parsedNextDate else { return nil }
        let start = Calendar.current.startOfDay(for: Date())
        let end = Calendar.current.startOfDay(for: date)
        return Calendar.current.dateComponents([.day], from: start, to: end).day
    }
}

enum TallyService {
    private static let baseURL = "https://tally.heyitsmejosh.com"
    private static let keychainService = "com.heyitsmejosh.monica.tally"
    private static let keychainAccount = "tally-credentials"

    struct Credentials: Codable {
        let username: String
        let password: String
    }

    // MARK: - Keychain

    @discardableResult
    static func saveCredentials(username: String, password: String) -> Bool {
        let creds = Credentials(username: username, password: password)
        guard let data = try? JSONEncoder().encode(creds) else { return false }

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: keychainService,
            kSecAttrAccount as String: keychainAccount
        ]
        SecItemDelete(query as CFDictionary)

        var addQuery = query
        addQuery[kSecValueData as String] = data
        addQuery[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        let status = SecItemAdd(addQuery as CFDictionary, nil)
        return status == errSecSuccess
    }

    static func loadCredentials() -> Credentials? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: keychainService,
            kSecAttrAccount as String: keychainAccount,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        var item: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess,
              let data = item as? Data,
              let creds = try? JSONDecoder().decode(Credentials.self, from: data) else {
            return nil
        }
        return creds
    }

    static func clearCredentials() {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: keychainService,
            kSecAttrAccount as String: keychainAccount
        ]
        SecItemDelete(query as CFDictionary)
    }

    // MARK: - API

    enum TallyError: LocalizedError {
        case badURL
        case networkError(String)
        case authFailed
        case timeout
        case serverError(Int)

        var errorDescription: String? {
            switch self {
            case .badURL: return "Invalid Tally URL"
            case .networkError(let detail): return "Tally network error: \(detail)"
            case .authFailed: return "Tally authentication failed. Check your credentials."
            case .timeout: return "Tally request timed out. Try again later."
            case .serverError(let code): return "Tally server error (\(code)). Try again later."
            }
        }
    }

    private static let session: URLSession = {
        let config = URLSessionConfiguration.default
        config.httpCookieAcceptPolicy = .always
        config.httpCookieStorage = HTTPCookieStorage.shared
        config.timeoutIntervalForRequest = 15
        config.timeoutIntervalForResource = 30
        return URLSession(configuration: config)
    }()

    static func login(username: String, password: String) async throws -> Bool {
        guard let url = URL(string: "\(baseURL)/api/login") else {
            throw TallyError.badURL
        }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let body = ["username": username, "password": password]
        request.httpBody = try JSONEncoder().encode(body)

        let response: URLResponse
        do {
            (_, response) = try await session.data(for: request)
        } catch let urlError as URLError where urlError.code == .timedOut {
            throw TallyError.timeout
        } catch {
            throw TallyError.networkError(error.localizedDescription)
        }
        guard let http = response as? HTTPURLResponse else {
            throw TallyError.networkError("No HTTP response")
        }
        if http.statusCode == 401 || http.statusCode == 403 {
            throw TallyError.authFailed
        }
        guard (200...299).contains(http.statusCode) else {
            throw TallyError.serverError(http.statusCode)
        }
        return true
    }

    static func fetchPaymentInfo() async throws -> TallyPaymentInfo {
        guard let url = URL(string: "\(baseURL)/api/mobile") else {
            throw TallyError.badURL
        }
        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(from: url)
        } catch let urlError as URLError where urlError.code == .timedOut {
            throw TallyError.timeout
        } catch {
            throw TallyError.networkError(error.localizedDescription)
        }
        guard let http = response as? HTTPURLResponse else {
            throw TallyError.networkError("No HTTP response")
        }
        if http.statusCode == 401 || http.statusCode == 403 {
            throw TallyError.authFailed
        }
        guard (200...299).contains(http.statusCode) else {
            throw TallyError.serverError(http.statusCode)
        }
        return try JSONDecoder().decode(TallyPaymentInfo.self, from: data)
    }
}
