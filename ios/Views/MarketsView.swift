import Charts
import SwiftUI

struct MarketsView: View {
    @Environment(AppState.self) private var appState
    @Environment(\.scenePhase) private var scenePhase
    @State private var searchText = ""
    @State private var isVisible = false
    @State private var hasLoaded = false
    @State private var selectedStock: Stock?
    @State private var sortField: MarketSortField = .changePercent
    @State private var sortAscending = false
    @State private var selectedMarketItem: MarketItem?

    private let refreshTimer = Timer.publish(every: 30, on: .main, in: .common).autoconnect()

    private var marketStatusText: String {
        usMarketStatus.label
    }

    private var marketStatusColor: Color {
        usMarketStatus.color
    }

    private var allItems: [MarketItem] {
        var items: [MarketItem] = []

        for stock in appState.stocks {
            items.append(MarketItem(
                name: stock.name,
                symbol: stock.symbol,
                price: stock.price,
                changePercent: stock.changePercent,
                marketCap: stock.marketCap,
                peRatio: stock.peRatio,
                kind: .stock(stock)
            ))
        }

        for commodity in appState.commodities {
            items.append(MarketItem(
                name: commodity.name,
                symbol: commodity.name,
                price: commodity.price,
                changePercent: commodity.changePercent,
                marketCap: nil,
                peRatio: nil,
                kind: .commodity
            ))
        }

        for coin in appState.crypto {
            items.append(MarketItem(
                name: coin.symbol,
                symbol: coin.symbol,
                price: coin.spot,
                changePercent: coin.chgPct,
                marketCap: nil,
                peRatio: nil,
                kind: .crypto
            ))
        }

        return items.sorted { lhs, rhs in
            let result: Bool
            switch sortField {
            case .symbol:
                result = lhs.symbol.localizedCompare(rhs.symbol) == .orderedAscending
            case .name:
                result = lhs.name.localizedCompare(rhs.name) == .orderedAscending
            case .price:
                result = lhs.price < rhs.price
            case .peRatio:
                result = (lhs.peRatio ?? 0) < (rhs.peRatio ?? 0)
            case .marketCap:
                result = (lhs.marketCap ?? 0) < (rhs.marketCap ?? 0)
            case .changePercent:
                result = lhs.changePercent < rhs.changePercent
            }
            return sortAscending ? result : !result
        }
    }

    private var filteredItems: [MarketItem] {
        if searchText.isEmpty { return allItems }
        return allItems.filter {
            $0.name.localizedCaseInsensitiveContains(searchText) ||
            $0.symbol.localizedCaseInsensitiveContains(searchText)
        }
    }

