import Foundation
import Observation

@MainActor
@Observable
final class TradingSimulator {
    struct Position: Identifiable, Equatable {
        let sym: String
        let entry: Double
        let size: Double
        var stop: Double
        var target: Double

        var id: String { sym }
    }

    enum SimSpeed: String, CaseIterable, Identifiable {
        case normal
        case fast
        case turbo

        var id: String { rawValue }

        var delayNanoseconds: UInt64 {
            switch self {
            case .normal:
                return 50_000_000
            case .fast:
                return 5_000_000
            case .turbo:
                return 0
            }
        }
    }

    static let winThreshold: Double = 10_000_000_000_000 // $10T

    var balance = 1.0
    var trades = 0
    var wins = 0
    var losses = 0
    var tick = 0
    var isRunning = false
    var balanceHistory: [Double] = [1.0]
    var currentPosition: Position?
    var speed: SimSpeed = .turbo
    var hasWon = false
    var winStreak = 0
    var lastTradeWasWin = false

    private let startingBalance = 1.0
    private let assetBasePrices: [String: Double] = [
        "AAPL": 247, "MSFT": 454, "GOOGL": 323, "AMZN": 220, "NVDA": 185,
        "META": 595, "TSLA": 421, "AVGO": 245, "BRK.B": 470, "LLY": 905,
        "JPM": 242, "WMT": 98, "V": 343, "XOM": 118, "UNH": 510,
        "ORCL": 182, "MA": 528, "COST": 963, "NFLX": 978, "HD": 402,
        "PG": 171, "ABBV": 183, "BAC": 44, "KO": 67, "AMD": 171,
        "CRM": 317, "ADBE": 561, "PEP": 172, "TMO": 588, "CSCO": 61,
        "MRK": 129, "LIN": 462, "ACN": 378, "DIS": 114, "MCD": 312,
        "ABT": 125, "TXN": 205, "QCOM": 199, "IBM": 226, "INTU": 682,
        "CAT": 358, "GE": 201, "VZ": 43, "CMCSA": 41, "NOW": 845,
        "AMAT": 214, "BKNG": 4_120, "PFE": 29, "UBER": 83, "SHOP": 94,
        "PLTR": 42, "SNOW": 181, "PANW": 366, "MU": 129, "ANET": 318,
        "ADP": 301, "SPOT": 612, "MELI": 1_885, "ETN": 331, "DASH": 156,
        "INTC": 31
    ]

    private var priceSeries: [String: [Double]] = [:]
    private var trends: [String: Double] = [:]
    private var cooldownUntilTick: [String: Int] = [:]
    private var lastTraded: String?
    private var simulationTask: Task<Void, Never>?
    private let sortedSymbols: [String]

    init() {
        sortedSymbols = assetBasePrices.keys.sorted()
        seedState()
    }

    var winRate: Double {
        guard trades > 0 else { return 0 }
        return Double(wins) / Double(trades)
    }

    var maxDrawdown: Double {
        guard balanceHistory.count > 1 else { return 0 }
        var peak = balanceHistory[0]
        var maxDD = 0.0
        for value in balanceHistory {
            peak = max(peak, value)
            let dd = (peak - value) / peak
            maxDD = max(maxDD, dd)
        }
        return maxDD
    }

    var sharpeRatio: Double {
        guard balanceHistory.count > 2 else { return 0 }
        let returns = zip(balanceHistory.dropFirst(), balanceHistory).map { ($0 - $1) / $1 }
        let mean = returns.reduce(0, +) / Double(returns.count)
        let variance = returns.reduce(0) { $0 + pow($1 - mean, 2) } / Double(returns.count - 1)
        let stdDev = sqrt(variance)
        guard stdDev > 0 else { return 0 }
        return mean / stdDev * sqrt(252) // annualized
    }

