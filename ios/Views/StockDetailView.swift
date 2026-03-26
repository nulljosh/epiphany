import SwiftUI
import Charts

struct StockDetailView: View {
    @Environment(AppState.self) private var appState
    let stock: Stock

    @State private var selectedRange = "1y"
    @State private var isLoading = true
    @State private var error: String?
    @State private var priceHistory: [PriceHistory.DataPoint] = []
    @State private var relatedNews: [NewsArticle] = []
    @State private var newsError = false
    @State private var scrubPrice: (date: Date, price: Double)?
    @State private var selectedNewsURL: URL?

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
                                Button {
                                    selectedNewsURL = url
                                } label: {
                                    CompactNewsRow(article: article)
                                }
                            } else {
                                CompactNewsRow(article: article)
                            }
                        }
                    }
                }
                .padding(.top, 8)

                Spacer()
            }
        }
        .sheet(item: $selectedNewsURL) { url in
            SafariView(url: url)
                .ignoresSafeArea()
        }
        .toolbar {
            if appState.isLoggedIn {
                ToolbarItem(placement: .topBarTrailing) {
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
                            .foregroundStyle(isWatchlisted ? Palette.warningAmber : .secondary)
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

    @ViewBuilder
    private var chartView: some View {
        let points = priceHistory.compactMap { point -> (Date, Double)? in
            guard let date = point.parsedDate else { return nil }
            return (date, point.close)
        }
        let minPrice = points.map(\.1).min() ?? 0
        let maxPrice = points.map(\.1).max() ?? 0
        let padding = (maxPrice - minPrice) * 0.1

        Chart {
            ForEach(points, id: \.0) { date, close in
                LineMark(
                    x: .value("Date", date),
                    y: .value("Price", close)
                )
                .foregroundStyle(Palette.appleBlue)

                AreaMark(
                    x: .value("Date", date),
                    y: .value("Price", close)
                )
                .foregroundStyle(
                    .linearGradient(
                        colors: [Palette.appleBlue.opacity(0.3), .clear],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
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
        .chartYScale(domain: (minPrice - padding)...(maxPrice + padding))
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
                                    let changed = scrubPrice?.date != closest.0
                                    scrubPrice = (date: closest.0, price: closest.1)
                                    if changed {
                                        UISelectionFeedbackGenerator().selectionChanged()
                                    }
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
        case "1d", "5d":
            return .dateTime.month(.abbreviated).day()
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
            let result = try await MonicaAPI.shared.fetchPriceHistory(symbol: stock.symbol, range: selectedRange)
            priceHistory = result.history
        } catch {
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

    private func loadRelatedNews() async {
        do {
            async let symbolNews = MonicaAPI.shared.fetchStockNews(query: stock.symbol)
            async let nameNews = MonicaAPI.shared.fetchStockNews(query: stock.name)
            let (bySymbol, byName) = try await (symbolNews, nameNews)
            relatedNews = bySymbol.isEmpty ? byName : bySymbol
        } catch {
            do {
                let allNews = try await MonicaAPI.shared.fetchNews()
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

struct StockDetailPageView: View {
    let stocks: [Stock]
    let initialIndex: Int
    @State private var currentIndex: Int

    init(stocks: [Stock], initialIndex: Int) {
        self.stocks = stocks
        self.initialIndex = initialIndex
        _currentIndex = State(initialValue: initialIndex)
    }

    var body: some View {
        TabView(selection: $currentIndex) {
            ForEach(Array(stocks.enumerated()), id: \.element.id) { index, stock in
                StockDetailView(stock: stock)
                    .tag(index)
            }
        }
        .tabViewStyle(.page(indexDisplayMode: .never))
        .navigationTitle(stocks.indices.contains(currentIndex) ? stocks[currentIndex].symbol : "")
        .navigationBarTitleDisplayMode(.inline)
    }
}