    var body: some View {
        NavigationStack {
            Group {
                if appState.isLoading && appState.stocks.isEmpty {
                    ProgressView()
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if appState.stocks.isEmpty && appState.commodities.isEmpty && appState.crypto.isEmpty {
                    ContentUnavailableView(
                        "Markets Temporarily Unavailable",
                        systemImage: "chart.line.uptrend.xyaxis",
                        description: Text("Pull to refresh and try again.")
                    )
                } else {
                    List {
                        Section {
                            HStack {
                                Circle()
                                    .fill(marketStatusColor)
                                    .frame(width: 10, height: 10)
                                Text(marketStatusText)
                                    .font(.subheadline.weight(.semibold))
                                Spacer()
                                Text("Auto refresh: 30s")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            .padding(.vertical, 4)
                        }
                        .listRowBackground(
                            RoundedRectangle(cornerRadius: 8)
                                .fill(.ultraThinMaterial)
                                .padding(2)
                        )

                        if !appState.watchlistStocks.isEmpty {
                            Section("Watchlist") {
                                ForEach(appState.watchlistStocks) { stock in
                                    Button {
                                        selectedStock = stock
                                    } label: {
                                        StockRow(
                                            stock: stock,
                                            isWatchlisted: true,
                                            onToggleWatchlist: {
                                                Task { await appState.removeWatchlistSymbol(stock.symbol) }
                                            }
                                        )
                                    }
                                    .buttonStyle(BounceButtonStyle())
                                }
                            }
                            .listRowBackground(
                                RoundedRectangle(cornerRadius: 8)
                                    .fill(.ultraThinMaterial)
                                    .padding(2)
                            )
                        }

                        Section {
                            NavigationLink {
                                NewsView()
                                    .environment(appState)
                            } label: {
                                Label("News", systemImage: "newspaper")
                            }
                            NavigationLink {
                                MacroView()
                                    .environment(appState)
                            } label: {
                                Label("Macro", systemImage: "chart.bar.doc.horizontal")
                            }
                            NavigationLink {
                                AlertsView()
                                    .environment(appState)
                            } label: {
                                Label("Alerts", systemImage: "bell.badge")
                            }
                        }

                        Section {
                            HStack {
                                Picker("Sort", selection: $sortField) {
                                    ForEach(MarketSortField.allCases) { field in
                                        Text(field.label).tag(field)
                                    }
                                }
                                .pickerStyle(.menu)

                                Spacer()

                                Button {
                                    sortAscending.toggle()
                                } label: {
                                    HStack(spacing: 4) {
                                        Image(systemName: sortAscending ? "arrow.up" : "arrow.down")
                                            .font(.caption.weight(.semibold))
                                        Text(sortAscending ? "ASC" : "DESC")
                                            .font(.system(size: 11, weight: .medium))
                                            .textCase(.uppercase)
                                            .foregroundStyle(.secondary)
                                    }
                                }
                                .buttonStyle(BounceButtonStyle())
                                .foregroundStyle(Palette.appleBlue)
                            }
                        }
                        .listRowBackground(
                            RoundedRectangle(cornerRadius: 8)
                                .fill(.ultraThinMaterial)
                                .padding(2)
                        )

                        ForEach(filteredItems) { item in
                            switch item.kind {
                            case .stock(let stock):
                                Button {
                                    selectedStock = stock
                                } label: {
                                    StockRow(
                                        stock: stock,
                                        isWatchlisted: appState.isInWatchlist(stock.symbol),
                                        onToggleWatchlist: appState.isLoggedIn ? {
                                            Task {
                                                if appState.isInWatchlist(stock.symbol) {
                                                    await appState.removeWatchlistSymbol(stock.symbol)
                                                } else {
                                                    await appState.addWatchlistSymbol(stock.symbol)
                                                }
                                            }
                                        } : nil
                                    )
                                }
                                .buttonStyle(BounceButtonStyle())
                            case .commodity, .crypto:
                                Button {
                                    selectedMarketItem = item
                                } label: {
                                    MarketRow(
                                        name: item.name,
                                        priceText: String(format: "$%.2f", item.price),
                                        changePercent: item.changePercent,
                                        isFavorited: appState.isLocalFavorite(item.name),
                                        onToggleFavorite: {
                                            appState.toggleLocalFavorite(item.name)
                                        }
                                    )
                                }
                                .buttonStyle(BounceButtonStyle())
                            }
                        }
                        .listRowBackground(
                            RoundedRectangle(cornerRadius: 8)
                                .fill(.ultraThinMaterial)
                                .padding(2)
                        )
                    }
                    .searchable(text: $searchText, prompt: "Search markets")
                    .animation(.smooth, value: searchText)
                    .refreshable {
                        async let stocks: Void = appState.loadStocks(force: true)
                        async let commodities: Void = appState.loadCommodities(force: true)
                        async let crypto: Void = appState.loadCrypto(force: true)
                        _ = await (stocks, commodities, crypto)
                    }
                }
            }
            .navigationTitle("Markets")
        }
        .sheet(item: $selectedStock) { stock in
            let stocks = appState.stocks
            let initialIndex = stocks.firstIndex(where: { $0.symbol == stock.symbol }) ?? 0
            NavigationStack {
                StockDetailPageView(stocks: stocks, initialIndex: initialIndex)
                    .environment(appState)
            }
        }
        .sheet(item: $selectedMarketItem) { item in
            let items = filteredItems.filter {
                if case .stock = $0.kind { return false }
                return true
            }
            let initialIndex = items.firstIndex(where: { $0.id == item.id }) ?? 0
            NavigationStack {
                MarketItemDetailPageView(items: items, initialIndex: initialIndex)
            }
        }
        .onAppear {
            isVisible = true
            guard !hasLoaded else { return }
            hasLoaded = true
            Task {
                async let stocks: Void = appState.loadStocks()
                async let watchlist: Void = appState.loadWatchlist()
                async let commodities: Void = appState.loadCommodities()
                async let crypto: Void = appState.loadCrypto()
                _ = await (stocks, watchlist, commodities, crypto)
            }
        }
        .onDisappear { isVisible = false }
        .onChange(of: appState.isLoggedIn) { _, isLoggedIn in
            guard isLoggedIn, appState.watchlist.isEmpty else { return }
            Task {
                await appState.loadWatchlist()
            }
        }
        .onReceive(refreshTimer) { _ in
            guard isVisible, scenePhase == .active else { return }
            Task {
                async let s: Void = appState.loadStocks(force: true)
                async let c: Void = appState.loadCommodities(force: true)
                async let k: Void = appState.loadCrypto(force: true)
                _ = await (s, c, k)
            }
        }
    }
}

private extension MarketsView {
    var usMarketStatus: (label: String, color: Color) {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "America/New_York") ?? .current
        let now = Date()
        let components = calendar.dateComponents([.weekday, .hour, .minute], from: now)
        let weekday = components.weekday ?? 0
        let minutes = (components.hour ?? 0) * 60 + (components.minute ?? 0)

        let isWeekday = (2...6).contains(weekday)
        let premarketStart = 4 * 60
        let marketOpen = 9 * 60 + 30
        let marketClose = 16 * 60
        let afterHoursClose = 20 * 60

        guard isWeekday else {
            return ("Market Closed", .secondary)
        }
        if minutes >= marketOpen && minutes < marketClose {
            return ("Market Open", Palette.successGreen)
        }
        if minutes >= premarketStart && minutes < marketOpen {
            return ("Pre-Market", Palette.warningAmber)
        }
        if minutes >= marketClose && minutes < afterHoursClose {
            return ("After Hours", Palette.warningAmber)
        }
        return ("Market Closed", .secondary)
    }
}

// MARK: - Sort

enum MarketSortField: String, CaseIterable, Identifiable {
    case symbol, name, price, peRatio, marketCap, changePercent