    /// Black-Scholes call option price
    static func blackScholes(spot: Double, strike: Double, rate: Double, volatility: Double, timeYears: Double) -> Double {
        guard spot > 0, strike > 0, volatility > 0, timeYears > 0 else { return 0 }
        let d1 = (log(spot / strike) + (rate + 0.5 * volatility * volatility) * timeYears) / (volatility * sqrt(timeYears))
        let d2 = d1 - volatility * sqrt(timeYears)
        return spot * normCDF(d1) - strike * exp(-rate * timeYears) * normCDF(d2)
    }

    private static func normCDF(_ x: Double) -> Double {
        0.5 * (1 + erf(x / sqrt(2)))
    }

    func start() {
        guard simulationTask == nil else {
            isRunning = true
            return
        }

        isRunning = true
        simulationTask = Task.detached(priority: .utility) { [weak self] in
            guard let self else { return }
            await self.runSim()
        }
    }

    func stop() {
        isRunning = false
        simulationTask?.cancel()
        simulationTask = nil
    }

    func reset() {
        stop()
        balance = startingBalance
        trades = 0
        wins = 0
        losses = 0
        tick = 0
        balanceHistory = [startingBalance]
        currentPosition = nil
        cooldownUntilTick = [:]
        lastTraded = nil
        hasWon = false
        winStreak = 0
        lastTradeWasWin = false
        seedState()
    }

    func step() {
        guard !hasWon else { return }

        for _ in 0..<3 {
            advanceTick()
        }

        evaluateExitIfNeeded()
        findEntryIfNeeded()

        if balance >= Self.winThreshold {
            hasWon = true
            stop()
        }
    }

    func runSim() async {
        while !Task.isCancelled {
            let (shouldRun, currentSpeed) = await MainActor.run { (isRunning, speed) }
            if !shouldRun { break }

            let batchSize: Int
            switch currentSpeed {
            case .normal: batchSize = 1
            case .fast: batchSize = 50
            case .turbo: batchSize = 500
            }

            await MainActor.run {
                for _ in 0..<batchSize {
                    step()
                }
            }

            switch currentSpeed {
            case .normal:
                try? await Task.sleep(nanoseconds: 50_000_000)
            case .fast:
                try? await Task.sleep(nanoseconds: 5_000_000)
            case .turbo:
                await Task.yield()
            }
        }

        await MainActor.run {
            isRunning = false
            simulationTask = nil
        }
    }

    func currentPrice(for symbol: String) -> Double? {
        priceSeries[symbol]?.last
    }

    func currentPnLPercent() -> Double? {
        guard
            let position = currentPosition,
            let price = currentPrice(for: position.sym)
        else {
            return nil
        }

        return (price - position.entry) / position.entry
    }

    private func seedState() {
        priceSeries = assetBasePrices.mapValues { Array(repeating: $0, count: 30) }
        trends = assetBasePrices.mapValues { _ in 0 }
    }

    private func advanceTick() {
        tick += 1

        for (symbol, basePrice) in assetBasePrices {
            let lastPrice = priceSeries[symbol]?.last ?? basePrice
            var trend = trends[symbol] ?? 0

            if Double.random(in: 0...1) < 0.05 {
                trend = (Double.random(in: 0...1) - 0.45) * 0.006
            }

            let drift = 0.0001
            let noise = (Double.random(in: 0...1) - 0.5) * 0.008
            let move = trend + drift + noise
            let nextPrice = clamp(
                lastPrice * (1 + move),
                lower: basePrice * 0.7,
                upper: basePrice * 1.5
            )

            trends[symbol] = trend
            var series = priceSeries[symbol] ?? []
            series.append(nextPrice)
            if series.count > 30 {
                series.removeFirst(series.count - 30)
            }
            priceSeries[symbol] = series
        }
    }

    private func evaluateExitIfNeeded() {
        guard var position = currentPosition, let current = currentPrice(for: position.sym) else {
            return
        }

        let pnlPct = (current - position.entry) / position.entry
        if pnlPct > 0.02 {
            position.stop = max(position.stop, current * 0.97)
        }

        if current <= position.stop || current >= position.target {
            close(position: position, at: current)
        } else {
            currentPosition = position
        }
    }

