import Foundation

// Mirrors /api/broker/autopilot payloads. Extra server keys (email, updatedAt)
// are ignored on decode; POST sends only the user-editable fields.
struct AutopilotSettings: Codable {
    var enabled: Bool
    var mode: String // "paper" | "live"
    var maxNotional: Double
    var allocation: Int
    var allowCrypto: Bool
    var allowOvernight: Bool
}

struct AutopilotTrade: Codable, Identifiable {
    let ts: String
    let symbol: String
    let side: String
    let qty: Double?
    let price: Double?
    let mode: String
    let error: String?

    var id: String { ts + symbol + side }
}

struct AutopilotState: Codable {
    let ok: Bool
    let pro: Bool
    var settings: AutopilotSettings
    let trades: [AutopilotTrade]
}
