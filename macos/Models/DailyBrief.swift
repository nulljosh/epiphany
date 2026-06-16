import Foundation

struct DailyBrief: Codable {
    let points: [String]
    let gainers: [Mover]
    let losers: [Mover]
    let generatedAt: String

    struct Mover: Codable, Identifiable {
        let symbol: String
        let name: String
        let price: Double
        let change: Double

        var id: String { symbol }
    }
}
