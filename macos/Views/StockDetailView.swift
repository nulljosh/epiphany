import SwiftUI
import Charts

struct StockDetailView: View {
    @Environment(AppState.self) private var appState
    let stock: Stock

    enum ChartType: String, CaseIterable {
        case heikinAshi = "Heikin Ashi"
        case candles = "Candles"
        case hollowCandles = "Hollow"
        case bars = "Bars"
        case line = "Line"
        case stepLine = "Step"
        case area = "Area"
        case baseline = "Baseline"
        case columns = "Columns"
    }

    @State private var selectedRange = "1y"
    @State private var chartType: ChartType = .heikinAshi
    @State private var isLoading = true
    @State private var error: String?
    @State private var priceHistory: [PriceHistory.DataPoint] = []
    @State private var relatedNews: [NewsArticle] = []
    @State private var newsError = false
    @State private var scrubPrice: (date: Date, price: Double)?

    private let ranges = ["1d", "5d", "1mo", "3mo", "1y"]

    private var isWatchlisted: Bool {
        appState.isInWatchlist(stock.symbol)
    }

    private var changeColor: Color {
        stock.change >= 0 ? Palette.successGreen : Palette.dangerRed
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                VStack(spacing: 4) {
                    if stock.name != stock.symbol {
                        Text(stock.name)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    let displayPrice = scrubPrice?.price ?? stock.price
                    Text(String(format: "$%.2f", displayPrice))
                        .font(.system(size: 44, weight: .bold, design: .rounded))
                        .contentTransition(.numericText())
                    if let scrub = scrubPrice {
                        Text(scrub.date.formatted(.dateTime.month(.abbreviated).day().year()))
                            .font(.callout.weight(.medium))
                            .foregroundStyle(.secondary)
                    } else {
                        HStack(spacing: 6) {
                            Text(String(format: "%@%.2f", stock.change >= 0 ? "+" : "", stock.change))
                            Text(String(format: "(%.2f%%)", stock.changePercent))
                        }
                        .font(.callout.weight(.medium))
                        .foregroundStyle(changeColor)
                    }
                }
                .padding(.top, 8)

                if isLoading {
                    ProgressView()
                        .frame(height: 220)
                } else if let error {
                    Text(error)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .frame(height: 220)
                } else if priceHistory.count >= 2 {
                    chartView
                } else {
                    VStack(spacing: 8) {
                        Text(priceHistory.isEmpty ? "No chart data available" : "Not enough data for intraday chart")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        if priceHistory.count == 1 {
                            Text(String(format: "$%.2f", priceHistory[0].close))
                                .font(.title2.weight(.semibold))
                        }
                    }
                    .frame(height: 220)
                }

                Picker("Range", selection: $selectedRange) {
                    ForEach(ranges, id: \.self) { range in
                        Text(range.uppercased()).tag(range)
                    }
                }
                .pickerStyle(.segmented)
                .padding(.horizontal)

                ScrollView(.horizontal, showsIndicators: true) {
                    HStack(spacing: 6) {
                        ForEach(ChartType.allCases, id: \.self) { type in
                            Button {
                                chartType = type
                            } label: {
                                Text(type.rawValue)
                                    .font(.caption2.weight(.semibold))
                                    .padding(.horizontal, 10)
                                    .padding(.vertical, 5)
                                    .background(
                                        chartType == type
                                            ? Palette.appleBlue.opacity(0.2)
                                            : Color.clear,
                                        in: Capsule()
                                    )
                                    .overlay(
                                        Capsule().stroke(
                                            chartType == type ? Palette.appleBlue : .secondary.opacity(0.3),
                                            lineWidth: 1
                                        )
                                    )
                                    .foregroundStyle(chartType == type ? Palette.appleBlue : .secondary)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.horizontal)
                }

                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                    if stock.open > 0 {
                        statCell("Open", value: String(format: "$%.2f", stock.open))
                    }
                    if stock.prevClose > 0 {
                        statCell("Prev Close", value: String(format: "$%.2f", stock.prevClose))
                    }
                    if let range = stock.dayRange {
                        statCell("Day Range", value: range)
                    }
                    if let range = stock.yearRange {
                        statCell("52W Range", value: range)
                    }
                    if stock.volume > 0 {
                        statCell("Volume", value: stock.formattedVolume)
                    }
                    if let cap = stock.formattedMarketCap {
                        statCell("Market Cap", value: "$\(cap)")
                    }
                    if let pe = stock.formattedPERatio {
                        statCell("P/E Ratio", value: pe)
                    }
                    if let e = stock.formattedEPS {
                        statCell("EPS", value: e)
                    }
                }
                .padding()
                .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 12))
                .padding(.horizontal)

                VStack(alignment: .leading, spacing: 12) {
                    Text("Related News")
                        .font(.headline)
                        .padding(.horizontal)

                    if newsError {
                        Text("News unavailable")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .padding(.horizontal)
                    } else if relatedNews.isEmpty {
                        Text("No related news")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .padding(.horizontal)
                    } else {
                        ForEach(relatedNews.prefix(5)) { article in
                            if let url = URL(string: article.url) {
                                Link(destination: url) {
                                    compactNewsRow(article)
                                }
                            } else {
                                compactNewsRow(article)
                            }
                        }
                    }
                }
                .padding(.top, 8)

                Spacer()
            }
        }
        .navigationTitle(stock.name == stock.symbol ? stock.symbol : stock.name)
        .toolbar {
            if appState.isLoggedIn {
                ToolbarItem(placement: .automatic) {
                    Button {
                        Task {
                            if isWatchlisted {
                                await appState.removeWatchlistSymbol(stock.symbol)
                            } else {
                                await appState.addWatchlistSymbol(stock.symbol)
                            }
                        }
                    } label: {
                        Image(systemName: isWatchlisted ? "star.fill" : "star")
                            .foregroundStyle(isWatchlisted ? Palette.warningAmberAlt : .secondary)
                    }
                }
            }
        }
        .task(id: selectedRange) {
            await loadHistory()
        }
        .task {
            await loadRelatedNews()
        }
    }

    private struct OHLCPoint: Identifiable {
        let id: Int
        let date: Date
        let open: Double
        let high: Double
        let low: Double
        let close: Double
        var isUp: Bool { close >= open }
    }

    private var ohlcPoints: [OHLCPoint] {
        priceHistory.enumerated().compactMap { i, point -> OHLCPoint? in
            guard let date = point.parsedDate,
                  let o = point.open, let h = point.high, let l = point.low else { return nil }
            return OHLCPoint(id: i, date: date, open: o, high: h, low: l, close: point.close)
        }
    }

    private var heikinAshiPoints: [OHLCPoint] {
        let raw = ohlcPoints
        guard !raw.isEmpty else { return [] }
        var ha: [OHLCPoint] = []
        for (i, d) in raw.enumerated() {
            let haClose = (d.open + d.high + d.low + d.close) / 4
            let haOpen = i == 0 ? (d.open + d.close) / 2 : (ha[i - 1].open + ha[i - 1].close) / 2
            let haHigh = max(d.high, haOpen, haClose)
            let haLow = min(d.low, haOpen, haClose)
            ha.append(OHLCPoint(id: i, date: d.date, open: haOpen, high: haHigh, low: haLow, close: haClose))
        }
        return ha
    }

    @ViewBuilder
    private var chartView: some View {
        let points = priceHistory.compactMap { point -> (Date, Double)? in
            guard let date = point.parsedDate else { return nil }
            return (date, point.close)
        }
        let candleData: [OHLCPoint] = {
            switch chartType {
            case .heikinAshi: return heikinAshiPoints
            case .candles, .hollowCandles, .bars: return ohlcPoints
            default: return []
            }
        }()
        let usesOHLC = [.heikinAshi, .candles, .hollowCandles, .bars].contains(chartType)
        let allPrices: [Double] = usesOHLC
            ? candleData.flatMap { [$0.high, $0.low] }
            : points.map(\.1)
        let minPrice = allPrices.min() ?? 0
        let maxPrice = allPrices.max() ?? 0
        let padding = (maxPrice - minPrice) * 0.1

        Chart {
            switch chartType {
            case .heikinAshi, .candles:
                ForEach(candleData) { c in
                    RuleMark(
                        x: .value("Date", c.date),
                        yStart: .value("Low", c.low),
                        yEnd: .value("High", c.high)
                    )
                    .foregroundStyle(c.isUp ? Palette.successGreen : Palette.dangerRed)
                    .lineStyle(StrokeStyle(lineWidth: 1))
                    RectangleMark(
                        x: .value("Date", c.date),
                        yStart: .value("Open", c.open),
                        yEnd: .value("Close", c.close),
                        width: 4
                    )
                    .foregroundStyle(c.isUp ? Palette.successGreen : Palette.dangerRed)
                }
            case .hollowCandles:
                ForEach(candleData) { c in
                    RuleMark(
                        x: .value("Date", c.date),
                        yStart: .value("Low", c.low),
                        yEnd: .value("High", c.high)
                    )
                    .foregroundStyle(c.isUp ? Palette.successGreen : Palette.dangerRed)
                    .lineStyle(StrokeStyle(lineWidth: 1))
                    RectangleMark(
                        x: .value("Date", c.date),
                        yStart: .value("Open", c.open),
                        yEnd: .value("Close", c.close),
                        width: 4
                    )
                    .foregroundStyle(c.isUp ? Palette.successGreen.opacity(0.15) : Palette.dangerRed)
                }
            case .bars:
                ForEach(candleData) { c in
                    RuleMark(
                        x: .value("Date", c.date),
                        yStart: .value("Low", c.low),
                        yEnd: .value("High", c.high)
                    )
                    .foregroundStyle(c.isUp ? Palette.successGreen : Palette.dangerRed)
                    .lineStyle(StrokeStyle(lineWidth: 1.5))
                }
            case .line:
                ForEach(points, id: \.0) { date, close in
                    LineMark(x: .value("Date", date), y: .value("Price", close))
                        .foregroundStyle(Palette.successGreen)
                }
            case .stepLine:
                ForEach(points, id: \.0) { date, close in
                    LineMark(x: .value("Date", date), y: .value("Price", close))
                        .foregroundStyle(Palette.successGreen)
                        .interpolationMethod(.stepCenter)
                }
            case .area:
                ForEach(points, id: \.0) { date, close in
                    AreaMark(x: .value("Date", date), y: .value("Price", close))
                        .foregroundStyle(
                            .linearGradient(
                                colors: [Palette.successGreen.opacity(0.3), .clear],
                                startPoint: .top, endPoint: .bottom
                            )
                        )
                    LineMark(x: .value("Date", date), y: .value("Price", close))
                        .foregroundStyle(Palette.successGreen)
                }
            case .baseline:
                let basePrice = points.first?.1 ?? 0
                ForEach(points, id: \.0) { date, close in
                    AreaMark(x: .value("Date", date), y: .value("Price", close))
                        .foregroundStyle(
                            .linearGradient(
                                colors: [
                                    close >= basePrice ? Palette.successGreen.opacity(0.3) : Palette.dangerRed.opacity(0.3),
                                    .clear
                                ],
                                startPoint: close >= basePrice ? .top : .bottom,
                                endPoint: close >= basePrice ? .bottom : .top
                            )
                        )
                    LineMark(x: .value("Date", date), y: .value("Price", close))
                        .foregroundStyle(close >= basePrice ? Palette.successGreen : Palette.dangerRed)
                }
                RuleMark(y: .value("Baseline", basePrice))
                    .foregroundStyle(.secondary.opacity(0.4))
                    .lineStyle(StrokeStyle(lineWidth: 1, dash: [4, 3]))
            case .columns:
                ForEach(Array(points.enumerated()), id: \.offset) { i, item in
                    let prev = i > 0 ? points[i - 1].1 : item.1
                    BarMark(x: .value("Date", item.0), y: .value("Price", item.1))
                        .foregroundStyle(item.1 >= prev ? Palette.successGreen : Palette.dangerRed)
                }
            }

            if let scrubPrice {
                RuleMark(x: .value("Date", scrubPrice.date))
                    .foregroundStyle(.secondary.opacity(0.5))
                    .lineStyle(StrokeStyle(lineWidth: 1, dash: [4, 3]))
                PointMark(x: .value("Date", scrubPrice.date), y: .value("Price", scrubPrice.price))
                    .foregroundStyle(Palette.appleBlue)
                    .symbolSize(50)
            }
        }
        .chartLegend(.hidden)
        .chartYScale(domain: (minPrice - padding)...(maxPrice + padding))
        .modifier(IntradayXScaleModifier(selectedRange: selectedRange, firstDate: points.first?.0))
        .chartXAxis {
            AxisMarks(values: .automatic(desiredCount: 5)) {
                AxisValueLabel(format: xAxisFormat)
                    .foregroundStyle(.secondary)
            }
        }
        .chartYAxis {
            AxisMarks(position: .trailing, values: .automatic(desiredCount: 4)) {
                AxisValueLabel()
                    .foregroundStyle(.secondary)
            }
        }
        .chartOverlay { proxy in
            GeometryReader { geo in
                Rectangle().fill(.clear).contentShape(Rectangle())
                    .gesture(
                        DragGesture(minimumDistance: 0)
                            .onChanged { value in
                                let x = value.location.x - geo[proxy.plotFrame!].origin.x
                                guard let date: Date = proxy.value(atX: x) else { return }
                                if let closest = points.min(by: { abs($0.0.timeIntervalSince(date)) < abs($1.0.timeIntervalSince(date)) }) {
                                    scrubPrice = (date: closest.0, price: closest.1)
                                }
                            }
                            .onEnded { _ in
                                scrubPrice = nil
                            }
                    )
            }
        }
        .frame(height: 220)
        .clipped()
        .padding(.horizontal)
    }

    private var xAxisFormat: Date.FormatStyle {
        switch selectedRange {
        case "1d":
            return .dateTime.hour().minute()
        case "5d":
            return .dateTime.weekday(.abbreviated).hour()
        case "1mo":
            return .dateTime.month(.abbreviated).day()
        default:
            return .dateTime.month(.abbreviated)
        }
    }

    private func loadHistory() async {
        isLoading = true
        error = nil
        do {
            let result = try await EpiphanyAPI.shared.fetchPriceHistory(symbol: stock.symbol, range: selectedRange)
            guard !Task.isCancelled else { return }
            priceHistory = result.history
        } catch is CancellationError {
            return
        } catch {
            guard !Task.isCancelled else { return }
            self.error = error.localizedDescription
        }
        isLoading = false
    }

    private func statCell(_ label: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label)
                .font(.caption2)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.caption.weight(.medium))
                .lineLimit(1)
                .minimumScaleFactor(0.8)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func compactNewsRow(_ article: NewsArticle) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(article.title)
                .font(.subheadline.weight(.medium))
                .lineLimit(2)
                .foregroundStyle(.primary)
            HStack(spacing: 6) {
                Text(article.source)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                if !article.publishedAt.isEmpty {
                    Text(article.publishedAt)
                        .font(.caption)
                        .foregroundStyle(.secondary.opacity(0.7))
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal)
        .padding(.vertical, 4)
    }

    private func loadRelatedNews() async {
        do {
            async let symbolNews = EpiphanyAPI.shared.fetchStockNews(query: stock.symbol)
            async let nameNews = EpiphanyAPI.shared.fetchStockNews(query: stock.name)
            let (bySymbol, byName) = try await (symbolNews, nameNews)
            relatedNews = bySymbol.isEmpty ? byName : bySymbol
        } catch {
            do {
                let allNews = try await EpiphanyAPI.shared.fetchNews()
                let terms = [stock.symbol.lowercased(), stock.name.lowercased()]
                relatedNews = allNews.filter { article in
                    terms.contains { article.title.lowercased().contains($0) }
                }
            } catch {
                newsError = true
            }
        }
    }
}

private struct IntradayXScaleModifier: ViewModifier {
    let selectedRange: String
    let firstDate: Date?

    private static let easternCalendar: Calendar = {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "America/New_York")!
        return cal
    }()

    func body(content: Content) -> some View {
        if selectedRange == "1d", let first = firstDate {
            let cal = Self.easternCalendar
            let marketOpen = cal.date(bySettingHour: 9, minute: 30, second: 0, of: first) ?? first
            let marketClose = cal.date(bySettingHour: 16, minute: 0, second: 0, of: first) ?? first
            content.chartXScale(domain: marketOpen...marketClose)
        } else {
            content
        }
    }
}
