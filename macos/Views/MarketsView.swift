import SwiftUI
import Charts

struct MarketsView: View {
    @Environment(AppState.self) private var appState
    @State private var searchText = ""
    @State private var searchResults: [EpiphanyAPI.SymbolSearchResult] = []
    @State private var isVisible = false
    @State private var hasLoaded = false
    @State private var selectedStock: Stock?
    @State private var selectedAsset: MarketItem?
    @State private var activeList: String?  // a named watchlist, nil = everything
    @State private var signalFilter: Indicators.TradeSignal?

    // Same names as iOS, so a row says Natural Gas, not Natgas.
    private static let assetDisplayNames: [String: String] = [
        "Gold": "Gold (XAU/USD)", "Silver": "Silver (XAG/USD)",
        "Oil": "WTI Crude Oil", "Natgas": "Natural Gas",
        "Copper": "Copper (HG)", "Platinum": "Platinum (PL)",
        "Palladium": "Palladium (PA)",
        "Nas100": "Nasdaq 100", "Us500": "S&P 500", "Us30": "Dow Jones",
        "Dxy": "US Dollar Index",
        "Btc": "Bitcoin", "Eth": "Ethereum",
    ]
    @State private var sortField: MarketSortField = .change
    @State private var sortAscending = false
    @State private var marketFilter: MarketFilter = .all

    private var allItems: [MarketItem] {
        var items: [MarketItem] = []
        for stock in appState.stocks {
            items.append(MarketItem(
                name: stock.name, symbol: stock.symbol, price: stock.price,
                changePercent: stock.changePercent, marketCap: stock.marketCap,
                peRatio: stock.peRatio, kind: .stock(stock)
            ))
        }
        for commodity in appState.commodities {
            items.append(MarketItem(
                name: Self.assetDisplayNames[commodity.name] ?? commodity.name, symbol: commodity.name, price: commodity.price,
                changePercent: commodity.changePercent, marketCap: nil,
                peRatio: nil, kind: .commodity
            ))
        }
        for coin in appState.crypto {
            items.append(MarketItem(
                name: coin.symbol, symbol: coin.symbol, price: coin.spot,
                changePercent: coin.chgPct, marketCap: nil,
                peRatio: nil, kind: .crypto
            ))
        }
        return items
    }

    private var filteredItems: [MarketItem] {
        var items = allItems
        if let name = activeList, let list = appState.watchlistLists.first(where: { $0.name == name }) {
            items = items.filter { list.symbols.contains($0.symbol) }
        }
        switch marketFilter {
        case .all: break
        case .stocks: items = items.filter { if case .stock = $0.kind { return true }; return false }
        case .commodities: items = items.filter { if case .commodity = $0.kind { return true }; return false }
        case .crypto: items = items.filter { if case .crypto = $0.kind { return true }; return false }
        }
        // Same Long/Hold/Short read as the stock page, from today's sparkline closes.
        if let sig = signalFilter {
            items = items.filter { Indicators.signal(closes: appState.sparklineCache[$0.symbol] ?? []) == sig }
        }
        if !searchText.isEmpty {
            items = items.filter {
                $0.name.localizedCaseInsensitiveContains(searchText) ||
                $0.symbol.localizedCaseInsensitiveContains(searchText)
            }
        }
        return items.sorted { lhs, rhs in
            let order = comparisonResult(lhs, rhs)
            if order == .orderedSame { return lhs.id < rhs.id }
            return sortAscending ? order == .orderedAscending : order == .orderedDescending
        }
    }

    private var activeSortLabel: String {
        "\(sortField.title) \(sortAscending ? "ascending" : "descending")"
    }

