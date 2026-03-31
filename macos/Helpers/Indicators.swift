import Foundation

enum ChartType: String, CaseIterable {
    case line = "Line"
    case area = "Area"
    case candles = "Candles"
    case heikinAshi = "Heikin Ashi"
}

enum Indicators {
    struct DataPoint {
        let date: Date
        let value: Double
    }

    struct OHLCPoint: Identifiable {
        let date: Date
        let open: Double
        let high: Double
        let low: Double
        let close: Double
        var id: Date { date }

        var isBullish: Bool { close >= open }
    }

    static func heikinAshi(from points: [OHLCPoint]) -> [OHLCPoint] {
        guard !points.isEmpty else { return [] }
        var result: [OHLCPoint] = []
        result.reserveCapacity(points.count)
        for (i, p) in points.enumerated() {
            let haClose = (p.open + p.high + p.low + p.close) / 4.0
            let haOpen: Double
            if i == 0 {
                haOpen = (p.open + p.close) / 2.0
            } else {
                haOpen = (result[i - 1].open + result[i - 1].close) / 2.0
            }
            let haHigh = max(p.high, haOpen, haClose)
            let haLow = min(p.low, haOpen, haClose)
            result.append(OHLCPoint(date: p.date, open: haOpen, high: haHigh, low: haLow, close: haClose))
        }
        return result
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
