import Charts
import SwiftUI

struct MarketsView: View {
    @Environment(AppState.self) private var appState
    @Environment(\.scenePhase) private var scenePhase
    @State private var searchText = ""
    @State private var isVisible = false
    @State private var isActive = true
    @State private var hasLoaded = false
    @State private var hasLoadedNews = false
    @State private var selectedStock: Stock?
    @State private var sortField: MarketSortField = .changePercent
    @State private var sortAscending = false
    @State private var marketFilter: MarketFilter = .all
    @State private var gainersOnly = false
    @State private var selectedMarketItem: MarketItem?
    @State private var selectedNewsURL: URL?
    @State private var cachedItems: [MarketItem] = []
    @State private var feedDest: FeedDest? = nil
    @State private var tickerSelectedStock: Stock?
    @State private var newsArticles: [NewsArticle] = []
    @State private var isLoadingNews = true
    @State private var selectedStockForNews: Stock?
    @State private var isSearching = false
    @State private var searchResults: [EpiphanyAPI.SymbolSearchResult] = []
    @FocusState private var searchFieldFocused: Bool

    enum FeedDest: Identifiable {
        case news, macro, alerts
        var id: Self { self }
    }

    private static let assetDisplayNames: [String: String] = [
        "Gold": "Gold (XAU/USD)", "Silver": "Silver (XAG/USD)",
        "Oil": "WTI Crude Oil", "Natgas": "Natural Gas",
        "Copper": "Copper (HG)", "Platinum": "Platinum (PL)",
        "Palladium": "Palladium (PA)",
        "Nas100": "Nasdaq 100", "Us500": "S&P 500", "Us30": "Dow Jones",
        "Dxy": "US Dollar Index",
        "Btc": "Bitcoin", "Eth": "Ethereum",
    ]

    private func rebuildItems() {
        var items: [MarketItem] = []
        for stock in appState.stocks {
            items.append(MarketItem(
                name: stock.name, symbol: stock.symbol, price: stock.price,
                changePercent: stock.changePercent, marketCap: stock.marketCap,
                peRatio: stock.peRatio, kind: .stock(stock)
            ))
        }
        for commodity in appState.commodities {
            let displayName = Self.assetDisplayNames[commodity.name] ?? commodity.name
            items.append(MarketItem(
                name: displayName, symbol: commodity.name, price: commodity.price,
                changePercent: commodity.changePercent, marketCap: nil, peRatio: nil, kind: .commodity
            ))
        }
        for coin in appState.crypto {
            let displayName = Self.assetDisplayNames[coin.symbol.capitalized] ?? coin.symbol.uppercased()
            items.append(MarketItem(
                name: displayName, symbol: coin.symbol.uppercased(), price: coin.spot,
                changePercent: coin.chgPct, marketCap: nil, peRatio: nil, kind: .crypto
            ))
        }
        cachedItems = items.sorted { lhs, rhs in
            let result: Bool
            switch sortField {
            case .symbol: result = lhs.symbol.localizedCompare(rhs.symbol) == .orderedAscending
            case .name: result = lhs.name.localizedCompare(rhs.name) == .orderedAscending
            case .price: result = lhs.price < rhs.price
            case .peRatio: result = (lhs.peRatio ?? 0) < (rhs.peRatio ?? 0)
            case .marketCap: result = (lhs.marketCap ?? 0) < (rhs.marketCap ?? 0)
            case .changePercent: result = lhs.changePercent < rhs.changePercent
            }
            return sortAscending ? result : !result
        }
    }

    private var filteredItems: [MarketItem] {
        var items = cachedItems
        // Exclude watchlisted stocks from main list -- they already appear in the Watchlist section
        let watchlisted = appState.watchlistSymbols
        if !watchlisted.isEmpty {
            items = items.filter { item in
                if case .stock = item.kind { return !watchlisted.contains(item.symbol) }
                return true
            }
        }
        switch marketFilter {
        case .all: break
        case .stocks: items = items.filter { if case .stock = $0.kind { return true }; return false }
        case .commodities: items = items.filter { if case .commodity = $0.kind { return true }; return false }
        case .crypto: items = items.filter { if case .crypto = $0.kind { return true }; return false }
        }
        if gainersOnly { items = items.filter { $0.changePercent > 0 } }
        if searchText.isEmpty { return items }
        let query = searchText.lowercased()
        return items.filter {
            $0.name.lowercased().contains(query) ||
            $0.symbol.lowercased().contains(query)
        }
    }

