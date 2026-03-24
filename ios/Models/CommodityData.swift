import Foundation

struct CommodityData: Codable, Identifiable {
    let name: String
    let price: Double
    let change: Double
    let changePercent: Double

    var id: String { name }
}