    var id: String { rawValue }

    var label: String {
        switch self {
        case .symbol: return "Symbol"
        case .name: return "Name"
        case .price: return "Price"
        case .peRatio: return "P/E Ratio"
        case .marketCap: return "Market Cap"
        case .changePercent: return "% Change"
        }
    }
}

// MARK: - MarketItem

private struct MarketItem: Identifiable {
    let name: String
    let symbol: String
    let price: Double
    let changePercent: Double
    let marketCap: Double?
    let peRatio: Double?
    let kind: Kind

    var id: String {
        switch kind {
        case .stock: return "stock-\(symbol)"
        case .commodity: return "commodity-\(name)"
        case .crypto: return "crypto-\(symbol)"
        }
    }

    enum Kind {
        case stock(Stock)
        case commodity
        case crypto
    }

    var yahooSymbol: String? {
        let lower = name.lowercased()
        switch kind {
        case .stock: return symbol
        case .commodity:
            let map: [String: String] = [
                "gold": "GC=F", "silver": "SI=F", "platinum": "PL=F",
                "palladium": "PA=F", "copper": "HG=F", "oil": "CL=F",
                "natgas": "NG=F", "nas100": "^NDX", "us500": "^GSPC",
                "us30": "^DJI", "dxy": "DX-Y.NYB"
            ]
            return map[lower]
        case .crypto:
            let map: [String: String] = [
                "btc": "BTC-USD", "eth": "ETH-USD", "sol": "SOL-USD",
                "xrp": "XRP-USD", "doge": "DOGE-USD", "ada": "ADA-USD",
                "bnb": "BNB-USD", "avax": "AVAX-USD", "link": "LINK-USD",
                "matic": "MATIC-USD", "dot": "DOT-USD"
            ]
            return map[lower]
        }
    }
}

// MARK: - MarketRow

private struct MarketRow: View {
    let name: String
    let priceText: String
    let changePercent: Double
    var isFavorited: Bool = false
    var onToggleFavorite: (() -> Void)? = nil

    private var changeColorValue: Color {
        Palette.forChange(changePercent)
    }

    private var signedPercent: String {
        CurrencyFormatter.formatSignedPercent(changePercent)
    }

    var body: some View {
        HStack(spacing: 10) {
            if let onToggle = onToggleFavorite {
                Button {
                    onToggle()
                } label: {
                    Image(systemName: isFavorited ? "star.fill" : "star")
                        .foregroundStyle(isFavorited ? Palette.warningAmber : .secondary)
                        .font(.caption)
                        .frame(width: 18, height: 18)
                }
                .buttonStyle(BounceButtonStyle())
            } else {
                Color.clear
                    .frame(width: 18, height: 18)
            }

            marketIcon

            VStack(alignment: .leading, spacing: 2) {
                Text(symbolOrName)
                    .font(.body.weight(.medium))
                Text(name)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 4) {
                Text(priceText)
                    .font(.body.weight(.medium))
                ChangePill(text: signedPercent, color: changeColorValue)
            }
        }
        .padding(.vertical, 6)
        .contentShape(Rectangle())
    }

