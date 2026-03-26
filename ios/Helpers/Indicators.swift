import Foundation

enum Indicators {
    struct DataPoint {
        let date: Date
        let value: Double
    }

    static func sma(prices: [(Date, Double)], period: Int) -> [DataPoint] {
        guard prices.count >= period, period > 0 else { return [] }
        var result: [DataPoint] = []
        result.reserveCapacity(prices.count - period + 1)
        var sum = prices[0..<period].map(\.1).reduce(0, +)
        result.append(DataPoint(date: prices[period - 1].0, value: sum / Double(period)))
        for i in period..<prices.count {
            sum += prices[i].1 - prices[i - period].1
            result.append(DataPoint(date: prices[i].0, value: sum / Double(period)))
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
