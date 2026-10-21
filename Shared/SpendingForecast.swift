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

        // Spending is mean-reverting, not trending: model log-spend as an AR(1) around
        // a recent level and bootstrap the residuals. The old version compounded
        // month-over-month drift and started from the last (often spiky) month,
        // so forecasts ran away and the band ballooned over a year-long horizon.
        let logs = series.map { log($0.total) }
        let recent = Array(logs.suffix(min(6, logs.count)))
        let mu = recent.reduce(0, +) / Double(recent.count)
        let dev = logs.map { $0 - mu }

        // phi: lag-1 persistence of deviations, kept in [0, 0.8] so shocks fade
        let num = zip(dev.dropFirst(), dev).reduce(0) { $0 + $1.0 * $1.1 }
        let den = dev.dropLast().reduce(0) { $0 + $1 * $1 }
        let phi = den > 0 ? min(max(num / den, 0), 0.8) : 0.0

        let rawResiduals = zip(dev.dropFirst(), dev).map { $0 - phi * $1 }
        let residuals = winsorize(rawResiduals, lower: 0.1, upper: 0.9)
        guard !residuals.isEmpty else { return nil }

        // ponytail: 6 months out is where a monthly series still carries signal;
        // past that the band is just noise. Extend if real longer-range data appears.
        let horizon = min(series.count, 6)
        let startDev = (dev.last ?? 0) // start from where spending actually is

        var random = SeededGenerator(seed: hashSeries(series))
        var paths = Array(repeating: [Double](), count: horizon)

        for _ in 0..<simulations {
            var d = startDev
            for step in 0..<horizon {
                d = phi * d + bootstrapReturn(from: residuals, using: &random)
                paths[step].append(max(0, exp(mu + d).roundedToCents()))
            }
        }

        guard let lastSortKey = series.last?.sortKey else { return nil }
        let points = paths.enumerated().map { index, values in
            let sorted = values.sorted()
            let low = percentile(sorted, p: 0.1).roundedToCents()
            let high = percentile(sorted, p: 0.9).roundedToCents()
            let median = percentile(sorted, p: 0.5).roundedToCents().clamped(to: low...high)

            let monthLabel = nextMonth(after: lastSortKey, offset: index + 1)
            return SpendingForecast.Point(
                month: monthLabel.month,
                sortKey: monthLabel.sortKey,
                median: median,
                low: low,
                high: high
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

    func clamped(to range: ClosedRange<Double>) -> Double {
        min(max(self, range.lowerBound), range.upperBound)
    }
}
