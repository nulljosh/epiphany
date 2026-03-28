import Foundation

struct SpendingForecast {
    struct Point: Identifiable {
        let month: String
        let sortKey: String
        let median: Double
        let low: Double
        let high: Double

        var id: String { sortKey }
    }

    struct Summary {
        let expectedNextMonth: Double
        let rangeLow: Double
        let rangeHigh: Double
    }

    let horizon: Int
    let points: [Point]
    let summary: Summary
}

enum SpendingForecastBuilder {
    static func build(from months: [FinanceData.SpendingMonth], simulations: Int = 2000) -> SpendingForecast? {
        let series = months
            .filter { $0.total > 0 }
            .sorted { $0.sortKey < $1.sortKey }

        guard series.count >= 3 else { return nil }

        let rawReturns = zip(series.dropFirst(), series).compactMap { current, previous -> Double? in
            guard previous.total > 0, current.total > 0 else { return nil }
            return log(current.total / previous.total)
        }

        guard !rawReturns.isEmpty else { return nil }

        let returns = winsorize(rawReturns, lower: 0.15, upper: 0.85)
        let trailingWindow = Array(series.suffix(min(3, series.count)))
        let baseline = trailingWindow.map(\.total).reduce(0, +) / Double(trailingWindow.count)

        let drift = returns.reduce(0, +) / Double(returns.count)
        let varianceDivisor = max(1, returns.count - 1)
        let variance = returns.reduce(0) { partial, value in
            partial + pow(value - drift, 2)
        } / Double(varianceDivisor)
        let volatility = min(max(sqrt(max(variance, 0)), 0.03), 0.35)
        let horizon = series.count
        let startValue = series.last?.total ?? 0
        guard startValue > 0 else { return nil }

        var random = SeededGenerator(seed: hashSeries(series))
        var paths = Array(repeating: [Double](), count: horizon)

        for _ in 0..<simulations {
            var value = startValue
            for step in 0..<horizon {
                let sampledReturn = bootstrapReturn(from: returns, using: &random)
                let shock = gaussian(using: &random) * volatility * 0.35
                let projected = value * exp((sampledReturn * 0.75) + (drift * 0.25) + shock)
                let meanReverted = (projected * 0.72) + (baseline * 0.28)
                value = max(0, meanReverted.roundedToCents())
                paths[step].append(value)
            }
        }

        guard let lastSortKey = series.last?.sortKey else { return nil }
        let points = paths.enumerated().map { index, values in
            let sorted = values.sorted()
            let monthLabel = nextMonth(after: lastSortKey, offset: index + 1)
            return SpendingForecast.Point(
                month: monthLabel.month,
                sortKey: monthLabel.sortKey,
                median: percentile(sorted, p: 0.5).roundedToCents(),
                low: percentile(sorted, p: 0.2).roundedToCents(),
                high: percentile(sorted, p: 0.8).roundedToCents()
            )
        }

        return SpendingForecast(
            horizon: horizon,
            points: points,
            summary: .init(
                expectedNextMonth: points.first?.median ?? 0,
                rangeLow: points.first?.low ?? 0,
                rangeHigh: points.first?.high ?? 0
            )
        )
    }

    private static func hashSeries(_ months: [FinanceData.SpendingMonth]) -> UInt64 {
        let text = months.map { "\($0.sortKey):\($0.total)" }.joined(separator: "|")
        return text.utf8.reduce(2166136261) { partial, byte in
            (partial ^ UInt64(byte)) &* 16777619
        }
    }

    private static func gaussian(using generator: inout SeededGenerator) -> Double {
        var u = 0.0
        var v = 0.0
        while u == 0 { u = generator.nextUnit() }
        while v == 0 { v = generator.nextUnit() }
        return sqrt(-2 * log(u)) * cos(2 * .pi * v)
    }

    private static func bootstrapReturn(
        from returns: [Double],
        using generator: inout SeededGenerator
    ) -> Double {
        guard !returns.isEmpty else { return 0 }
        let index = Int(Double(returns.count) * generator.nextUnit())
        return returns[min(index, returns.count - 1)]
    }

    private static func winsorize(_ values: [Double], lower: Double, upper: Double) -> [Double] {
        guard values.count > 2 else { return values }
        let sorted = values.sorted()
        let low = percentile(sorted, p: lower)
        let high = percentile(sorted, p: upper)
        return values.map { min(max($0, low), high) }
    }

    private static func percentile(_ sorted: [Double], p: Double) -> Double {
        guard !sorted.isEmpty else { return 0 }
        let index = Double(sorted.count - 1) * p
        let lower = Int(floor(index))
        let upper = Int(ceil(index))
        if lower == upper { return sorted[lower] }
        let weight = index - Double(lower)
        return sorted[lower] * (1 - weight) + sorted[upper] * weight
    }

    private static func nextMonth(after sortKey: String, offset: Int) -> (month: String, sortKey: String) {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM"

        let labelFormatter = DateFormatter()
        labelFormatter.locale = Locale(identifier: "en_US_POSIX")
        labelFormatter.dateFormat = "MMM yyyy"

        guard let base = formatter.date(from: sortKey),
              let next = Calendar(identifier: .gregorian).date(byAdding: .month, value: offset, to: base) else {
            return ("+\(offset)", "\(sortKey)-\(offset)")
        }

        return (labelFormatter.string(from: next), formatter.string(from: next))
    }
}

private struct SeededGenerator {
    private var state: UInt64

    init(seed: UInt64) {
        state = seed == 0 ? 1 : seed
    }

    mutating func next() -> UInt64 {
        state = 2862933555777941757 &* state &+ 3037000493
        return state
    }

    mutating func nextUnit() -> Double {
        Double(next() % 10_000_000) / 10_000_000
    }
}

private extension Double {
    func roundedToCents() -> Double {
        (self * 100).rounded() / 100
    }
}
