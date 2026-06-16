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

    // Buy/Hold/Sell signal from RSI + MACD + MA trend. Mirrors
    // src/utils/indicators.js so web and native agree.
    enum TradeSignal: String { case buy = "Buy", hold = "Hold", sell = "Sell" }

    private static func emaSeries(_ values: [Double], _ period: Int) -> [Double] {
        guard values.count >= period, period > 0 else { return [] }
        let k = 2.0 / Double(period + 1)
        var prev = values[0..<period].reduce(0, +) / Double(period)
        var out = [prev]
        for i in period..<values.count {
            prev = values[i] * k + prev * (1 - k)
            out.append(prev)
        }
        return out
    }

    private static func smaValue(_ values: [Double], _ period: Int) -> Double? {
        guard values.count >= period, period > 0 else { return nil }
        return values[(values.count - period)...].reduce(0, +) / Double(period)
    }

    static func rsi(_ values: [Double], period: Int = 14) -> Double? {
        guard values.count >= period + 1 else { return nil }
        var gain = 0.0, loss = 0.0
        for i in 1...period {
            let d = values[i] - values[i - 1]
            if d >= 0 { gain += d } else { loss -= d }
        }
        var avgGain = gain / Double(period), avgLoss = loss / Double(period)
        if values.count > period + 1 {
            for i in (period + 1)..<values.count {
                let d = values[i] - values[i - 1]
                avgGain = (avgGain * Double(period - 1) + max(d, 0)) / Double(period)
                avgLoss = (avgLoss * Double(period - 1) + max(-d, 0)) / Double(period)
            }
        }
        if avgLoss == 0 { return 100 }
        return 100 - 100 / (1 + avgGain / avgLoss)
    }

    static func macdHistogram(_ values: [Double], fast: Int = 12, slow: Int = 26, signalP: Int = 9) -> Double? {
        guard values.count >= slow + signalP else { return nil }
        let fastS = emaSeries(values, fast), slowS = emaSeries(values, slow)
        guard !fastS.isEmpty, !slowS.isEmpty else { return nil }
        let offset = fastS.count - slowS.count
        let macdLine = slowS.enumerated().map { fastS[$0.offset + offset] - $0.element }
        let signalLine = emaSeries(macdLine, signalP)
        guard let m = macdLine.last, let s = signalLine.last else { return nil }
        return m - s
    }

    static func signal(closes: [Double]) -> TradeSignal? {
        guard closes.count >= 35 else { return nil }
        var score = 0
        if let r = rsi(closes) {
            if r > 55 { score += 1 } else if r < 45 { score -= 1 }
        }
        if let h = macdHistogram(closes) {
            if h > 1e-6 { score += 1 } else if h < -1e-6 { score -= 1 }
        }
        let fast = smaValue(closes, 50)
        let slow = closes.count >= 200 ? smaValue(closes, 200) : smaValue(closes, min(100, closes.count - 1))
        if let f = fast, let s = slow {
            if f > s { score += 1 } else if f < s { score -= 1 }
        }
        return score >= 2 ? .buy : (score <= -2 ? .sell : .hold)
    }
}
