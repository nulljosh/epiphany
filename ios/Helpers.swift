import SwiftUI
import Security
import UIKit

// MARK: - Portfolio Palette

enum Palette {
    // Adaptive (follows system appearance)
    private static func adaptive(dark: UIColor, light: UIColor) -> Color {
        Color(UIColor { $0.userInterfaceStyle == .dark ? dark : light })
    }

    static let bg = adaptive(
        dark: UIColor(red: 0x11/255, green: 0x11/255, blue: 0x11/255, alpha: 1),
        light: .white
    )
    static let text = adaptive(
        dark: UIColor(red: 0xDD/255, green: 0xDD/255, blue: 0xDD/255, alpha: 1),
        light: UIColor(red: 0x11/255, green: 0x11/255, blue: 0x11/255, alpha: 1)
    )
    static let overlay = adaptive(dark: .white, light: .black)

    // Semantic (clrs.cc)
    static let appleBlue = Color(hex: "0074D9")
    static let successGreen = Color(hex: "2ECC40")
    static let dangerRed = Color(hex: "FF4136")
    static let warningAmber = Color(hex: "FF851B")

    // Category (clrs.cc)
    static let purple = Color(hex: "B10DC9")
    static let cyan = Color(hex: "7FDBFF")
    static let pink = Color(hex: "F012BE")
    static let yellow = Color(hex: "FFDC00")
    static let brown = Color(hex: "85144b")
    static let indigo = Color(hex: "001f3f")

    // Extended (clrs.cc)
    static let olive = Color(hex: "3D9970")
    static let lime = Color(hex: "01FF70")
    static let silver = Color(hex: "DDDDDD")
    static let gray = Color(hex: "AAAAAA")

    static func forChange(_ value: Double) -> Color {
        value >= 0 ? successGreen : dangerRed
    }
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

    static func formatPrice(_ value: Double) -> String {
        String(format: "$%.2f", value)
    }

    static func formatSignedPercent(_ value: Double, decimals: Int = 2) -> String {
        String(format: "%@%.\(decimals)f%%", value >= 0 ? "+" : "", value)
    }
}


// MARK: - Haptics

@MainActor
enum Haptics {
    static func impact(_ style: UIImpactFeedbackGenerator.FeedbackStyle = .medium) {
        UIImpactFeedbackGenerator(style: style).impactOccurred()
    }

    static func notification(_ type: UINotificationFeedbackGenerator.FeedbackType) {
        UINotificationFeedbackGenerator().notificationOccurred(type)
    }

    static func selection() {
        UISelectionFeedbackGenerator().selectionChanged()
    }
}

// MARK: - Keychain

enum KeychainHelper {
    private static let service = "com.heyitsmejosh.opticon"
    static let savedEmailKey = "opticon_saved_email"

    @discardableResult
    static func save(account: String, password: String) -> Bool {
        let data = Data(password.utf8)
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]
        SecItemDelete(query as CFDictionary)
        var addQuery = query
        addQuery[kSecValueData as String] = data
        addQuery[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        let status = SecItemAdd(addQuery as CFDictionary, nil)
        return status == errSecSuccess
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
