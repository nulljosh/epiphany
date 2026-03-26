import Foundation

enum Indicators {
    struct DataPoint {
        let date: Date
        let value: Double
    }

    static func sma(prices: [(Date, Double)], period: Int) -> [DataPoint] {
        guard prices.count >= period else { return [] }
        var result: [DataPoint] = []
        for i in (period - 1)..<prices.count {
            let slice = prices[(i - period + 1)...i]
            let avg = slice.map(\.1).reduce(0, +) / Double(period)
            result.append(DataPoint(date: prices[i].0, value: avg))
        }
        return result
    }

    static func ema(prices: [(Date, Double)], period: Int) -> [DataPoint] {
        guard prices.count >= period else { return [] }
        let k = 2.0 / Double(period + 1)
        // Seed with SMA of first `period` values
        let seed = prices[0..<period].map(\.1).reduce(0, +) / Double(period)
        var result: [DataPoint] = [DataPoint(date: prices[period - 1].0, value: seed)]
        for i in period..<prices.count {
            let prev = result.last!.value
            let ema = prices[i].1 * k + prev * (1 - k)
            result.append(DataPoint(date: prices[i].0, value: ema))
        }
        return result
    }
}
