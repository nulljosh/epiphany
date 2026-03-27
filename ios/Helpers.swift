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
        dark: UIColor(red: 0x0A/255, green: 0x0A/255, blue: 0x0A/255, alpha: 1),
        light: .white
    )
    static let text = adaptive(
        dark: UIColor(red: 0xF0/255, green: 0xF0/255, blue: 0xF0/255, alpha: 1),
        light: UIColor(red: 0x0A/255, green: 0x0A/255, blue: 0x0A/255, alpha: 1)
    )
    static let textSecondary = adaptive(
        dark: UIColor(red: 0x9A/255, green: 0x9A/255, blue: 0x9A/255, alpha: 1),
        light: UIColor(red: 0x55/255, green: 0x55/255, blue: 0x55/255, alpha: 1)
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

// MARK: - URL Identifiable

extension URL: @retroactive Identifiable {
    public var id: String { absoluteString }
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


// MARK: - Date Parsing

enum DateParsing {
    private static nonisolated(unsafe) let isoFractional: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()

    private static nonisolated(unsafe) let isoStandard: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f
    }()

    private static let dateOnly: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()

    static func parse(_ text: String) -> Date? {
        isoFractional.date(from: text)
            ?? isoStandard.date(from: text)
            ?? dateOnly.date(from: text)
    }
}

// MARK: - Shared Timeline Chip

struct TimelineChip: View {
    let icon: String
    let label: String
    let detail: String
    let color: Color

    var body: some View {
        VStack(spacing: 6) {
            Image(systemName: icon)
                .font(.body.weight(.semibold))
                .foregroundStyle(color)
            Text(label)
                .font(.caption2.weight(.medium))
                .foregroundStyle(Palette.text)
                .lineLimit(1)
            Text(detail)
                .font(.caption.weight(.bold))
                .foregroundStyle(color)
        }
        .frame(width: 76, height: 76)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(.ultraThinMaterial)
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(color.opacity(0.2), lineWidth: 1)
                )
        )
    }
}

// MARK: - Debt Calculations

enum DebtCalc {
    static func monthsToPayoff(item: FinanceData.DebtItem) -> Double {
        guard item.balance > 0 else { return 0 }
        let payment = item.minPayment
        guard payment > 0 else { return Double.infinity }
        if item.balance <= payment { return 0 }
        let monthlyRate = item.rate / 100.0 / 12.0
        if monthlyRate <= 0 { return item.balance / payment }
        let ratio = item.balance * monthlyRate / payment
        if ratio >= 1.0 { return Double.infinity }
        return -log(1.0 - ratio) / log(1.0 + monthlyRate)
    }

    static func payoffLabel(_ months: Double) -> String {
        if months.isInfinite { return "n/a" }
        if months < 0.1 { return "now" }
        let days = months * 30.44
        if days < 30 { return "\(Int(round(days)))d" }
        return "\(Int(round(months)))mo"
    }

    static func icon(for name: String) -> String {
        let lower = name.lowercased()
        if lower.contains("bell") { return "phone.connection" }
        if lower.contains("telus") { return "antenna.radiowaves.left.and.right" }
        if lower.contains("rogers") { return "wifi" }
        if lower.contains("visa") || lower.contains("mastercard") { return "creditcard" }
        if lower.contains("loan") { return "building.columns" }
        if lower.contains("mom") || lower.contains("family") { return "heart" }
        return "dollarsign.circle"
    }
}

// MARK: - Upcoming Payments

enum UpcomingPayments {
    struct Payment: Sendable {
        let name: String
        let amount: Double
        let recurring: String
        let icon: String
        let dateResolver: @Sendable () -> Date?
    }

    // CRA GST/HST credit: paid ~5th of Jan, Apr, Jul, Oct
    private static func nextCRAQuarterlyDate() -> Date? {
        let cal = Calendar.current
        let now = Date()
        let quarterMonths = [1, 4, 7, 10]
        let year = cal.component(.year, from: now)
        for offset in 0...1 {
            for m in quarterMonths {
                var comps = DateComponents()
                comps.year = year + offset
                comps.month = m
                comps.day = 5
                if let d = cal.date(from: comps), d >= cal.startOfDay(for: now) {
                    return d
                }
            }
        }
        return nil
    }

    static let all: [Payment] = [
        Payment(name: "GST/HST Credit", amount: 87.25, recurring: "quarterly", icon: "dollarsign.circle", dateResolver: nextCRAQuarterlyDate),
    ]

    static func daysUntil(_ payment: Payment) -> Int? {
        guard let payDate = payment.dateResolver() else { return nil }
        return Calendar.current.dateComponents([.day], from: Date(), to: payDate).day
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
    private static let service = "com.heyitsmejosh.monica"
    static let savedEmailKey = "monica_saved_email"

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