    var body: some View {
        // Ticker above everything: it owns the strip under the status bar and the
        // nav stack starts below it.
        VStack(spacing: 0) {
            topAreaContent
            mainNavigation
        }
        .background(Palette.bg.ignoresSafeArea())
            .onAppear { setupOnAppear() }
            .onDisappear { isVisible = false }
            .onChange(of: appState.stocks.count) { _, _ in rebuildItems() }
            .onChange(of: appState.commodities.count) { _, _ in rebuildItems() }
            .onChange(of: appState.crypto.count) { _, _ in rebuildItems() }
            .onChange(of: sortField) { _, _ in rebuildItems() }
            .onChange(of: sortAscending) { _, _ in rebuildItems() }
            .onChange(of: appState.isLoggedIn) { _, isLoggedIn in
                if isLoggedIn && appState.watchlist.isEmpty {
                    Task { await appState.loadWatchlist() }
                }
            }
            // ponytail: adaptive interval instead of a fixed 30s Combine timer -- polls faster
            // (10s) while data is stale so it self-heals as soon as the upstream API recovers,
            // instead of sitting on the "Data may be stale" banner for a full 30s+ per retry.
            .task {
                while !Task.isCancelled {
                    let interval = appState.isStockDataStale ? 10 : 30
                    try? await Task.sleep(for: .seconds(interval))
                    // isActive is @State, so this reads the live phase, not the one captured when the task started.
                    guard isVisible, isActive else { continue }
                    await refreshAllData()
                }
            }
            .onChange(of: scenePhase) { _, newPhase in
                isActive = newPhase == .active
                guard newPhase == .active, isVisible else { return }
                Task { await refreshAllData() }
            }
    }

    private func setupOnAppear() {
        isVisible = true
        guard !hasLoaded else { return }
        hasLoaded = true
        Task { @MainActor in rebuildItems() }
        Task {
            if appState.dailyBrief == nil { await appState.loadDailyBrief() }
            if appState.statements.isEmpty { await appState.loadStatements() }
        }
        loadNewsIfNeeded()
    }

    private func loadNewsIfNeeded() {
        guard !hasLoadedNews, selectedStockForNews == nil else { return }
        hasLoadedNews = true
        Task {
            isLoadingNews = true
            do {
                newsArticles = try await EpiphanyAPI.shared.fetchNews()
            } catch {
                print("News load failed: \(error)")
            }
            isLoadingNews = false
        }
    }

    private func refreshAllData() async {
        async let s: Void = appState.loadStocks(force: true)
        async let c: Void = appState.loadCommodities(force: true)
        async let k: Void = appState.loadCrypto(force: true)
        _ = await (s, c, k)
        rebuildItems()
    }

