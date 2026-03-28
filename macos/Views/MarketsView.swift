import SwiftUI

struct MarketsView: View {
    @Environment(AppState.self) private var appState
    @State private var searchText = ""
    @State private var isVisible = false
    @State private var hasLoaded = false
    @State private var selectedStock: Stock?
    @State private var sortField: MarketSortField = .change
    @State private var sortAscending = false
    @State private var marketFilter: MarketFilter = .all

    private let refreshTimer = Timer.publish(every: 30, on: .main, in: .common).autoconnect()


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
                name: commodity.name, symbol: commodity.name, price: commodity.price,
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
        switch marketFilter {
        case .all: break
        case .stocks: items = items.filter { if case .stock = $0.kind { return true }; return false }
        case .commodities: items = items.filter { if case .commodity = $0.kind { return true }; return false }
        case .crypto: items = items.filter { if case .crypto = $0.kind { return true }; return false }
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

    private func sortButton(_ field: MarketSortField) -> some View {
        Button {
            if sortField == field {
                sortAscending.toggle()
            } else {
                sortField = field
                sortAscending = field.defaultAscending
            }
        } label: {
            HStack(spacing: 4) {
                Text(field.title)
                if sortField == field {
                    Image(systemName: sortAscending ? "chevron.up" : "chevron.down")
                        .font(.caption2.weight(.bold))
                }
            }
            .font(.caption.weight(sortField == field ? .semibold : .medium))
            .foregroundStyle(sortField == field ? Color.white : .secondary)
            .frame(maxWidth: .infinity, alignment: field.alignment)
            .padding(.vertical, 6)
            .padding(.horizontal, 8)
            .background(
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .fill(sortField == field ? Color.white.opacity(0.08) : Color.clear)
            )
        }
        .buttonStyle(.plain)
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
                VStack(spacing: 0) {
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
                            Text("Daily Brief")
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(.secondary)
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
                        let netWorth = (portfolio.holdings.isEmpty ? 0 : portfolio.totalValue) + totalBalance - totalDebt

                        HStack {
                            VStack(alignment: .leading, spacing: 3) {
                                Text(CurrencyFormatter.formatPrice(netWorth))
                                    .font(.title3.weight(.heavy))
                                if !portfolio.holdings.isEmpty {
                                    HStack(spacing: 4) {
                                        Text(String(format: "%@$%.2f", portfolio.dayChange >= 0 ? "+" : "", portfolio.dayChange))
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
                            ScrollView(.horizontal, showsIndicators: false) {
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

                        if !financeData.debt.isEmpty || !UpcomingPayments.all.isEmpty {
                            ScrollView(.horizontal, showsIndicators: false) {
                                HStack(spacing: 10) {
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

                    HStack {
                        Picker("Filter", selection: $marketFilter) {
                            ForEach(MarketFilter.allCases) { filter in
                                Text(filter.rawValue).tag(filter)
                            }
                        }
                        .pickerStyle(.segmented)
                        .frame(maxWidth: 300)

                        Spacer()

                        TextField("Search markets", text: $searchText)
                            .textFieldStyle(.roundedBorder)
                            .frame(maxWidth: 200)
                    }
                    .padding(.horizontal)
                    .padding(.bottom, 8)

                    marketList
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .sheet(item: $selectedStock) { stock in
            StockDetailView(stock: stock)
                .environment(appState)
                .frame(minWidth: 720, minHeight: 520)
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
                async let finance: Void = appState.loadFinanceData()
                async let brief: Void = appState.loadDailyBrief()
                _ = await (stocks, watchlist, commodities, crypto, finance, brief)
            }
        }
        .onDisappear { isVisible = false }
        .onChange(of: appState.isLoggedIn) { _, isLoggedIn in
            guard isLoggedIn, appState.watchlist.isEmpty else { return }
            Task { await appState.loadWatchlist() }
        }
        .onReceive(refreshTimer) { _ in
            guard isVisible else { return }
            Task {
                async let s: Void = appState.loadStocks(force: true)
                async let c: Void = appState.loadCommodities(force: true)
                async let k: Void = appState.loadCrypto(force: true)
                _ = await (s, c, k)
            }
        }
    }

    private var marketList: some View {
        VStack(spacing: 0) {
            HStack(spacing: 10) {
                sortButton(.symbol)
                    .frame(maxWidth: 150, alignment: .leading)
                sortButton(.name)
                sortButton(.price)
                    .frame(maxWidth: 110, alignment: .trailing)
                sortButton(.pe)
                    .frame(maxWidth: 84, alignment: .trailing)
                sortButton(.marketCap)
                    .frame(maxWidth: 110, alignment: .trailing)
                sortButton(.change)
                    .frame(maxWidth: 110, alignment: .trailing)
            }
            .padding(.horizontal)
            .padding(.bottom, 6)

            HStack {
                Text("Sorted by \(activeSortLabel)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Spacer()
            }
            .padding(.horizontal)
            .padding(.bottom, 8)

            ScrollView {
                LazyVStack(spacing: 8) {
                    ForEach(filteredItems) { item in
                        marketRow(item)
                    }
                }
                .padding(.horizontal)
                .padding(.bottom, 12)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
    }

    private func marketRow(_ item: MarketItem) -> some View {
        Button {
            guard case .stock(let stock) = item.kind else { return }
            selectedStock = stock
        } label: {
            HStack(spacing: 10) {
                HStack(spacing: 6) {
                    watchlistButton(for: item)
                    Text(item.symbol)
                        .font(.body.weight(.semibold))
                        .foregroundStyle(.primary)
                }
                .frame(maxWidth: 150, alignment: .leading)

                Text(item.name)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                    .frame(maxWidth: .infinity, alignment: .leading)

                Text(String(format: "$%.2f", item.price))
                    .font(.body.monospacedDigit())
                    .frame(maxWidth: 110, alignment: .trailing)

                Text(item.formattedPERatio)
                    .font(.caption.monospacedDigit())
                    .foregroundStyle(item.peRatio == nil ? .secondary : .primary)
                    .frame(maxWidth: 84, alignment: .trailing)

                Text(item.formattedMarketCap)
                    .font(.caption.monospacedDigit())
                    .foregroundStyle(item.marketCap == nil ? .secondary : .primary)
                    .frame(maxWidth: 110, alignment: .trailing)

                Text(String(format: "%@%.2f%%", item.changePercent >= 0 ? "+" : "", item.changePercent))
                    .font(.caption.monospacedDigit())
                    .foregroundStyle(item.changePercent >= 0 ? Palette.successGreen : Palette.dangerRed)
                    .frame(maxWidth: 110, alignment: .trailing)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 11)
            .background(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(Color.white.opacity(0.04))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .stroke(Color.white.opacity(0.05), lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .disabled(!item.isStock)
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
                        .fill(Color.white.opacity(0.07))
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .stroke(Color.white.opacity(0.06), lineWidth: 1)
                )
        }
        .buttonStyle(.plain)
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

        guard isWeekday else { return ("Market Closed", .secondary) }
        if minutes >= marketOpen && minutes < marketClose {
            return ("Market Open", Palette.successGreen)
        }
        if minutes >= premarketStart && minutes < marketOpen {
            return ("Pre-Market", Palette.warningAmberAlt)
        }
        if minutes >= marketClose && minutes < afterHoursClose {
            return ("After Hours", Palette.warningAmberAlt)
        }
        return ("Market Closed", .secondary)
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

    var alignment: Alignment {
        switch self {
        case .symbol, .name: return .leading
        case .price, .pe, .marketCap, .change: return .trailing
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
        return String(format: "$%.0f", marketCap)
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
