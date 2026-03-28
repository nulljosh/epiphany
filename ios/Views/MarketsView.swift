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
    @State private var portfolioExpanded = true
    @State private var cachedItems: [MarketItem] = []

    private let refreshTimer = Timer.publish(every: 30, on: .main, in: .common).autoconnect()

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
            items.append(MarketItem(
                name: commodity.name, symbol: commodity.name, price: commodity.price,
                changePercent: commodity.changePercent, marketCap: nil, peRatio: nil, kind: .commodity
            ))
        }
        for coin in appState.crypto {
            items.append(MarketItem(
                name: coin.symbol, symbol: coin.symbol, price: coin.spot,
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
        switch marketFilter {
        case .all: break
        case .stocks: items = items.filter { if case .stock = $0.kind { return true }; return false }
        case .commodities: items = items.filter { if case .commodity = $0.kind { return true }; return false }
        case .crypto: items = items.filter { if case .crypto = $0.kind { return true }; return false }
        }
        if searchText.isEmpty { return items }
        return items.filter {
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
                        if appState.isLoggedIn {
                            Section(isExpanded: $portfolioExpanded) {
                                if let financeData = appState.financeData {
                                    let portfolio = appState.portfolio ?? Portfolio(financeData: financeData, stocks: appState.stocks)
                                    if !portfolio.holdings.isEmpty {
                                        NavigationLink {
                                            PortfolioView()
                                                .environment(appState)
                                        } label: {
                                            HStack {
                                                VStack(alignment: .leading, spacing: 3) {
                                                    Text(CurrencyFormatter.formatPrice(portfolio.totalValue))
                                                        .font(.title2.weight(.heavy))
                                                        .foregroundStyle(Palette.text)
                                                    HStack(spacing: 4) {
                                                        Text(String(format: "%@$%.2f", portfolio.dayChange >= 0 ? "+" : "", portfolio.dayChange))
                                                        Text(String(format: "(%.1f%%)", portfolio.dayChangePercent))
                                                    }
                                                    .font(.caption.weight(.semibold))
                                                    .foregroundStyle(portfolio.dayChange >= 0 ? Palette.successGreen : Palette.dangerRed)
                                                }
                                                Spacer()
                                                Image(systemName: "chevron.right")
                                                    .font(.caption)
                                                    .foregroundStyle(.tertiary)
                                            }
                                        }
                                        .padding(.vertical, 4)
                                    }

                                    let debt = financeData.debt
                                    let goals = financeData.goals

                                    if !debt.isEmpty || !goals.isEmpty || appState.tallyPayment != nil || !UpcomingPayments.all.isEmpty {
                                        ScrollView(.horizontal, showsIndicators: false) {
                                            HStack(spacing: 10) {
                                                if let tally = appState.tallyPayment, let days = tally.daysUntilPayday {
                                                    TimelineChip(
                                                        icon: "calendar.badge.clock",
                                                        label: "Payday",
                                                        detail: "\(days)d",
                                                        color: Palette.appleBlue
                                                    )
                                                }

                                                ForEach(Array(UpcomingPayments.all.enumerated()), id: \.offset) { _, payment in
                                                    if let days = UpcomingPayments.daysUntil(payment), days >= 0 {
                                                        TimelineChip(
                                                            icon: payment.icon,
                                                            label: payment.name,
                                                            detail: days == 0 ? "Today" : "\(days)d",
                                                            color: Palette.successGreen
                                                        )
                                                    }
                                                }

                                                let debtWithPayoff = debt.map { item in
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

                                                ForEach(goals, id: \.name) { goal in
                                                    TimelineChip(
                                                        icon: "flag",
                                                        label: goal.name,
                                                        detail: String(format: "%.0f%%", goal.progress * 100),
                                                        color: Color(hex: goal.priorityColor)
                                                    )
                                                }
                                            }
                                        }
                                        .listRowInsets(EdgeInsets(top: 8, leading: 0, bottom: 8, trailing: 0))
                                    }
                                } else if appState.financeDataLoaded {
                                    if appState.tallyConnected, let tally = appState.tallyPayment {
                                        HStack {
                                            Image(systemName: "calendar.badge.clock")
                                                .foregroundStyle(Palette.appleBlue)
                                            VStack(alignment: .leading, spacing: 2) {
                                                Text("Next Payday")
                                                    .font(.caption.weight(.semibold))
                                                if let days = tally.daysUntilPayday {
                                                    Text(days == 0 ? "Today" : "\(days) days")
                                                        .font(.caption2)
                                                        .foregroundStyle(.secondary)
                                                }
                                            }
                                            Spacer()
                                            if let amount = tally.paymentAmount {
                                                Text(amount)
                                                    .font(.subheadline.weight(.semibold))
                                            }
                                        }
                                        .padding(.vertical, 4)
                                    } else {
                                        Text("No portfolio data")
                                            .font(.caption)
                                            .foregroundStyle(.secondary)
                                            .frame(maxWidth: .infinity)
                                            .padding(.vertical, 8)
                                    }
                                } else {
                                    ProgressView()
                                        .frame(maxWidth: .infinity)
                                        .padding(.vertical, 8)
                                }
                            } header: {
                                HStack {
                                    Text("Portfolio")
                                    Spacer()
                                    Circle()
                                        .fill(usMarketStatus.color)
                                        .frame(width: 6, height: 6)
                                    Text(usMarketStatus.label)
                                        .font(.caption2)
                                        .foregroundStyle(.secondary)
                                }
                            }
                            .listRowBackground(
                                RoundedRectangle(cornerRadius: 8)
                                    .fill(.ultraThinMaterial)
                                    .padding(2)
                            )
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
                            Picker("Filter", selection: $marketFilter) {
                                ForEach(MarketFilter.allCases) { filter in
                                    Text(filter.label).tag(filter)
                                }
                            }
                            .pickerStyle(.segmented)
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
        .sheet(item: $selectedNewsURL) { url in
            SafariView(url: url)
                .ignoresSafeArea()
        }
        .onAppear {
            isVisible = true
            guard !hasLoaded else { return }
            hasLoaded = true
            rebuildItems()
            if appState.statements.isEmpty {
                Task { await appState.loadStatements() }
            }
        }
        .onDisappear { isVisible = false }
        .onChange(of: appState.stocks.count) { _, _ in rebuildItems() }
        .onChange(of: appState.commodities.count) { _, _ in rebuildItems() }
        .onChange(of: appState.crypto.count) { _, _ in rebuildItems() }
        .onChange(of: sortField) { _, _ in rebuildItems() }
        .onChange(of: sortAscending) { _, _ in rebuildItems() }
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
                rebuildItems()
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

            marketIcon

            VStack(alignment: .leading, spacing: 1) {
                Text(symbolOrName)
                    .font(.subheadline.weight(.medium))
                Text(name)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            Spacer()
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
            .font(.subheadline)
            .foregroundStyle(color)
            .frame(width: 24, height: 24)
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
            let history = try await MonicaAPI.shared.fetchPriceHistory(symbol: yahooSym, range: selectedRange)
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
            async let symbolNews = MonicaAPI.shared.fetchStockNews(query: item.symbol)
            async let nameNews = MonicaAPI.shared.fetchStockNews(query: item.name)
            let (bySymbol, byName) = try await (symbolNews, nameNews)
            relatedNews = bySymbol.isEmpty ? byName : bySymbol
        } catch {
            guard let allNews = try? await MonicaAPI.shared.fetchNews() else { return }
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