    private func comparisonResult(_ lhs: MarketItem, _ rhs: MarketItem) -> ComparisonResult {
        switch sortField {
        case .symbol:
            return lhs.symbol.localizedStandardCompare(rhs.symbol)
        case .name:
            return lhs.name.localizedStandardCompare(rhs.name)
        case .price:
            if lhs.price == rhs.price {
                return lhs.symbol.localizedStandardCompare(rhs.symbol)
            }
            return lhs.price < rhs.price ? .orderedAscending : .orderedDescending
        case .pe:
            let lhsPE = lhs.peRatio ?? (sortAscending ? .infinity : -.infinity)
            let rhsPE = rhs.peRatio ?? (sortAscending ? .infinity : -.infinity)
            if lhsPE == rhsPE {
                return lhs.symbol.localizedStandardCompare(rhs.symbol)
            }
            return lhsPE < rhsPE ? .orderedAscending : .orderedDescending
        case .marketCap:
            let lhsCap = lhs.marketCap ?? (sortAscending ? .infinity : -.infinity)
            let rhsCap = rhs.marketCap ?? (sortAscending ? .infinity : -.infinity)
            if lhsCap == rhsCap {
                return lhs.symbol.localizedStandardCompare(rhs.symbol)
            }
            return lhsCap < rhsCap ? .orderedAscending : .orderedDescending
        case .change:
            if lhs.changePercent == rhs.changePercent {
                return lhs.symbol.localizedStandardCompare(rhs.symbol)
            }
            return lhs.changePercent < rhs.changePercent ? .orderedAscending : .orderedDescending
        }
    }

