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
    @State private var marketFilter: MarketFilter = .all
    @State private var selectedMarketItem: MarketItem?
    @State private var selectedNewsURL: URL?
    @State private var cachedItems: [MarketItem] = []
    @State private var feedDest: FeedDest? = nil
    @State private var tickerSelectedStock: Stock?
    @State private var newsArticles: [NewsArticle] = []
    @State private var isLoadingNews = true
    @State private var selectedStockForNews: Stock?
    @State private var isSearching = false
    @FocusState private var searchFieldFocused: Bool

    enum FeedDest: Identifiable {
        case news, macro, alerts
        var id: Self { self }
    }

    private let refreshTimer = Timer.publish(every: 30, on: .main, in: .common).autoconnect()

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
        if searchText.isEmpty { return items }
        let query = searchText.lowercased()
        return items.filter {
            $0.name.lowercased().contains(query) ||
            $0.symbol.lowercased().contains(query)
        }
    }

    var body: some View {
        mainNavigation
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
            .onReceive(refreshTimer) { _ in
                guard isVisible, scenePhase == .active else { return }
                Task { await refreshAllData() }
            }
            .onChange(of: scenePhase) { _, newPhase in
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
        ZStack(alignment: .topTrailing) {
            NavigationStack {
                mainContent
                    .navigationDestination(item: $feedDest) { dest in
                        switch dest {
                        case .news: NewsView().environment(appState)
                        case .macro: MacroView().environment(appState)
                        case .alerts: AlertsView().environment(appState)
                        }
                    }
            }

            if !isSearching {
                HStack(spacing: 4) {
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
                    } label: {
                        Image(systemName: "ellipsis.circle")
                            .font(.headline)
                            .foregroundStyle(Palette.appleBlue)
                            .padding(Spacing.sm)
                    }

                    Button {
                        isSearching = true
                        searchFieldFocused = true
                    } label: {
                        Image(systemName: "magnifyingglass")
                            .font(.headline)
                            .foregroundStyle(Palette.appleBlue)
                            .padding(Spacing.sm)
                    }
                }
            }
        }
        .sheet(item: $selectedStock) { stock in
            let isWatchlisted = appState.watchlistSymbols.contains(stock.symbol)
            let stocks = isWatchlisted
                ? appState.stocks
                : filteredItems.compactMap { item -> Stock? in
                    if case .stock(let s) = item.kind { return s }
                    return nil
                }
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
        .overlay(alignment: .bottom) { if !isSearching { newsDrawerOverlay } }
        .safeAreaInset(edge: .top, spacing: 8) { topAreaContent }
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
                    .submitLabel(.search)
                Image(systemName: "mic.fill")
                    .foregroundStyle(.secondary)
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 8)
            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 12))

            Button {
                searchText = ""
                isSearching = false
                searchFieldFocused = false
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
    // Plain @State (not @GestureState) so we can reset it to 0 *inside* the
    // release animation -- @GestureState resets instantly and pops the height.
    @State private var dragTranslation: CGFloat = 0

    private enum DrawerState: CaseIterable {
        case peek, medium, large
        func height(in totalHeight: CGFloat) -> CGFloat {
            switch self {
            case .peek: return 64
            case .medium: return totalHeight * 0.45
            // Fills up to just under the top ticker strip (~top 10%) so a fully
            // open drawer reads as "ticker bar + drawer", nothing in between.
            case .large: return totalHeight * 0.90
            }
        }
    }

    private var newsDrawerOverlay: some View {
        GeometryReader { geo in
            let target = drawerState.height(in: geo.size.height) - dragTranslation
            let height = min(max(64, target), geo.size.height - 80)
            VStack(spacing: 0) {
                NewsDrawerView(articles: $newsArticles, isLoading: $isLoadingNews, brief: appState.dailyBrief)
            }
            .frame(maxWidth: .infinity)
            .frame(height: height, alignment: .top)
            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 16))
            .clipShape(RoundedRectangle(cornerRadius: 16))
            .overlay(
                RoundedRectangle(cornerRadius: 16)
                    .strokeBorder(.white.opacity(0.12), lineWidth: 0.5)
            )
            .shadow(radius: 8, y: -2)
            .padding(.bottom, 80)
            .overlay(alignment: .top) {
                Color.clear
                    .frame(height: 60)
                    .contentShape(Rectangle())
                    .gesture(
                        DragGesture()
                            .onChanged { value in
                                dragTranslation = value.translation.height
                            }
                            .onEnded { value in
                                let totalHeight = geo.size.height
                                // Project momentum so a flick settles past the nearest detent.
                                let predicted = drawerState.height(in: totalHeight)
                                    - value.predictedEndTranslation.height
                                let settled = DrawerState.allCases.min(
                                    by: { abs($0.height(in: totalHeight) - predicted) < abs($1.height(in: totalHeight) - predicted) }
                                ) ?? .peek
                                // Reset drag AND snap the detent in one animation so the
                                // height interpolates continuously -- no instant pop.
                                withAnimation(.spring(response: 0.35, dampingFraction: 0.82)) {
                                    drawerState = settled
                                    dragTranslation = 0
                                }
                            }
                    )
            }
            .padding(.horizontal, 8)
            .padding(.bottom, 4)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)
        }
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
            // Hidden when the drawer is fully open so the top strip is purely the
            // ticker bar -- no half-obscured Fear & Greed row behind the drawer.
            if drawerState != .large {
                Section { fearGreedView }
                    .listRowInsets(EdgeInsets())
                    .listRowBackground(Color.clear)
            }

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
                                    Haptics.impact(.light)
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

            ForEach(filteredItems) { item in
                switch item.kind {
                case .stock(let stock):
                    stockRow(stock)
                case .commodity, .crypto:
                    commodityCryptoRow(item)
                }
            }
            .listRowInsets(EdgeInsets(top: 0, leading: 16, bottom: 0, trailing: 16))
            .listRowBackground(Color.clear)
        }
        .animation(.smooth, value: searchText)
        // Clear the floating tab bar AND the news drawer's peek (which floats over
        // the list bottom) so the last stock rows scroll fully into view.
        .safeAreaInset(edge: .bottom) { Color.clear.frame(height: 156) }
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
                } : nil,
                sparklineData: appState.sparklineCache[stock.symbol]
            )
        }
        .buttonStyle(BounceButtonStyle())
        .accessibilityIdentifier("market-stock-row")
    }

    private func commodityCryptoRow(_ item: MarketItem) -> some View {
        Button {
            selectedMarketItem = item
        } label: {
            MarketRow(
                symbol: item.symbol,
                name: item.name,
                priceText: String(format: "$%.2f", item.price),
                changePercent: item.changePercent,
                isFavorited: appState.isLocalFavorite(item.name),
                onToggleFavorite: {
                    appState.toggleLocalFavorite(item.name)
                },
                sparklineData: appState.sparklineCache[item.symbol]
            )
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
                TickerBarView(appState: appState) { stock in
                    tickerSelectedStock = stock
                }
                .opacity(appState.isStockDataStale ? 0.65 : 1.0)
            }
        }
    }

    private var fearGreedView: some View {
        Group {
            if let fgScore = appState.fearGreedScore, let fgRating = appState.fearGreedRating {
                VStack(spacing: 0) {
                    HStack(spacing: 12) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Fear & Greed")
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(.secondary)
                            HStack(spacing: 8) {
                                Text("\(fgScore)")
                                    .font(.headline.weight(.heavy).monospacedDigit())
                                    .foregroundStyle(fearGreedColor(fgScore))
                                Text(fgRating)
                                    .font(.caption.weight(.semibold))
                                    .foregroundStyle(fearGreedColor(fgScore))
                            }
                        }
                        Spacer()
                        Text("\(fgScore)%")
                            .font(.caption2.monospacedDigit())
                            .foregroundStyle(.secondary)
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 12)
                    ProgressView(value: Double(fgScore), total: 100)
                        .tint(fearGreedColor(fgScore))
                        .padding(.horizontal, 16)
                        .padding(.vertical, 8)
                    Divider()
                }
                .background(.ultraThinMaterial)
                .frame(maxWidth: .infinity)
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
    let symbol: String
    let name: String
    let priceText: String
    let changePercent: Double
    var isFavorited: Bool = false
    var onToggleFavorite: (() -> Void)? = nil
    var sparklineData: [Double]? = nil

    private var changeColorValue: Color {
        Palette.forChange(changePercent)
    }

    private var signedPercent: String {
        CurrencyFormatter.formatSignedPercent(changePercent)
    }

    var body: some View {
        HStack(spacing: 8) {
            if let onToggle = onToggleFavorite {
                Button {
                    onToggle()
                } label: {
                    Image(systemName: isFavorited ? "star.fill" : "star")
                        .foregroundStyle(isFavorited ? Palette.warningAmber : .secondary)
                        .font(.caption2)
                        .frame(width: 16, height: 16)
                }
                .buttonStyle(BounceButtonStyle())
            }

            VStack(alignment: .leading, spacing: 1) {
                Text(symbol.uppercased())
                    .font(.subheadline.weight(.semibold))
                Text(name)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            Spacer()

            if let data = sparklineData, !data.isEmpty {
                SparklinePath(data: data, color: changeColorValue)
                    .frame(width: 40, height: 20)
            }

            VStack(alignment: .trailing, spacing: 2) {
                Text(priceText)
                    .font(.subheadline.weight(.medium))
                ChangePill(text: signedPercent, color: changeColorValue)
            }
        }
        .padding(.vertical, 3)
        .contentShape(Rectangle())
    }

    private var marketIcon: some View {
        let (icon, color) = getIconAndColor()
        return Image(systemName: icon)
            .font(.subheadline)
            .foregroundStyle(color)
            .frame(width: 24, height: 24)
    }

    private func getIconAndColor() -> (String, Color) {
        let lower = name.lowercased()
        if lower.contains("gold") || lower.contains("xau") { return ("circle.fill", .yellow) }
        if lower.contains("silver") || lower.contains("xag") { return ("circle.fill", Color(.systemGray3)) }
        if lower.contains("oil") || lower.contains("crude") || lower.contains("wti") || lower.contains("brent") { return ("drop.fill", .brown) }
        if lower.contains("gas") || lower.contains("natgas") || lower.contains("natural") { return ("flame.fill", .orange) }
        if lower.contains("copper") { return ("circle.fill", Color(.systemOrange)) }
        if lower.contains("platinum") { return ("circle.fill", Color(.systemGray)) }
        if lower.contains("corn") || lower.contains("wheat") || lower.contains("soy") || lower.contains("coffee") || lower.contains("sugar") { return ("leaf.fill", .green) }
        if lower.contains("us500") || lower.contains("s&p") || lower.contains("spx") { return ("chart.line.uptrend.xyaxis", Palette.appleBlue) }
        if lower.contains("nas") || lower.contains("ndx") || lower.contains("nasdaq") { return ("chart.line.uptrend.xyaxis", .green) }
        if lower.contains("us30") || lower.contains("dow") || lower.contains("dji") { return ("chart.line.uptrend.xyaxis", .cyan) }
        if lower.contains("dxy") || lower.contains("dollar") { return ("dollarsign.circle.fill", .green) }
        if lower.contains("vix") { return ("waveform.path.ecg", .red) }
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
                        if let b = stock.bid { infoRow("Bid", value: String(format: "$%.2f", b)) }
                        if let a = stock.ask { infoRow("Ask", value: String(format: "$%.2f", a)) }
                        if stock.open > 0 { infoRow("Open", value: String(format: "$%.2f", stock.open)) }
                        if stock.prevClose > 0 { infoRow("Prev Close", value: String(format: "$%.2f", stock.prevClose)) }
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
            async let symbolNews = EpiphanyAPI.shared.fetchStockNews(query: item.symbol)
            async let nameNews = EpiphanyAPI.shared.fetchStockNews(query: item.name)
            let (bySymbol, byName) = try await (symbolNews, nameNews)
            relatedNews = bySymbol.isEmpty ? byName : bySymbol
        } catch {
            guard let allNews = try? await EpiphanyAPI.shared.fetchNews() else { return }
            let terms = [item.symbol.lowercased(), item.name.lowercased()]
            relatedNews = allNews.filter { article in
                terms.contains { article.title.lowercased().contains($0) }
            }
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
