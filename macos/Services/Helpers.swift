import SwiftUI
import Security

// MARK: - Portfolio Palette

enum Palette {
    static let bgLight = Color(hex: "fafafa")
    static let bgDark = Color(hex: "111111")
    static let textLight = Color(hex: "000000")
    static let textDark = Color(hex: "e8e8e8")

    // Semantic
    static let appleBlue = Color(hex: "0071e3")
    static let successGreen = Color(hex: "34c759")
    static let dangerRed = Color(hex: "ff3b30")
    static let warningAmber = Color(hex: "ff9f0a")
    static let warningAmberAlt = Color(hex: "f5a623")

    // Category
    static let purple = Color(hex: "BF5AF2")
    static let cyan = Color(hex: "64D2FF")
    static let cyanAlt = Color(hex: "5AC8FA")
    static let pink = Color(hex: "FF375F")
    static let yellow = Color(hex: "FFD60A")
    static let brown = Color(hex: "AC8E68")
    static let indigo = Color(hex: "5E5CE6")

    // Accent
    static let ultraPurple = Color(hex: "7d5cff")
    static let chartBlue = Color(hex: "32ade6")
    static let linkBlue = Color(hex: "0a84ff")
    static let mapBlue = Color(hex: "4da3ff")
}

extension Color {
    init(hex: String) {
        let scanner = Scanner(string: hex)
        var rgb: UInt64 = 0
        scanner.scanHexInt64(&rgb)
        self.init(
            red: Double((rgb >> 16) & 0xFF) / 255,
            green: Double((rgb >> 8) & 0xFF) / 255,
            blue: Double(rgb & 0xFF) / 255
        )
    }
}

// MARK: - Currency Formatting

enum CurrencyFormatter {
    static func formatAbbreviated(_ value: Double) -> String {
        if value >= 1_000_000_000_000 { return String(format: "$%.2fT", value / 1_000_000_000_000) }
        if value >= 1_000_000_000 { return String(format: "$%.2fB", value / 1_000_000_000) }
        if value >= 1_000_000 { return String(format: "$%.2fM", value / 1_000_000) }
        if value >= 1_000 { return String(format: "$%.1fK", value / 1_000) }
        if value >= 1 { return String(format: "$%.2f", value) }
        return String(format: "$%.4f", value)
    }
}

// MARK: - Keychain

enum KeychainHelper {
    private static let service = "com.heyitsmejosh.opticon"
    static let savedEmailKey = "opticon_saved_email"

    static func save(account: String, password: String) {
        let data = Data(password.utf8)
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]
        SecItemDelete(query as CFDictionary)
        var addQuery = query
        addQuery[kSecValueData as String] = data
        SecItemAdd(addQuery as CFDictionary, nil)
    }

    static func load(account: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        var result: AnyObject?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    static func delete(account: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]
        SecItemDelete(query as CFDictionary)
    }
}