    private var mainNavigation: some View {
        NavigationStack {
            mainContent
                .navigationDestination(item: $feedDest) { dest in
                    switch dest {
                    case .news: NewsView().environment(appState)
                    case .macro: MacroView().environment(appState)
                    case .alerts: AlertsView().environment(appState)
                    }
                }
                .navigationBarTitleDisplayMode(.inline)
                .toolbar { if !isSearching { // Fear & Greed sits where the redundant Markets title was.
                    ToolbarItem(placement: .topBarLeading) { fearGreedView }
                    ToolbarItemGroup(placement: .topBarTrailing) {
                    Menu {
                        Picker("Asset Type", selection: $marketFilter) {
                            ForEach(MarketFilter.allCases) { filter in
                                Text(filter.label).tag(filter)
                            }
                        }
                        Picker("Sort By", selection: $sortField) {
                            ForEach(MarketSortField.allCases) { field in
                                Text(field.label).tag(field)
                            }
                        }
                        Button {
                            sortAscending.toggle()
                        } label: {
                            Label(sortAscending ? "Ascending" : "Descending", systemImage: sortAscending ? "arrow.up" : "arrow.down")
                        }
                        Button {
                            gainersOnly.toggle()
                        } label: {
                            Label("Gainers Only", systemImage: gainersOnly ? "checkmark" : "arrow.up.right")
                        }
                    } label: {
                        Image(systemName: "line.3.horizontal.decrease.circle")
                    }
                    .accessibilityLabel("Filter and sort")

                    Button {
                        isSearching = true
                        searchFieldFocused = true
                    } label: {
                        Image(systemName: "magnifyingglass")
                            .frame(minWidth: 44, minHeight: 44)
                            .contentShape(Rectangle())
                    }
                    .accessibilityLabel("Search markets")
                } } }
        }
        .sheet(item: $selectedStock) { stock in
            // ponytail: page order = the order the row was tapped in, so a
            // swipe walks the list the user is looking at.
            let visible = filteredItems.compactMap { item -> Stock? in
                if case .stock(let s) = item.kind { return s }
                return nil
            }
            let stocks = visible.contains(where: { $0.symbol == stock.symbol }) ? visible : appState.watchlistStocks
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
        .sheet(item: $selectedNewsURL) { url in
            SafariView(url: url)
                .ignoresSafeArea()
        }
        .sheet(item: $tickerSelectedStock) { stock in
            NavigationStack {
                StockDetailView(stock: stock)
                    .environment(appState)
            }
        }
        .onChange(of: selectedStockForNews) { _, stock in
            guard let stock else { return }
            Task {
                isLoadingNews = true
                do {
                    newsArticles = try await EpiphanyAPI.shared.fetchStockNews(query: stock.symbol)
                } catch {
                    print("Failed to load news for \(stock.symbol): \(error)")
                }
                isLoadingNews = false
            }
        }
        .overlay(alignment: .bottom) { if !isSearching, feedDest == nil { newsDrawerOverlay } }
        .onChange(of: drawerState) { _, state in
            if state != .peek { loadNewsIfNeeded() }
        }
        .safeAreaInset(edge: .bottom, spacing: 0) { if isSearching { bottomSearchBar } }
        .onChange(of: isSearching) { _, active in appState.hideFloatingTabBar = active }
    }

    private var bottomSearchBar: some View {
        HStack(spacing: 10) {
            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass")
                    .foregroundStyle(.secondary)
                TextField("Search markets", text: $searchText)
                    .focused($searchFieldFocused)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .submitLabel(.search)
                Image(systemName: "mic.fill")
                    .foregroundStyle(.secondary)
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 8)
            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 12))

            Button {
                // Drop focus first so the field can't write the old text back as it resigns.
                searchFieldFocused = false
                searchText = ""
                isSearching = false
            } label: {
                Image(systemName: "xmark")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(.white)
                    .frame(width: 28, height: 28)
                    .background(Palette.appleBlue, in: Circle())
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(.bar)
    }

    @State private var drawerState: DrawerState = .peek

    /// Past either end the drawer gives a little and resists, like a system sheet.
    static func rubberBand(_ value: CGFloat, min lo: CGFloat, max hi: CGFloat) -> CGFloat {
        if value < lo { return lo - (lo - value) / (1 + (lo - value) / 60) }
        if value > hi { return hi + (value - hi) / (1 + (value - hi) / 60) }
        return value
    }

    private var newsDrawerOverlay: some View {
        NewsDrawerContainer(articles: $newsArticles, isLoading: $isLoadingNews,
                            brief: appState.dailyBrief, drawerState: $drawerState)
    }

