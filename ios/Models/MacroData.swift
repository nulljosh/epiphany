import Foundation

struct MacroIndicator: Codable, Identifiable {
    let id: String
    let name: String
    let value: Double
    let unit: String
    let change: Double
    let changePercent: Double
    let date: String
    let series: [MacroPoint]?

    private enum CodingKeys: String, CodingKey {
        case id, name, value, unit, change, changePercent, date, series
    }

    private enum DecodingKeys: String, CodingKey {
        case id, name, value, unit, change, changePercent, change_percent, date, series
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: DecodingKeys.self)
        name = try container.decode(String.self, forKey: .name)
        value = try container.decode(Double.self, forKey: .value)
        unit = try container.decodeIfPresent(String.self, forKey: .unit) ?? ""
        change = try container.decodeIfPresent(Double.self, forKey: .change) ?? 0
        changePercent =
            try container.decodeIfPresent(Double.self, forKey: .changePercent) ??
            container.decodeIfPresent(Double.self, forKey: .change_percent) ??
            0
        date = try container.decodeIfPresent(String.self, forKey: .date) ?? ""
        series = try container.decodeIfPresent([MacroPoint].self, forKey: .series)
        id = try container.decodeIfPresent(String.self, forKey: .id) ?? name
    }
}

struct MacroPoint: Codable, Identifiable {
    let date: String
    let value: Double

    var id: String { "\(date)-\(value)" }
}