    private var marketIcon: some View {
        let lower = name.lowercased()
        let (icon, color): (String, Color) = {
            // Commodities
            if lower.contains("gold") || lower.contains("xau") { return ("circle.fill", .yellow) }
            if lower.contains("silver") || lower.contains("xag") { return ("circle.fill", Color(.systemGray3)) }
            if lower.contains("oil") || lower.contains("crude") || lower.contains("wti") || lower.contains("brent") { return ("drop.fill", .brown) }
            if lower.contains("gas") || lower.contains("natgas") || lower.contains("natural") { return ("flame.fill", .orange) }
            if lower.contains("copper") { return ("circle.fill", Color(.systemOrange)) }
            if lower.contains("platinum") { return ("circle.fill", Color(.systemGray)) }
            if lower.contains("corn") || lower.contains("wheat") || lower.contains("soy") || lower.contains("coffee") || lower.contains("sugar") { return ("leaf.fill", .green) }
            // Indices
            if lower.contains("us500") || lower.contains("s&p") || lower.contains("spx") { return ("chart.line.uptrend.xyaxis", Palette.appleBlue) }
            if lower.contains("nas") || lower.contains("ndx") || lower.contains("nasdaq") { return ("chart.line.uptrend.xyaxis", .green) }
            if lower.contains("us30") || lower.contains("dow") || lower.contains("dji") { return ("chart.line.uptrend.xyaxis", .cyan) }
            if lower.contains("dxy") || lower.contains("dollar") { return ("dollarsign.circle.fill", .green) }
            if lower.contains("vix") { return ("waveform.path.ecg", .red) }
            // Crypto
            if lower.contains("btc") || lower.contains("bitcoin") { return ("bitcoinsign.circle.fill", .orange) }
            if lower.contains("eth") || lower.contains("ether") { return ("diamond.fill", Palette.appleBlue) }
            if lower.contains("sol") || lower.contains("solana") { return ("sun.max.fill", .purple) }
            if lower.contains("xrp") || lower.contains("ripple") { return ("circle.hexagongrid.fill", Color(.systemBlue)) }
            if lower.contains("doge") { return ("hare.fill", .yellow) }
            if lower.contains("ada") || lower.contains("cardano") { return ("hexagon.fill", Palette.appleBlue) }
            if lower.contains("bnb") { return ("square.fill", .yellow) }
            if lower.contains("avax") { return ("triangle.fill", .red) }
            if lower.contains("link") { return ("link.circle.fill", Palette.appleBlue) }
            if lower.contains("matic") || lower.contains("pol") { return ("pentagon.fill", .purple) }
            return ("chart.bar.fill", .secondary)
        }()
        return Image(systemName: icon)
            .font(.title3)
            .foregroundStyle(color)
            .frame(width: 32, height: 32)
    }

    private var symbolOrName: String {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.count <= 6 {
            return trimmed.uppercased()
        }
        return trimmed
    }
}

private struct MarketItemDetailView: View {
    let item: MarketItem

    @State private var selectedRange = "1y"
    @State private var isLoading = true
    @State private var priceHistory: [PriceHistory.DataPoint] = []
    @State private var hasLoaded = false
    @State private var error: String?
    @State private var relatedNews: [NewsArticle] = []

    private let ranges = ["1d", "5d", "1mo", "3mo", "1y"]

    private var itemChangeColor: Color {
        Palette.forChange(item.changePercent)
    }

    private var kindLabel: String {
        switch item.kind {
        case .stock: return "Stock"
        case .commodity: return "Commodity"
        case .crypto: return "Crypto"
        }
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                VStack(spacing: 4) {
                    Text(CurrencyFormatter.formatPrice(item.price))
                        .font(.system(size: 44, weight: .bold, design: .rounded))
                    HStack(spacing: 6) {
                        Text(CurrencyFormatter.formatSignedPercent(item.changePercent))
                    }
                    .font(.callout.weight(.medium))
                    .foregroundStyle(itemChangeColor)
                }
                .padding(.top, 8)

                if isLoading {
                    ProgressView()
                        .frame(height: 220)
                } else if priceHistory.count >= 2 {
                    chartView
                } else if let error {
                    Text(error)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .frame(height: 220)
                } else {
                    Text("No chart data available")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .frame(height: 220)
                }

                Picker("Range", selection: $selectedRange) {
                    ForEach(ranges, id: \.self) { range in
                        Text(range.uppercased()).tag(range)
                    }
                }
                .pickerStyle(.segmented)
                .padding(.horizontal)

                VStack(spacing: 0) {
                    infoRow("Type", value: kindLabel)
                    if let cap = item.marketCap, cap > 0 {
                        infoRow("Market Cap", value: CurrencyFormatter.formatAbbreviated(cap))
                    }
                    if let pe = item.peRatio, pe > 0 {
                        infoRow("P/E Ratio", value: String(format: "%.1f", pe))
                    }
                }
                .padding()
                .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 12))
                .padding(.horizontal)

