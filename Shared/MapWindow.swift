import Foundation

/// How far back the map shows timed events (incidents, crime, quakes). 0 means any time.
enum MapWindow {
    static let choices: [(hours: Int, label: String)] = [(1, "Last hour"), (6, "Last 6 hours"), (24, "Last 24 hours"), (0, "Any time")]

    static func shortLabel(_ hours: Int) -> String { hours == 0 ? "Filter" : "\(hours)h" }

    /// Items with no time, or one we can't read, stay: hiding them would empty layers that never send one.
    static func allows(_ stamp: String?, hours: Int, now: Date = .now) -> Bool {
        guard hours > 0, let stamp, let date = parse(stamp) else { return true }
        return now.timeIntervalSince(date) <= Double(hours) * 3600
    }

    // ISO8601DateFormatter is thread-safe for parsing once configured.
    nonisolated(unsafe) private static let fractional: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()
    nonisolated(unsafe) private static let plain = ISO8601DateFormatter()

    static func parse(_ text: String) -> Date? {
        if let ms = Double(text), ms > 1e11 { return Date(timeIntervalSince1970: ms / 1000) }
        return fractional.date(from: text) ?? plain.date(from: text)
    }
}