    var body: some View {
        Group {
            if appState.isLoading && appState.stocks.isEmpty {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if appState.stocks.isEmpty && appState.commodities.isEmpty && appState.crypto.isEmpty {
                ContentUnavailableView(
                    "Markets Temporarily Unavailable",
                    systemImage: "chart.line.uptrend.xyaxis",
                    description: Text("Click refresh to try again.")
                )
            } else {
                // Mac layout, like Stocks: the list in a fixed column, the pick on the right.
                HStack(spacing: 0) {
                    VStack(spacing: 0) {
                        HStack {
                            Picker("Filter", selection: $marketFilter) {
                                ForEach(MarketFilter.allCases) { filter in
                                    Text(filter.rawValue).tag(filter)
                                }
                            }
                            .pickerStyle(.segmented)
                            .labelsHidden()
                        }
                        .padding(.horizontal)
                        .padding(.top, 12)
                        .padding(.bottom, 8)

                        HStack {
                            TextField("Search markets", text: $searchText)
                                .textFieldStyle(.roundedBorder)
                            if appState.isLoggedIn {
                                WatchlistListPicker(lists: appState.watchlistLists, active: $activeList,
                                                    onCreate: { appState.updateWatchlistLists(appState.watchlistLists + [WatchlistList(name: $0, symbols: [])]) },
                                                    onDelete: { name in appState.updateWatchlistLists(appState.watchlistLists.filter { $0.name != name }); activeList = nil })
                            }
                        }
                        .padding(.horizontal)
                        .padding(.bottom, 8)

                        marketList
                    }
                    .frame(width: 380)

                    Divider()

                    Group {
                        if let stock = selectedStock {
                            detailPane { StockDetailView(stock: stock).id(stock.symbol) }
                        } else if let item = selectedAsset {
                            detailPane { AssetDetailView(item: item).id(item.symbol) }
                        } else {
                            overview
                        }
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .onAppear {
            isVisible = true
            guard !hasLoaded else { return }
            hasLoaded = true
            Task {
                async let stocks: Void = appState.loadStocks()
                async let watchlist: Void = appState.loadWatchlist()
                async let commodities: Void = appState.loadCommodities()
                async let crypto: Void = appState.loadCrypto()
                async let finance: Void = appState.loadFinanceData()
                async let brief: Void = appState.loadDailyBrief()
                async let fg: Void = appState.loadFearGreed()
                _ = await (stocks, watchlist, commodities, crypto, finance, brief, fg)
            }
        }
        .onDisappear { isVisible = false }
        .onChange(of: appState.isLoggedIn) { _, isLoggedIn in
            guard isLoggedIn, appState.watchlist.isEmpty else { return }
            Task { await appState.loadWatchlist() }
        }
        // ponytail: adaptive interval instead of a fixed 30s Combine timer -- polls faster (10s)
        // while data is stale so it self-heals as soon as the upstream API recovers, instead of
        // sitting on the "Data may be stale" banner for a full 30s+ per retry.
        .task {
            while !Task.isCancelled {
                let interval = appState.isStockDataStale ? 10 : 30
                try? await Task.sleep(for: .seconds(interval))
                guard isVisible else { continue }
                async let s: Void = appState.loadStocks(force: true)
                async let c: Void = appState.loadCommodities(force: true)
                async let k: Void = appState.loadCrypto(force: true)
                _ = await (s, c, k)
            }
        }
    }

    private func isPicked(_ item: MarketItem) -> Bool {
        (selectedStock?.symbol ?? selectedAsset?.symbol) == item.symbol
    }

    /// Nothing picked: the day at a glance, held to a readable width.
    private var overview: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                HStack {
                    Circle()
                        .fill(usMarketStatus.color)
                        .frame(width: 6, height: 6)
                    Text(usMarketStatus.label)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Spacer()

                    Button {
                        Task {
                            async let s: Void = appState.loadStocks(force: true)
                            async let c: Void = appState.loadCommodities(force: true)
                            async let k: Void = appState.loadCrypto(force: true)
                            _ = await (s, c, k)
                        }
                    } label: {
                        Image(systemName: "arrow.clockwise")
                    }
                    .buttonStyle(.borderless)
                }
                .padding(.horizontal)
                .padding(.vertical, 8)

                if appState.isStockDataStale, let fetchedAt = appState.stocksFetchedAt {
                    (Text("Data may be stale \u{00B7} updated ") + Text(fetchedAt, style: .relative) + Text(" ago"))
                        .font(.caption2)
                        .foregroundStyle(.orange)
                        .frame(maxWidth: .infinity, alignment: .center)
                        .padding(.vertical, 4)
                        .background(.black.opacity(0.4))
                }

                if let fgScore = appState.fearGreedScore, let fgRating = appState.fearGreedRating {
                    // Same shape as iOS/web: label, score and rating on one
                    // baseline with the bar flush beneath, full width.
                    VStack(alignment: .leading, spacing: 8) {
                        HStack(alignment: .firstTextBaseline, spacing: 8) {
                            Text("Fear & Greed")
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(.secondary)
                            Text("\(fgScore)")
                                .font(.subheadline.weight(.bold).monospacedDigit())
                                .foregroundStyle(fearGreedColor(fgScore))
                            Text(fgRating)
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(fearGreedColor(fgScore))
                            Spacer(minLength: 0)
                        }
                        ProgressView(value: Double(fgScore), total: 100)
                            .tint(fearGreedColor(fgScore))
                    }
                    .padding(.horizontal)
                    .padding(.bottom, 10)
                }

                HStack(spacing: 12) {
                    topLink("News", systemImage: "newspaper") {
                        NewsView()
                            .environment(appState)
                    }
                    topLink("Macro", systemImage: "chart.bar.doc.horizontal") {
                        MacroView()
                            .environment(appState)
                    }
                    topLink("Alerts", systemImage: "bell.badge") {
                        AlertsView()
                            .environment(appState)
                    }
                    Spacer()
                }
                .padding(.horizontal)
                .padding(.bottom, 8)

                if let brief = appState.dailyBrief, !brief.points.isEmpty {
                    VStack(alignment: .leading, spacing: 6) {
                        HStack {
                            Text("Daily Brief")
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(.secondary)
                            Spacer()
                            BriefListenButton(brief: brief)
                        }
                        ForEach(brief.points, id: \.self) { point in
                            HStack(alignment: .top, spacing: 6) {
                                Circle()
                                    .fill(Palette.appleBlue)
                                    .frame(width: 4, height: 4)
                                    .padding(.top, 5)
                                Text(point)
                                    .font(.caption)
                                    .lineLimit(2)
                            }
                        }
                    }
                    .padding(.horizontal)
                    .padding(.bottom, 8)
                }

                if appState.isLoggedIn, let financeData = appState.financeData {
                    let portfolio = appState.portfolio ?? Portfolio(financeData: financeData, stocks: appState.stocks)
                    let totalBalance = financeData.accounts.reduce(0) { $0 + $1.balance }
                    let totalDebt = financeData.debt.reduce(0) { $0 + $1.balance }
                    // totalValue is already the sum of account balances (holdings folded in server-side),
                    // or the holdings value when there are no accounts. Adding totalBalance on top counted it twice.
                    let netWorth = portfolio.totalValue - totalDebt

                HStack {
                        VStack(alignment: .leading, spacing: 3) {
                            Text(CurrencyFormatter.formatPrice(netWorth))
                                .font(.title3.weight(.heavy))
                            if !portfolio.holdings.isEmpty {
                                HStack(spacing: 4) {
                                    Text(CurrencyFormatter.formatSignedPrice(portfolio.dayChange))
                                    Text(String(format: "(%.1f%%)", portfolio.dayChangePercent))
                                }
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(portfolio.dayChange >= 0 ? Palette.successGreen : Palette.dangerRed)
                            } else {
                                Text("Net Worth")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                        Spacer()
                        if !financeData.accounts.isEmpty {
                            VStack(alignment: .trailing, spacing: 3) {
                                Text(CurrencyFormatter.formatPrice(totalBalance))
                                    .font(.subheadline.weight(.semibold))
                                    .foregroundStyle(Palette.successGreen)
                                Text("\(financeData.accounts.count) accounts")
                                    .font(.caption2)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                    .padding(.horizontal)
                    .padding(.bottom, 4)

                    if !financeData.accounts.isEmpty {
                        ScrollView(.horizontal, showsIndicators: true) {
                            HStack(spacing: 10) {
                                ForEach(financeData.accounts) { account in
                                    TimelineChip(
                                        icon: account.type == "investment" ? "chart.line.uptrend.xyaxis" : account.type == "gift" ? "giftcard" : "banknote",
                                        label: account.name,
                                        detail: CurrencyFormatter.formatAbbreviated(account.balance),
                                        color: Palette.appleBlue
                                    )
                                }
                            }
                            .padding(.horizontal)
                        }
                        .padding(.bottom, 4)
                    }

                    if !financeData.debt.isEmpty {
                        ScrollView(.horizontal, showsIndicators: true) {
                            HStack(spacing: 10) {

                                let debtWithPayoff = financeData.debt.map { item in
                                    (item: item, months: DebtCalc.monthsToPayoff(item: item))
                                }.sorted { $0.months < $1.months }

                                ForEach(debtWithPayoff, id: \.item.name) { entry in
                                    TimelineChip(
                                        icon: DebtCalc.icon(for: entry.item.name),
                                        label: entry.item.name,
                                        detail: DebtCalc.payoffLabel(entry.months),
                                        color: entry.months < 0.1 ? Palette.successGreen : entry.months <= 3 ? Palette.warningAmber : Palette.dangerRed
                                    )
                                }
                            }
                            .padding(.horizontal)
                        }
                        .padding(.bottom, 8)
                    }
                }

                if !appState.stocks.isEmpty {
                    MarketPulse(stocks: appState.stocks, sparklines: appState.sparklineCache) { selectedStock = $0; selectedAsset = nil }
                        .task {
                            async let spy: Void = appState.loadSparkline("SPY")
                            async let qqq: Void = appState.loadSparkline("QQQ")
                            async let dia: Void = appState.loadSparkline("DIA")
                            _ = await (spy, qqq, dia)
                        }
                }
            }
            .frame(maxWidth: 760, alignment: .leading)
            .padding(.vertical, 16)
            .padding(.horizontal, 8)
            .frame(maxWidth: .infinity)
        }
    }

    /// The picked stock or asset in place of a sheet. Esc goes back to the overview.
    private func detailPane(@ViewBuilder _ content: () -> some View) -> some View {
        VStack(spacing: 0) {
            HStack {
                Button {
                    selectedStock = nil
                    selectedAsset = nil
                } label: {
                    Label("Overview", systemImage: "chevron.left")
                }
                .buttonStyle(.borderless)
                .keyboardShortcut(.cancelAction)
                Spacer()
            }
            .padding(.horizontal, 20)
            .padding(.top, 12)
            content()
                .environment(appState)
        }
    }

    private var marketList: some View {
        VStack(spacing: 0) {
            // The old column headers matched a table layout the rows no longer have.
            HStack {
                Menu {
                    ForEach([MarketSortField.symbol, .name, .price, .pe, .marketCap, .change], id: \.self) { field in
                        Button {
                            if sortField == field { sortAscending.toggle() } else {
                                sortField = field
                                sortAscending = field.defaultAscending
                            }
                        } label: {
                            Text(sortField == field ? "\(field.title) \(sortAscending ? "↑" : "↓")" : field.title)
                        }
                    }
                } label: {
                    Label("Sorted by \(activeSortLabel)", systemImage: "arrow.up.arrow.down")
                        .font(.caption)
                }
                .menuStyle(.borderlessButton)
                .fixedSize()
                Picker("Signal", selection: $signalFilter) {
                    Text("Any Signal").tag(Indicators.TradeSignal?.none)
                    ForEach([Indicators.TradeSignal.buy, .hold, .sell], id: \.self) { sig in
                        Text(sig.rawValue).tag(Optional(sig))
                    }
                }
                .labelsHidden()
                .fixedSize()
                // Rows load sparklines as they scroll in; a signal filter needs them all.
                .task(id: signalFilter) {
                    guard signalFilter != nil else { return }
                    await withTaskGroup(of: Void.self) { group in
                        for item in allItems { group.addTask { await appState.loadSparkline(item.symbol) } }
                    }
                }
                Spacer()
            }
            .padding(.horizontal)
            .padding(.bottom, 8)

            ScrollView {
                LazyVStack(spacing: 0) {
                    searchResultRows
                    ForEach(filteredItems) { item in
                        marketRow(item)
                    }
                }
                .padding(.horizontal)
                .padding(.bottom, 12)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .task(id: searchText) {
            let query = searchText.trimmingCharacters(in: .whitespaces)
            guard !query.isEmpty else { searchResults = []; return }
            try? await Task.sleep(for: .milliseconds(250))
            guard !Task.isCancelled else { return }
            searchResults = (try? await EpiphanyAPI.shared.searchSymbols(query)) ?? []
        }
    }

    // Any ticker, not just the loaded list: add it straight to the watchlist.
    @ViewBuilder
    private var searchResultRows: some View {
        let loaded = Set(filteredItems.map(\.symbol))
        ForEach(searchResults.filter { !loaded.contains($0.symbol) }) { result in
            let added = appState.isInWatchlist(result.symbol)
            HStack(spacing: 10) {
                Text(result.symbol).font(.body.weight(.semibold))
                Text([result.name, result.exchange].compactMap { $0 }.joined(separator: " · "))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                Spacer()
                Button(added ? "Added" : "Add to watchlist") {
                    Task {
                        if added { await appState.removeWatchlistSymbol(result.symbol) }
                        else { await appState.addWatchlistSymbol(result.symbol) }
                    }
                }
            }
            .padding(.vertical, 6)
        }
    }

    private func marketRow(_ item: MarketItem) -> some View {
        Button {
            if case .stock(let stock) = item.kind { selectedStock = stock; selectedAsset = nil } else { selectedAsset = item; selectedStock = nil }
        } label: {
            // Same row as iOS Stocks; the star stays since a Mac has no swipe.
            HStack(spacing: 10) {
                watchlistButton(for: item)
                QuoteRow(symbol: item.symbol, name: item.name, price: item.price,
                         changePercent: item.changePercent, sparklineData: appState.sparklineCache[item.symbol])
            }
            .padding(.horizontal, 8)
            .background(
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .fill(Color.accentColor.opacity(isPicked(item) ? 0.14 : 0))
            )
            .overlay(alignment: .bottom) { Rectangle().fill(.separator).frame(height: 0.5).padding(.horizontal, 8) }
            .task { await appState.loadSparkline(item.symbol) }
        }
        .buttonStyle(.plain)
        .contextMenu { AddToListMenu(symbol: item.symbol, lists: appState.watchlistLists) { appState.toggle($1, inList: $0) } }
    }

    @ViewBuilder
    private func watchlistButton(for item: MarketItem) -> some View {
        if case .stock(let stock) = item.kind, appState.isLoggedIn {
            Button {
                Task {
                    if appState.isInWatchlist(stock.symbol) {
                        await appState.removeWatchlistSymbol(stock.symbol)
                    } else {
                        await appState.addWatchlistSymbol(stock.symbol)
                    }
                }
            } label: {
                Image(systemName: appState.isInWatchlist(stock.symbol) ? "star.fill" : "star")
                    .foregroundStyle(appState.isInWatchlist(stock.symbol) ? Palette.warningAmberAlt : .secondary)
                    .font(.caption)
            }
            .buttonStyle(.plain)
        }
    }

    private func topLink<Destination: View>(
        _ title: String,
        systemImage: String,
        @ViewBuilder destination: () -> Destination
    ) -> some View {
        NavigationLink(destination: destination) {
            Label(title, systemImage: systemImage)
                .font(.caption.weight(.semibold))
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .fill(Color.primary.opacity(0.07))
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .stroke(Color.primary.opacity(0.06), lineWidth: 1)
                )
        }
        .buttonStyle(.plain)
    }

    private func fearGreedColor(_ score: Int) -> Color {
        if score <= 24 { return .red }
        if score <= 44 { return .orange }
        if score <= 55 { return .secondary }
        if score <= 75 { return .green }
        return .green
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

        func countdown(_ m: Int) -> String {
            m >= 60 ? "\(m / 60)h \(m % 60)m" : "\(m)m"
        }
        // Minutes until the next 9:30 ET open, rolling over weekends
        func untilNextOpen() -> Int {
            var m = marketOpen - minutes
            if !isWeekday || minutes >= marketOpen {
                let daysAhead: Int
                switch weekday {
                case 6: daysAhead = 3      // Fri after open -> Mon
                case 7: daysAhead = 2      // Sat -> Mon
                case 1: daysAhead = 1      // Sun -> Mon
                default: daysAhead = 1
                }
                m += daysAhead * 24 * 60
            }
            return m
        }

        guard isWeekday else { return ("Market Closed · opens in \(countdown(untilNextOpen()))", .secondary) }
        if minutes >= marketOpen && minutes < marketClose {
            let toClose = marketClose - minutes
            let label = toClose <= 60 ? "Market Open · closes in \(countdown(toClose))" : "Market Open"
            return (label, Palette.successGreen)
        }
        if minutes >= premarketStart && minutes < marketOpen {
            return ("Pre-Market · opens in \(countdown(marketOpen - minutes))", Palette.warningAmberAlt)
        }
        if minutes >= marketClose && minutes < afterHoursClose {
            return ("After Hours · opens in \(countdown(untilNextOpen()))", Palette.warningAmberAlt)
        }
        return ("Market Closed · opens in \(countdown(untilNextOpen()))", .secondary)
    }
}

private enum MarketSortField {
    case symbol
    case name
    case price
    case pe
    case marketCap
    case change

    var title: String {
        switch self {
        case .symbol: return "Symbol"
        case .name: return "Name"
        case .price: return "Price"
        case .pe: return "P/E"
        case .marketCap: return "Mkt Cap"
        case .change: return "Change"
        }
    }

    var defaultAscending: Bool {
        switch self {
        case .symbol, .name: return true
        case .price, .pe, .marketCap, .change: return false
        }
    }
}

private struct MarketItem: Identifiable {
    let name: String
    let symbol: String
    let price: Double
    let changePercent: Double
    let marketCap: Double?
    let peRatio: Double?
    let kind: Kind

    var isStock: Bool {
        if case .stock = kind { return true }
        return false
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

    var formattedMarketCap: String {
        guard let marketCap, marketCap > 0 else { return "N/A" }
        if marketCap >= 1_000_000_000_000 {
            return String(format: "$%.2fT", marketCap / 1_000_000_000_000)
        } else if marketCap >= 1_000_000_000 {
            return String(format: "$%.1fB", marketCap / 1_000_000_000)
        } else if marketCap >= 1_000_000 {
            return String(format: "$%.0fM", marketCap / 1_000_000)
        }
        return CurrencyFormatter.formatPrice(marketCap, decimals: 0)
    }

    var formattedPERatio: String {
        guard let peRatio, peRatio > 0 else { return "N/A" }
        return String(format: "%.1f", peRatio)
    }
}

private enum MarketFilter: String, CaseIterable, Identifiable {
    case all = "All"
    case stocks = "Stocks"
    case commodities = "Commodities"
    case crypto = "Crypto"

    var id: String { rawValue }
}

/// Commodity and crypto page on the Mac: chart, the day or 24h ranges, period high and low.
private struct AssetDetailView: View {
    let item: MarketItem
    @State private var range = "1y"
    @State private var history: [PriceHistory.DataPoint] = []
    @State private var stats: [(String, String)] = []
    @State private var livePrice: Double?
    @State private var tallChart = false
    @State private var showSMA = true
    @State private var showEMA = true

    private let ranges = ["1m", "15m", "1d", "5d", "1mo", "3mo", "1y"]

    private var price: Double { livePrice ?? item.price }
    private var points: [(Date, Double)] { history.compactMap { p in p.parsedDate.map { ($0, p.close) } } }

    /// Day change against the previous close the list row was built from, so the live tick moves it too.
    private var changePercent: Double {
        LivePrice.changePercent(listPrice: item.price, listPercent: item.changePercent, live: livePrice)
    }

    private var rangeName: String { LivePrice.rangeName(range) }

    var body: some View {
        let color = changePercent >= 0 ? Palette.successGreen : Palette.dangerRed
        // Inline in the pane now, so the tall chart and stats scroll instead of clipping on a short window.
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(item.name).font(.title2.weight(.bold))
                        HStack(alignment: .firstTextBaseline, spacing: 8) {
                            Text(CurrencyFormatter.formatPrice(price)).font(.title.weight(.semibold).monospacedDigit())
                                .contentTransition(.numericText(value: price))
                            Text(String(format: "%@%.2f%%", changePercent >= 0 ? "+" : "", changePercent))
                                .font(.headline.monospacedDigit()).foregroundStyle(color)
                                .contentTransition(.numericText(value: changePercent))
                        }
                        .animation(.snappy, value: price)
                    }
                    Spacer()
                    if let sig = Indicators.signal(closes: history.map(\.close)) { SignalPill(signal: sig) }
                }
                HStack(spacing: 12) {
                    IndicatorChip(label: "SMA 20", isOn: $showSMA, color: Palette.warningAmber)
                    IndicatorChip(label: "EMA 50", isOn: $showEMA, color: Palette.slate)
                    Picker("Range", selection: $range) {
                        ForEach(ranges, id: \.self) { Text($0.uppercased()).tag($0) }
                    }
                    .pickerStyle(.segmented)
                    .labelsHidden()
                    ChartSizeButton(tall: $tallChart)
                }
                let points = points
                Chart {
                    ForEach(points, id: \.0) { p in
                        LineMark(x: .value("Date", p.0), y: .value("Price", p.1), series: .value("Series", "Price"))
                            .foregroundStyle(color)
                    }
                    // Same overlays as a stock: SMA 20 amber, EMA 50 slate.
                    if showSMA {
                        ForEach(Indicators.sma(prices: points, period: 20), id: \.date) { p in
                            LineMark(x: .value("Date", p.date), y: .value("SMA", p.value), series: .value("Series", "SMA"))
                                .foregroundStyle(Palette.warningAmber)
                        }
                    }
                    if showEMA {
                        ForEach(Indicators.ema(prices: points, period: 50), id: \.date) { p in
                            LineMark(x: .value("Date", p.date), y: .value("EMA", p.value), series: .value("Series", "EMA"))
                                .foregroundStyle(Palette.slate)
                        }
                    }
                }
                .chartXAxis(.hidden)
                .chartYScale(domain: .automatic(includesZero: false))
                .frame(height: tallChart ? 520 : 220)
                VStack(spacing: 0) {
                    ForEach(rows, id: \.0) { row in
                        HStack {
                            Text(row.0).foregroundStyle(.secondary)
                            Spacer()
                            Text(row.1).monospacedDigit()
                        }
                        .padding(.vertical, 6)
                        Divider()
                    }
                }
                Spacer(minLength: 0)
            }
            .padding(24)
        }
        .task { stats = await EpiphanyAPI.shared.fetchMarketStats(symbol: item.symbol, isCrypto: { if case .crypto = item.kind { return true }; return false }()) }
        .task(id: range) {
            guard let sym = item.yahooSymbol else { return }
            history = (try? await EpiphanyAPI.shared.fetchPriceHistory(symbol: sym, range: range))?.history ?? []
        }
        .task {
            guard let sym = item.yahooSymbol else { return }
            await LivePrice.poll(sym) { livePrice = $0 }
        }
    }

    private var rows: [(String, String)] {
        var out = stats
        // Period high and low from the chart already loaded, no extra fetch.
        if let hi = history.map({ $0.high ?? $0.close }).max(), let lo = history.map({ $0.low ?? $0.close }).min(), lo > 0 {
            out.append(("\(rangeName) High", CurrencyFormatter.formatPrice(hi)))
            out.append(("\(rangeName) Low", CurrencyFormatter.formatPrice(lo)))
        }
        return out
    }
}
