import Foundation

struct CryptoData: Codable, Identifiable {
    let symbol: String
    let spot: Double
    let chgPct: Double

    var id: String { symbol }
}