                if !relatedNews.isEmpty {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Related News")
                            .font(.headline)
                            .padding(.horizontal)

                        ForEach(relatedNews.prefix(5)) { article in
                            if let url = URL(string: article.url) {
                                Link(destination: url) {
                                    CompactNewsRow(article: article)
                                }
                            } else {
                                CompactNewsRow(article: article)
                            }
                        }
                    }
                    .padding(.top, 8)
                }

                Spacer()
            }
        }
        .navigationTitle(item.name)
        .navigationBarTitleDisplayMode(.inline)
        .task {
            await loadRelatedNews()
        }
        .task(id: selectedRange) {
            await loadHistory()
        }
    }

    @ViewBuilder
    private var chartView: some View {
        let points = priceHistory.compactMap { point -> (Date, Double)? in
            guard let date = ISO8601DateFormatter().date(from: point.date) ??
                  dateFormatter.date(from: point.date) else { return nil }
            return (date, point.close)
        }

        if points.count >= 2 {
            Chart(points, id: \.0) { point in
                LineMark(
                    x: .value("Date", point.0),
                    y: .value("Price", point.1)
                )
                .foregroundStyle(itemChangeColor)

                AreaMark(
                    x: .value("Date", point.0),
                    y: .value("Price", point.1)
                )
                .foregroundStyle(
                    LinearGradient(
                        colors: [itemChangeColor.opacity(0.2), .clear],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
            }
            .chartXAxis {
                AxisMarks(values: .automatic(desiredCount: 5)) { value in
                    AxisValueLabel {
                        if let date = value.as(Date.self) {
                            Text(date, format: .dateTime.month(.abbreviated).day())
                                .font(.caption2)
                        }
                    }
                }
            }
            .chartYAxis {
                AxisMarks(position: .trailing, values: .automatic(desiredCount: 4))
            }
            .frame(height: 220)
            .padding(.horizontal)
        }
    }

    private func loadHistory() async {
        guard let yahooSym = item.yahooSymbol else {
            isLoading = false
            error = "No chart data for this asset"
            return
        }
        isLoading = true
        error = nil
        do {
            let history = try await OpticonAPI.shared.fetchPriceHistory(symbol: yahooSym, range: selectedRange)
            priceHistory = history.history
        } catch {
            self.error = "Chart unavailable"
        }
        isLoading = false
    }

    private var dateFormatter: DateFormatter {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        return f
    }

    private func infoRow(_ title: String, value: String) -> some View {
        HStack {
            Text(title)
                .foregroundStyle(.secondary)
            Spacer()
            Text(value)
                .fontWeight(.medium)
        }
        .font(.subheadline)
        .padding(.vertical, 10)
    }

    private func loadRelatedNews() async {
        guard let allNews = try? await OpticonAPI.shared.fetchNews() else { return }
        let nameLower = item.name.lowercased()
        let symbolLower = item.symbol.lowercased()
        relatedNews = allNews.filter { article in
            let titleLower = article.title.lowercased()
            return titleLower.contains(nameLower) || titleLower.contains(symbolLower)
        }
    }
}

private struct MarketItemDetailPageView: View {
    let items: [MarketItem]
    let initialIndex: Int
    @State private var currentIndex: Int

    init(items: [MarketItem], initialIndex: Int) {
        self.items = items
        self.initialIndex = initialIndex
        _currentIndex = State(initialValue: initialIndex)
    }

    var body: some View {
        TabView(selection: $currentIndex) {
            ForEach(Array(items.enumerated()), id: \.element.id) { index, item in
                MarketItemDetailView(item: item)
                    .tag(index)
            }
        }
        .tabViewStyle(.page(indexDisplayMode: .never))
        .navigationTitle(items.indices.contains(currentIndex) ? items[currentIndex].name : "")
        .navigationBarTitleDisplayMode(.inline)
    }
}
