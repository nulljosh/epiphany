import Charts
import SwiftUI

extension Indicators {
    /// Wilder's RSI at every point from `period` on. Same math as `rsi(_:period:)`.
    static func rsiSeries(prices: [(Date, Double)], period: Int = 14) -> [DataPoint] {
        guard prices.count > period else { return [] }
        var gain = 0.0, loss = 0.0
        for i in 1...period {
            let d = prices[i].1 - prices[i - 1].1
            if d >= 0 { gain += d } else { loss -= d }
        }
        var avgGain = gain / Double(period), avgLoss = loss / Double(period)
        let value = { avgLoss == 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss) }
        var out = [DataPoint(date: prices[period].0, value: value())]
        for i in (period + 1)..<max(prices.count, period + 1) {
            let d = prices[i].1 - prices[i - 1].1
            avgGain = (avgGain * Double(period - 1) + max(d, 0)) / Double(period)
            avgLoss = (avgLoss * Double(period - 1) + max(-d, 0)) / Double(period)
            out.append(DataPoint(date: prices[i].0, value: value()))
        }
        return out
    }

    /// MACD (12/26/9): the line, its signal and the histogram between them. Same math as `macdHistogram`.
    static func macdSeries(prices: [(Date, Double)]) -> (line: [DataPoint], signal: [DataPoint]) {
        let fast = ema(prices: prices, period: 12), slow = ema(prices: prices, period: 26)
        guard !slow.isEmpty else { return ([], []) }
        let offset = fast.count - slow.count
        let line = slow.enumerated().map { DataPoint(date: $0.element.date, value: fast[$0.offset + offset].value - $0.element.value) }
        return (line, ema(prices: line.map { ($0.date, $0.value) }, period: 9))
    }
}

/// RSI or MACD in a short pane under the price chart.
struct OscillatorPane: View {
    let prices: [(Date, Double)]
    @AppStorage("oscillator_pane") private var kind = "RSI"

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Picker("Oscillator", selection: $kind) {
                Text("RSI 14").tag("RSI")
                Text("MACD").tag("MACD")
                Text("Off").tag("Off")
            }
            .pickerStyle(.segmented)
            .labelsHidden()
            if kind == "RSI" { rsiChart } else if kind == "MACD" { macdChart }
        }
    }

    private var rsiChart: some View {
        let points = Indicators.rsiSeries(prices: prices)
        return Chart {
            RuleMark(y: .value("Overbought", 70)).foregroundStyle(Palette.dangerRed.opacity(0.4)).lineStyle(StrokeStyle(dash: [3, 3]))
            RuleMark(y: .value("Oversold", 30)).foregroundStyle(Palette.successGreen.opacity(0.4)).lineStyle(StrokeStyle(dash: [3, 3]))
            ForEach(points, id: \.date) { LineMark(x: .value("Date", $0.date), y: .value("RSI", $0.value)) }
                .foregroundStyle(Palette.warningAmber)
        }
        .chartYScale(domain: 0...100)
        .chartYAxis { AxisMarks(position: .trailing, values: [30, 70]) }
        .chartXAxis(.hidden)
        .frame(height: 80)
    }

    private var macdChart: some View {
        let (line, signal) = Indicators.macdSeries(prices: prices)
        let signalByDate = Dictionary(signal.map { ($0.date, $0.value) }, uniquingKeysWith: { a, _ in a })
        return Chart {
            ForEach(line, id: \.date) { p in
                if let s = signalByDate[p.date] {
                    BarMark(x: .value("Date", p.date), y: .value("Histogram", p.value - s))
                        .foregroundStyle((p.value - s >= 0 ? Palette.successGreen : Palette.dangerRed).opacity(0.5))
                }
            }
            ForEach(line, id: \.date) { LineMark(x: .value("Date", $0.date), y: .value("MACD", $0.value), series: .value("Line", "MACD")) }
                .foregroundStyle(Palette.appleBlue)
            ForEach(signal, id: \.date) { LineMark(x: .value("Date", $0.date), y: .value("Signal", $0.value), series: .value("Line", "Signal")) }
                .foregroundStyle(Palette.warningAmber)
        }
        .chartYAxis { AxisMarks(position: .trailing) }
        .chartXAxis(.hidden)
        .frame(height: 80)
    }
}