    private func close(position: Position, at price: Double) {
        let proceeds = position.size * price
        let pnl = proceeds - (position.size * position.entry)
        balance += pnl
        trades += 1
        if pnl >= 0 {
            wins += 1
            winStreak += 1
            lastTradeWasWin = true
        } else {
            losses += 1
            winStreak = 0
            lastTradeWasWin = false
        }
        balanceHistory.append(balance)
        if balanceHistory.count > 5000 {
            balanceHistory = Array(balanceHistory.suffix(4000))
        }
        cooldownUntilTick[position.sym] = tick + 50
        lastTraded = position.sym
        currentPosition = nil
    }

    private func findEntryIfNeeded() {
        guard currentPosition == nil else { return }

        let minimumStrength = momentumThreshold(for: balance)
        var bestCandidate: (symbol: String, strength: Double, price: Double)?

        for symbol in sortedSymbols {
            guard symbol != lastTraded else { continue }
            if let cooldown = cooldownUntilTick[symbol], cooldown > tick {
                continue
            }
            guard let series = priceSeries[symbol], series.count >= 20 else {
                continue
            }

            let current = series[series.count - 1]
            let last10 = series.suffix(10)
            let last20 = series.suffix(20)
            let avg10 = average(of: last10)
            let avg20 = average(of: last20)
            guard avg10 > 0, avg20 > 0 else { continue }

            let strength = (current - avg10) / avg10
            guard strength >= minimumStrength else { continue }

            let previous = series[series.count - 2]
            let prior10 = series.dropLast().suffix(10)
            let priorAvg = average(of: prior10)
            let priorStrength = priorAvg > 0 ? (previous - priorAvg) / priorAvg : -.infinity
            guard priorStrength > 0 else { continue }

            let volatility = stddev(of: last10) / avg10
            guard volatility < 0.025 else { continue }

            let risingBars = zip(last10.dropLast(), last10.dropFirst()).filter { $1 > $0 }.count
            guard risingBars >= 5 else { continue }
            guard current > avg20 else { continue }

            if let currentBest = bestCandidate {
                if strength > currentBest.strength {
                    bestCandidate = (symbol, strength, current)
                }
            } else {
                bestCandidate = (symbol, strength, current)
            }
        }

        guard let candidate = bestCandidate else { return }

        let sizeFraction = kellyFraction(for: balance)
        let shares = (balance * sizeFraction) / candidate.price
        guard shares > 0 else { return }

        currentPosition = Position(
            sym: candidate.symbol,
            entry: candidate.price,
            size: shares,
            stop: candidate.price * 0.983,
            target: candidate.price * 1.05
        )
    }

    private func momentumThreshold(for balance: Double) -> Double {
        switch balance {
        case ..<2:
            return 0.008
        case ..<10:
            return 0.009
        case ..<100:
            return 0.010
        default:
            return 0.012
        }
    }

    private func kellyFraction(for balance: Double) -> Double {
        switch balance {
        case ..<10:
            return 0.65
        case ..<100:
            return 0.50
        case ..<10_000:
            return 0.35
        case ..<1_000_000:
            return 0.25
        case ..<100_000_000:
            return 0.15
        default:
            return 0.10
        }
    }

    private func average<C: Collection>(of values: C) -> Double where C.Element == Double {
        guard !values.isEmpty else { return 0 }
        return values.reduce(0, +) / Double(values.count)
    }

    private func stddev<C: Collection>(of values: C) -> Double where C.Element == Double {
        guard values.count > 1 else { return 0 }
        let mean = average(of: values)
        let variance = values.reduce(0) { partialResult, value in
            let diff = value - mean
            return partialResult + (diff * diff)
        } / Double(values.count)
        return sqrt(variance)
    }

    private func clamp(_ value: Double, lower: Double, upper: Double) -> Double {
        min(max(value, lower), upper)
    }
}
