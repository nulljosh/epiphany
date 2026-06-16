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

    static func formatPrice(_ value: Double) -> String {
        String(format: "$%.2f", value)
    }
}

// MARK: - Timeline Chip

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
                .foregroundStyle(.primary)
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

// MARK: - Keychain

enum KeychainHelper {
    private static let service = "com.heyitsmejosh.monica"
    static let savedEmailKey = "monica_saved_email"

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