    @ViewBuilder
    private var mainContent: some View {
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
                marketsList
            }
        }
    }

    private var marketsList: some View {
        List {
            // Any ticker, not just the loaded list: add it straight to the watchlist.
            let loaded = Set(filteredItems.map(\.symbol))
            let others = searchResults.filter { !loaded.contains($0.symbol) }
            if isSearching, !others.isEmpty {
                Section("Add to watchlist") {
                    ForEach(others) { result in
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(result.symbol).font(.body.weight(.semibold))
                                Text([result.name, result.exchange].compactMap { $0 }.joined(separator: " · "))
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                                    .lineLimit(1)
                            }
                            Spacer()
                            let added = appState.isInWatchlist(result.symbol)
                            Button {
                                Haptics.impact(.light)
                                Task {
                                    if added { await appState.removeWatchlistSymbol(result.symbol) }
                                    else { await appState.addWatchlistSymbol(result.symbol) }
                                }
                            } label: {
                                Image(systemName: added ? "checkmark.circle.fill" : "plus.circle")
                                    .font(.title3)
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel(added ? "Remove \(result.symbol) from watchlist" : "Add \(result.symbol) to watchlist")
                        }
                    }
                }
            }

            if !appState.watchlistStocks.isEmpty {
                Section("Watchlist") {
                    ForEach(appState.watchlistStocks) { stock in
                        Button {
                            selectedStock = stock
                        } label: {
                            StockRow(stock: stock, sparklineData: appState.sparklineCache[stock.symbol])
                        }
                        .buttonStyle(BounceButtonStyle())
                        .swipeActions(edge: .trailing) { watchlistSwipe(stock.symbol) }
                        .padding(.horizontal, 16)
                        .alignmentGuide(.listRowSeparatorLeading) { _ in 16 }
                        .alignmentGuide(.listRowSeparatorTrailing) { $0.width - 16 }
                    }
                }
                .listRowInsets(EdgeInsets())
                .listRowBackground(Color.clear)
            }

            ForEach(filteredItems) { item in
                Group {
                    switch item.kind {
                    case .stock(let stock):
                        stockRow(stock)
                    case .commodity, .crypto:
                        commodityCryptoRow(item)
                    }
                }
                .padding(.horizontal, 16)
                // Separators inset 16 on both sides, like iOS Stocks.
                .alignmentGuide(.listRowSeparatorLeading) { _ in 16 }
                .alignmentGuide(.listRowSeparatorTrailing) { $0.width - 16 }
            }
            .listRowInsets(EdgeInsets())
            .listRowBackground(Color.clear)
        }
        .animation(.smooth, value: searchText)
        // The default grouped-list top margin left a blank band under the ticker strip.
        .contentMargins(.top, 4, for: .scrollContent)
        // Rows run to the screen edges; the grouped list's side margins are gone.
        .contentMargins(.horizontal, 0, for: .scrollContent)
        .task(id: searchText) {
            let query = searchText.trimmingCharacters(in: .whitespaces)
            guard isSearching, !query.isEmpty else { searchResults = []; return }
            try? await Task.sleep(for: .milliseconds(250))
            guard !Task.isCancelled else { return }
            searchResults = (try? await EpiphanyAPI.shared.searchSymbols(query)) ?? []
        }
        // Clear the floating tab bar AND the news drawer's peek (which floats over
        // the list bottom) so the last stock rows scroll fully into view.
        .safeAreaInset(edge: .bottom) { Color.clear.frame(height: 196) }
        .refreshable {
            do {
                try await appState.refreshMarkets()
            } catch {
                print("Market refresh failed: \(error)")
            }
        }
    }

    @ViewBuilder
    private func stockRow(_ stock: Stock) -> some View {
        Button {
            selectedStock = stock
            selectedStockForNews = stock
            withAnimation(.spring(response: 0.35, dampingFraction: 0.82)) { drawerState = .medium }
        } label: {
            StockRow(stock: stock, sparklineData: appState.sparklineCache[stock.symbol])
        }
        .buttonStyle(BounceButtonStyle())
        .swipeActions(edge: .trailing) { if appState.isLoggedIn { watchlistSwipe(stock.symbol) } }
        .accessibilityIdentifier("market-stock-row")
    }

    /// The star moved off the row into a swipe, like iOS Stocks.
    private func watchlistSwipe(_ symbol: String) -> some View {
        let watched = appState.isInWatchlist(symbol)
        return Button {
            Haptics.impact(.light)
            Task {
                if watched { await appState.removeWatchlistSymbol(symbol) }
                else { await appState.addWatchlistSymbol(symbol) }
            }
        } label: {
            Label(watched ? "Unwatch" : "Watch", systemImage: watched ? "star.slash" : "star")
        }
        .tint(watched ? .gray : Palette.warningAmber)
    }

    private func commodityCryptoRow(_ item: MarketItem) -> some View {
        Button {
            selectedMarketItem = item
        } label: {
            QuoteRow(symbol: item.symbol, name: item.name, price: item.price,
                     changePercent: item.changePercent, sparklineData: appState.sparklineCache[item.symbol])
        }
        .swipeActions(edge: .trailing) {
            let fav = appState.isLocalFavorite(item.name)
            Button {
                appState.toggleLocalFavorite(item.name)
            } label: {
                Label(fav ? "Unwatch" : "Watch", systemImage: fav ? "star.slash" : "star")
            }
            .tint(fav ? .gray : Palette.warningAmber)
        }
        .buttonStyle(BounceButtonStyle())
    }

    private var topAreaContent: some View {
        VStack(spacing: 0) {
            if appState.isStockDataStale, let fetchedAt = appState.stocksFetchedAt {
                (Text("Data may be stale \u{00B7} updated ") + Text(fetchedAt, style: .relative) + Text(" ago"))
                    .font(.caption2)
                    .foregroundStyle(.orange)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.vertical, 4)
                    .background(.black.opacity(0.6))
            }
            if !appState.stocks.isEmpty {
                TickerBarView(appState: appState, onSelectStock: { stock in
                    tickerSelectedStock = stock
                }, height: 60)
                .opacity(appState.isStockDataStale ? 0.65 : 1.0)
            }
        }
        // The marquee is thousands of points wide; bound it here or the inset
        // stretches the whole list off screen.
        .containerRelativeFrame(.horizontal)
        .clipped()
    }

    private var fearGreedView: some View {
        Group {
            if let fgScore = appState.fearGreedScore, let fgRating = appState.fearGreedRating {
                // One compact chip in the nav bar: label, score, rating on one baseline.
                HStack(alignment: .firstTextBaseline, spacing: 6) {
                    Text("Fear & Greed")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                    Text("\(fgScore)")
                        .font(.subheadline.weight(.bold).monospacedDigit())
                        .foregroundStyle(fearGreedColor(fgScore))
                    Text(fgRating.capitalized)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(fearGreedColor(fgScore))
                }
                .padding(.horizontal, 10)
                .fixedSize()
                .accessibilityElement(children: .combine)
                .accessibilityLabel("Fear and Greed index \(fgScore), \(fgRating)")
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

    private func fearGreedColor(_ score: Int) -> Color {
        if score <= 24 { return Palette.dangerRed }
        if score <= 44 { return Palette.warningAmber }
        if score <= 55 { return .secondary }
        if score <= 75 { return Palette.successGreen }
        return Palette.successGreen
    }
}

// MARK: - Filter

private enum MarketFilter: String, CaseIterable, Identifiable {
    case all, stocks, commodities, crypto

    var id: String { rawValue }

    var label: String {
        switch self {
        case .all: return "All"
        case .stocks: return "Stocks"
        case .commodities: return "Commodities"
        case .crypto: return "Crypto"
        }
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
        let lower = symbol.lowercased()
        switch kind {
        case .stock: return symbol
        case .commodity:
            let map: [String: String] = [
                "gold": "GC=F", "silver": "SI=F", "platinum": "PL=F",
                "palladium": "PA=F", "copper": "HG=F", "oil": "CL=F",
                "natgas": "NG=F", "nas100": "^NDX", "us500": "^GSPC",
                "us30": "^DJI", "dxy": "DX-Y.NYB", "us10y": "^TNX"
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

private struct MarketItemDetailView: View {
    let item: MarketItem

    @State private var selectedRange = "1y"
    @State private var isLoading = true
    @State private var priceHistory: [PriceHistory.DataPoint] = []
    @State private var hasLoaded = false
    @State private var error: String?
    @State private var relatedNews: [NewsArticle] = []
    @State private var selectedNewsURL: URL?

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
                    if case .stock(let stock) = item.kind {
                        if let b = stock.bid { infoRow("Bid", value: CurrencyFormatter.formatPrice(b)) }
                        if let a = stock.ask { infoRow("Ask", value: CurrencyFormatter.formatPrice(a)) }
                        if stock.open > 0 { infoRow("Open", value: CurrencyFormatter.formatPrice(stock.open)) }
                        if stock.prevClose > 0 { infoRow("Prev Close", value: CurrencyFormatter.formatPrice(stock.prevClose)) }
                        if let r = stock.dayRange { infoRow("Day Range", value: r) }
                        if let r = stock.yearRange { infoRow("52W Range", value: r) }
                        infoRow("Volume", value: stock.formattedVolume)
                        if let av = stock.formattedAvgVolume { infoRow("Avg Vol", value: av) }
                        if let ex = stock.exchange { infoRow("Exchange", value: ex) }
                        if let e = stock.formattedEPS { infoRow("EPS", value: e) }
                        if let bt = stock.formattedBeta { infoRow("Beta", value: bt) }
                        if let y = stock.formattedYield { infoRow("Yield", value: y) }
                    }
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
                    .padding(.top, 8)
                }

                Spacer()
            }
        }
        .sheet(item: $selectedNewsURL) { url in
            SafariView(url: url)
                .ignoresSafeArea()
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
            guard let date = DateParsing.parse(point.date) else { return nil }
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
            let history = try await EpiphanyAPI.shared.fetchPriceHistory(symbol: yahooSym, range: selectedRange)
            priceHistory = history.history
        } catch {
            self.error = "Chart unavailable"
        }
        isLoading = false
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
        do {
            relatedNews = try await EpiphanyAPI.shared.fetchStockNews(query: item.symbol)
        } catch {
            relatedNews = []
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
