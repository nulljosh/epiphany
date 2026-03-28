import Foundation

struct SavingsForecast {
    struct Point: Identifiable {
        let month: String
        let sortKey: String
        let median: Double
        let low: Double
        let high: Double

        var id: String { sortKey }
    }

    let points: [Point]
    let avgMonthlySavings: Double
}

enum SavingsForecastBuilder {
    struct SavingsMonth {
        let sortKey: String
        let month: String
        let savings: Double
    }

    static func build(from statements: [Statement], horizon: Int = 6) -> SavingsForecast? {
        let allTransactions = statements.flatMap(\.transactions)
        guard !allTransactions.isEmpty else { return nil }

        var monthlyData: [String: (income: Double, expenses: Double)] = [:]
        for tx in allTransactions {
            let key = String(tx.date.prefix(7))
            guard key.count == 7 else { continue }
            var entry = monthlyData[key] ?? (income: 0, expenses: 0)
            if tx.amount > 0 {
                entry.income += tx.amount
            } else {
                entry.expenses += abs(tx.amount)
            }
            monthlyData[key] = entry
        }

        let months = monthlyData.keys.sorted().map { key -> SavingsMonth in
            let data = monthlyData[key]!
            let savings = data.income - data.expenses
            let label = formatMonthLabel(key)
            return SavingsMonth(sortKey: key, month: label, savings: savings)
        }

        guard months.count >= 3 else { return nil }

        let savingsValues: [Double] = months.map { $0.savings }
        let avgSavings = savingsValues.reduce(0, +) / Double(savingsValues.count)

        var diffs: [Double] = []
        for i in 1..<savingsValues.count {
            if abs(savingsValues[i - 1]) > 1 {
                diffs.append(savingsValues[i] - savingsValues[i - 1])
            }
        }

        let drift = diffs.isEmpty ? 0 : diffs.reduce(0, +) / Double(diffs.count)
        let variance = diffs.isEmpty ? 0 : diffs.reduce(0) { $0 + pow($1 - drift, 2) } / Double(max(1, diffs.count - 1))
        let volatility = min(max(sqrt(max(variance, 0)), 10), abs(avgSavings) * 0.5 + 50)
        let startValue = savingsValues.last ?? avgSavings

        let hwForecasts = holtWinters(values: savingsValues, horizon: horizon)

        var random = SeededGenerator(seed: hashValues(savingsValues))
        var paths = Array(repeating: [Double](), count: horizon)

        for _ in 0..<1000 {
            var value = startValue
            for step in 0..<horizon {
                let shock = gaussian(using: &random) * volatility
                let projected = value + drift + shock
                let meanReverted = (projected * 0.7) + (avgSavings * 0.3)
                value = meanReverted
                paths[step].append(value)
            }
        }

        guard let lastSortKey = months.last?.sortKey else { return nil }
        let points = paths.enumerated().map { index, values in
            let sorted = values.sorted()
            let mcMedian = percentile(sorted, p: 0.5)
            let hwValue = index < hwForecasts.count ? hwForecasts[index] : mcMedian
            let blended = (mcMedian * 0.6 + hwValue * 0.4)

            let monthInfo = nextMonth(after: lastSortKey, offset: index + 1)
            return SavingsForecast.Point(
                month: monthInfo.month,
                sortKey: monthInfo.sortKey,
                median: (blended * 100).rounded() / 100,
                low: (percentile(sorted, p: 0.2) * 100).rounded() / 100,
                high: (percentile(sorted, p: 0.8) * 100).rounded() / 100
            )
        }

        return SavingsForecast(points: points, avgMonthlySavings: (avgSavings * 100).rounded() / 100)
    }

    private static func formatMonthLabel(_ sortKey: String) -> String {
        let fmt = DateFormatter()
        fmt.locale = Locale(identifier: "en_US_POSIX")
        fmt.dateFormat = "yyyy-MM"
        let lbl = DateFormatter()
        lbl.locale = Locale(identifier: "en_US_POSIX")
        lbl.dateFormat = "MMM yyyy"
        guard let date = fmt.date(from: sortKey) else { return sortKey }
        return lbl.string(from: date)
    }

    private static func holtWinters(values: [Double], horizon: Int, alpha: Double = 0.4, beta: Double = 0.2) -> [Double] {
        guard values.count >= 2 else { return Array(repeating: values.last ?? 0, count: horizon) }
        var level = values[0]
        var trend = values[1] - values[0]
        for i in 1..<values.count {
            let prevLevel = level
            level = alpha * values[i] + (1 - alpha) * (prevLevel + trend)
            trend = beta * (level - prevLevel) + (1 - beta) * trend
        }
        return (1...horizon).map { step in level + trend * Double(step) }
    }

    private static func hashValues(_ values: [Double]) -> UInt64 {
        let text = values.map { String(format: "%.2f", $0) }.joined(separator: "|")
        return text.utf8.reduce(2166136261) { ($0 ^ UInt64($1)) &* 16777619 }
    }

    private static func gaussian(using generator: inout SeededGenerator) -> Double {
        var u = 0.0, v = 0.0
        while u == 0 { u = generator.nextUnit() }
        while v == 0 { v = generator.nextUnit() }
        return sqrt(-2 * log(u)) * cos(2 * .pi * v)
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
        let fmt = DateFormatter()
        fmt.locale = Locale(identifier: "en_US_POSIX")
        fmt.dateFormat = "yyyy-MM"
        let lbl = DateFormatter()
        lbl.locale = Locale(identifier: "en_US_POSIX")
        lbl.dateFormat = "MMM yyyy"
        guard let base = fmt.date(from: sortKey),
              let next = Calendar(identifier: .gregorian).date(byAdding: .month, value: offset, to: base) else {
            return ("+\(offset)", "\(sortKey)-\(offset)")
        }
        return (lbl.string(from: next), fmt.string(from: next))
    }
}

private struct SeededGenerator {
    private var state: UInt64
    init(seed: UInt64) { state = seed == 0 ? 1 : seed }
    mutating func next() -> UInt64 {
        state = 2862933555777941757 &* state &+ 3037000493
        return state
    }
    mutating func nextUnit() -> Double {
        Double(next() % 10_000_000) / 10_000_000
    }
}
